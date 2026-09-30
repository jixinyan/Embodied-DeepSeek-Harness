import numpy as np
from yourdfpy import URDF

from .geometry import array, pose, pose_error, transform


class ArmFK:
    def __init__(self, urdf, joint_names, base, tip):
        self.names = list(joint_names)
        self.base, self.tip = base, tip
        self.robot = URDF.load(urdf, load_meshes=False, build_scene_graph=True)
        if len(self.names) != 6 or any(name not in self.robot.joint_map for name in self.names):
            raise ValueError("The native robot must declare six known arm joints.")

    def matrix(self, joints):
        joints = array(joints)
        if joints.shape != (6,) or not np.isfinite(joints).all():
            raise ValueError("Six finite arm joint angles are required.")
        self.robot.update_cfg(dict(zip(self.names, joints)))
        return self.robot.get_transform(self.tip, self.base).copy()


class DualKinematics:
    def __init__(self, env):
        self.manager = env.robot_manager
        self.robots = {robot.arm_name.split("_")[0]: robot
                       for robot in self.manager.robot_list if robot.type == "target"}
        if set(self.robots) != {"left", "right"}:
            raise ValueError("The RoboDojo adapter requires left and right target arms.")
        self.fk = {arm: ArmFK(robot.urdf_path, robot.arm_joints_name,
                              robot.base_link, robot.ee_link_name)
                   for arm, robot in self.robots.items()}

    def root(self, arm):
        robot = self.robots[arm]
        value = array(self.manager.get_link_pose(robot, robot.base_link, is_relative=True)[0])
        return transform(value[:3], value[3:])

    def check(self):
        checks = {}
        for arm, robot in self.robots.items():
            joints = array(self.manager.get_joint(robot)[0])
            predicted = self.root(arm) @ self.fk[arm].matrix(joints)
            measured = array(self.manager.get_real_endpose(robot)[0])
            distance, angle = pose_error(predicted, transform(measured[:3], measured[3:]))
            checks[arm] = {"position_error_m": distance, "rotation_error_rad": angle,
                           "passed": distance < 0.002 and angle < 0.01}
        if not all(check["passed"] for check in checks.values()):
            raise ValueError(f"URDF FK differs from the measured native EEF: {checks}.")
        return {"arms": checks, "passed": True, "physical_steps": 0}

    def preview(self, actions):
        actions = array(actions)
        if actions.shape != (50, 14) or not np.isfinite(actions).all():
            raise ValueError("FK preview requires a finite 50x14 proposal.")
        checks = self.check()
        roots = {arm: self.root(arm) for arm in self.robots}
        trajectory = [
            {"index": index, **{
                arm: {**pose(roots[arm] @ self.fk[arm].matrix(row[offset:offset + 6])),
                      "gripper_closed": bool(row[offset + 6] < 0.5),
                      "gripper_opening": float(row[offset + 6])}
                for arm, offset in (("left", 0), ("right", 7))}}
            for index, row in enumerate(actions)]
        return {"trajectory": trajectory, "measured_fk_check": checks, "physical_steps": 0,
                "frame": "environment_origin", "interpretation": "kinematic_targets_not_object_future"}
