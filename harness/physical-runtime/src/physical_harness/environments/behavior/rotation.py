from __future__ import annotations

import math
import time
from typing import Callable

import torch
from omnigibson.controllers.controller_view import ControllerView
import omnigibson.utils.transform_utils as T

from physical_harness.environments import NativeRotation


MAX_CONTROL_STEPS = 240
MAX_DURATION_S = 45.0
ANGLE_TOLERANCE = math.radians(1.5)


def wrapped(angle: float) -> float:
    return (angle + math.pi) % (2 * math.pi) - math.pi


class NativeViewRotation:
    def __init__(self, environment) -> None:
        self.environment = environment
        self.env = environment._require_env()
        self.robot = self.env.robots[0]
        self.base_indices = self.robot.controller_action_idx["base"]
        self.trunk_indices = self.robot.controller_action_idx["trunk"]
        base_key, _ = self.robot.controllers["base"]
        trunk_key, _ = self.robot.controllers["trunk"]
        if (ControllerView.get_controller_type_str(base_key) != "HolonomicBaseJointController"
                or ControllerView.get_motor_type(base_key) != "velocity"
                or len(self.base_indices) != 3):
            raise RuntimeError("BEHAVIOR yaw requires its native velocity base controller.")
        if (ControllerView.get_controller_type_str(trunk_key) != "JointController"
                or ControllerView.get_motor_type(trunk_key) != "position"
                or ControllerView.get_use_delta_commands(trunk_key)
                or len(self.trunk_indices) != 4):
            raise RuntimeError("BEHAVIOR pitch requires its native absolute trunk controller.")
        self.trunk_dofs = ControllerView.get_dof_idx(trunk_key)
        self.sensor = self.robot.sensors["robot_r1:zed_link:Camera:0"]
        if self.robot.trunk_joint_names != ["torso_joint1", "torso_joint2", "torso_joint3", "torso_joint4"]:
            raise RuntimeError("BEHAVIOR pitch requires the R1Pro native torso joint order.")
        pitch_joint = self.robot.joints["torso_joint3"]
        if not pitch_joint.driven or not pitch_joint.is_single_dof or pitch_joint.dof_indices != [int(self.trunk_dofs[2])]:
            raise RuntimeError("BEHAVIOR pitch requires the driven R1Pro torso_joint3.")
        self.pitch_index = int(self.trunk_indices[2])
        self.pitch_dof = int(self.trunk_dofs[2])
        self.pitch_limits = environment._action_spec["channels"][self.pitch_index]
        self.hold = torch.zeros(self.robot.action_dim, dtype=torch.float32)
        covered = set()
        for name, (group_key, controller_index) in self.robot.controllers.items():
            indices = self.robot.controller_action_idx[name]
            command = ControllerView.compute_no_op_action(group_key, controller_index)
            if command.numel() != len(indices):
                raise RuntimeError("BEHAVIOR hold command differs from its native controller dimension.")
            self.hold[indices] = command
            covered.update(int(index) for index in indices)
        if covered != set(range(self.robot.action_dim)) or not torch.isfinite(self.hold).all():
            raise RuntimeError("BEHAVIOR hold must cover all native action channels.")

    def pose(self):
        position, quaternion = self.robot.get_position_orientation()
        yaw = float(T.z_angle_from_quat(quaternion))
        _, camera_quaternion = self.sensor.get_position_orientation()
        axis = T.quat2mat(camera_quaternion) @ torch.tensor([0.0, 0.0, -1.0], device=camera_quaternion.device)
        pitch = math.asin(max(-1.0, min(1.0, float(axis[2]))))
        return tuple(float(value) for value in position), yaw, pitch

    def run(self, yaw_deg: float, pitch_deg: float, should_stop: Callable[[], bool]) -> NativeRotation:
        if any(not math.isfinite(value) for value in (yaw_deg, pitch_deg)) or abs(yaw_deg) > 90 or abs(pitch_deg) > 45:
            raise ValueError("BEHAVIOR rotation requires finite yaw within 90 and pitch within 45 degrees.")
        before_position, before_yaw, before_pitch = self.pose()
        target_yaw = wrapped(before_yaw + math.radians(yaw_deg))
        target_pitch = before_pitch + math.radians(pitch_deg)
        started = time.monotonic()
        control_steps = 0
        raw_steps = 0
        stop_reason = "completed"
        best_error = math.inf
        stalled = 0
        action = self.hold.clone()

        def advance(command) -> None:
            nonlocal control_steps, raw_steps
            if command.numel() != self.robot.action_dim or not torch.isfinite(command).all():
                raise RuntimeError("BEHAVIOR rotation produced an invalid native control.")
            for value, channel in zip(command, self.environment._action_spec["channels"], strict=True):
                if not channel["minimum"] <= float(value) <= channel["maximum"]:
                    raise RuntimeError("BEHAVIOR rotation exceeded a native action channel limit.")
            before = int(self.environment._og.sim.current_time_step_index)
            _, _, terminated, truncated, _ = self.env.step({"robot_r1": command}, n_render_iterations=1)
            consumed = int(self.environment._og.sim.current_time_step_index) - before
            if consumed != 4:
                raise RuntimeError("BEHAVIOR rotation must consume exactly four native physics steps per control.")
            control_steps += 1
            raw_steps += consumed
            self.environment._controlled_physics_steps += consumed
            self.environment._episode_terminated = bool(terminated or truncated)

        while True:
            _, yaw, pitch = self.pose()
            yaw_error = wrapped(target_yaw - yaw)
            pitch_error = target_pitch - pitch
            error = max(abs(yaw_error), abs(pitch_error))
            if should_stop():
                stop_reason = "cancelled"
                break
            if self.environment._episode_terminated:
                stop_reason = "episode_terminated"
                break
            if control_steps >= MAX_CONTROL_STEPS - 3:
                stop_reason = "budget_exhausted"
                break
            if time.monotonic() - started >= MAX_DURATION_S:
                stop_reason = "budget_exhausted"
                break
            if error <= ANGLE_TOLERANCE:
                break
            if error < best_error - 1e-4:
                best_error, stalled = error, 0
            else:
                stalled += 1
                if stalled >= 30:
                    stop_reason = "stalled"
                    break
            action = self.hold.clone()
            action[int(self.base_indices[-1])] = max(-0.3, min(0.3, 1.5 * yaw_error)) if abs(yaw_error) > ANGLE_TOLERANCE else 0.0
            if abs(pitch_error) > ANGLE_TOLERANCE:
                current_joint = float(self.robot.get_joint_positions()[self.pitch_dof])
                target_joint = current_joint + max(-0.025, min(0.025, 0.8 * pitch_error))
                action[self.pitch_index] = max(self.pitch_limits["minimum"], min(self.pitch_limits["maximum"], target_joint))
            elif pitch_deg != 0:
                action[self.pitch_index] = self.robot.get_joint_positions()[self.pitch_dof]
            advance(action)
        if control_steps and not self.environment._episode_terminated:
            action = self.hold.clone()
            if pitch_deg != 0:
                action[self.pitch_index] = self.robot.get_joint_positions()[self.pitch_dof]
            for _ in range(3):
                advance(action)
                if self.environment._episode_terminated:
                    break
        after_position, after_yaw, after_pitch = self.pose()
        if stop_reason == "completed" and max(abs(wrapped(target_yaw - after_yaw)), abs(target_pitch - after_pitch)) > ANGLE_TOLERANCE:
            stop_reason = "stalled"
        self.environment._last_control_duration_s = time.monotonic() - started
        return NativeRotation(
            self.environment.observe(), yaw_deg, pitch_deg,
            math.degrees(wrapped(after_yaw - before_yaw)), math.degrees(after_pitch - before_pitch),
            math.degrees(before_yaw), math.degrees(after_yaw), math.degrees(before_pitch), math.degrees(after_pitch),
            before_position, after_position, control_steps, raw_steps, stop_reason,
        )
