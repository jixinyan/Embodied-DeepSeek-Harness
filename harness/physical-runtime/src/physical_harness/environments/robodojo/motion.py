from copy import deepcopy

import numpy as np

from .geometry import array, pose, pose7, pose_error, solve_ik


class NumericalMotion:
    def __init__(self, kinematics, control_dt):
        self.kinematics, self.control_dt = kinematics, float(control_dt)
        self.plan = None

    def joint_state(self):
        result = {}
        manager = self.kinematics.manager
        for arm, robot in self.kinematics.robots.items():
            data = manager.robot_key[manager.robot_list.index(robot)].data
            indices = robot.arm_joint_indices
            limits = array(data.soft_joint_pos_limits[0, indices])
            velocity = array(data.soft_joint_vel_limits[0, indices])
            joints = array(manager.get_joint(robot)[0])
            if (joints.shape != (6,) or limits.shape != (6, 2) or velocity.shape != (6,)
                    or not np.isfinite(np.r_[joints, limits.ravel(), velocity]).all()
                    or np.any(limits[:, 0] >= limits[:, 1]) or np.any(velocity <= 0)):
                raise ValueError(f"Invalid native {arm} joint state or limits.")
            result[arm] = {"qpos": joints.tolist(), "joint_names": list(robot.arm_joints_name),
                           "position_limits_rad": limits.tolist(),
                           "velocity_limits_rad_s": velocity.tolist(),
                           "gripper_opening": None, "units": "rad"}
        return result

    def prepare(self, targets, step_id):
        return self._prepare(targets, step_id, "eef")

    def prepare_joints(self, targets, coordinate_mode, step_id):
        return self._prepare(targets, step_id, "joint", coordinate_mode)

    def _prepare(self, targets, step_id, mode, coordinate_mode=None):
        self.plan = None
        if not isinstance(targets, dict) or set(targets) != {"left", "right"}:
            raise ValueError("Explicit left/right targets are required.")
        if mode == "joint" and coordinate_mode not in ("absolute", "delta"):
            raise ValueError("Joint coordinate_mode must be absolute or delta.")
        state = self.joint_state()
        joints, poses = {}, {}
        for arm in self.kinematics.robots:
            target = targets[arm]
            if type(target["gripper_closed"]) is not bool:
                raise ValueError("An explicit boolean gripper state is required.")
            current, limits = array(state[arm]["qpos"]), array(state[arm]["position_limits_rad"])
            root, fk = self.kinematics.root(arm), self.kinematics.fk[arm]
            if mode == "eef":
                goal = pose7(np.r_[array(target["position"]), array(target["quaternion_wxyz"])])
                measured = pose7(self.kinematics.manager.get_real_endpose(self.kinematics.robots[arm])[0])
                distance, angle = pose_error(measured, goal)
                solution = current.copy() if distance <= 1e-6 and angle <= 1e-6 else solve_ik(
                    fk, current, limits, np.linalg.inv(root) @ goal)
            else:
                value = array(target["qpos"])
                if value.shape != (6,) or not np.isfinite(value).all():
                    raise ValueError("Joint targets must contain six finite radians.")
                solution = current + value if coordinate_mode == "delta" else value
            if np.any(solution < limits[:, 0] - 1e-7) or np.any(solution > limits[:, 1] + 1e-7):
                raise ValueError(f"The {arm} target exceeds native joint limits.")
            joints[arm] = solution.copy()
            poses[arm] = {**pose(root @ fk.matrix(solution)), "gripper_closed": target["gripper_closed"]}
        self.plan = {"targets": deepcopy(targets), "joints": joints, "start_step": step_id, "mode": mode}
        return {"ok": True, "physical_steps": 0,
                "planner": "numerical_ik" if mode == "eef" else "direct_joint",
                "frame": "environment_origin", "joint_targets": {arm: value.tolist() for arm, value in joints.items()},
                "target_eef": poses, "collision_checked": False,
                "note": "Robot FK endpoints; trajectory collision checks are not provided."}

    def target(self, targets, step_id):
        if self.plan is None or targets != self.plan["targets"] or step_id < self.plan["start_step"]:
            raise ValueError("The current targets require successful preparation.")
        state = self.joint_state()
        action, diagnostics = [], {}
        for arm in self.kinematics.robots:
            current = array(state[arm]["qpos"])
            delta = self.plan["joints"][arm] - current
            bounds = array(state[arm]["velocity_limits_rad_s"]) * self.control_dt
            fraction = min(1.0, 1.0 / max(float(np.max(np.abs(delta) / bounds)), 1.0))
            action.extend([*(current + fraction * delta).tolist(), float(not targets[arm]["gripper_closed"])])
            diagnostics[arm] = {
                "method": "numerical_ik_joint_tracking" if self.plan["mode"] == "eef" else "direct_joint_tracking",
                "target_qpos": self.plan["joints"][arm].tolist(), "measured_qpos": current.tolist(),
                "max_joint_error_rad": float(np.max(np.abs(delta))),
                "physical_tracking_verified": False, "collision_checked": False}
        return {"action": action, "diagnostics": diagnostics, "physical_steps": 0}
