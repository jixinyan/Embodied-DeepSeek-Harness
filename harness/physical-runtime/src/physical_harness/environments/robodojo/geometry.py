import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation


def array(value):
    if hasattr(value, "detach"):
        value = value.detach().cpu().numpy()
    return np.asarray(value, dtype=float)


def transform(position, quaternion_wxyz):
    position, quaternion = array(position), array(quaternion_wxyz)
    if (position.shape != (3,) or quaternion.shape != (4,)
            or not np.isfinite(np.r_[position, quaternion]).all()
            or abs(np.linalg.norm(quaternion) - 1) > 1e-4):
        raise ValueError("A finite position and unit wxyz quaternion are required.")
    result = np.eye(4)
    result[:3, :3] = Rotation.from_quat(quaternion[[1, 2, 3, 0]]).as_matrix()
    result[:3, 3] = position
    return result


def pose(matrix):
    quaternion = Rotation.from_matrix(matrix[:3, :3]).as_quat()
    return {"position": matrix[:3, 3].tolist(),
            "quaternion_wxyz": quaternion[[3, 0, 1, 2]].tolist()}


def pose7(value):
    value = array(value)
    if value.shape != (7,):
        raise ValueError("A seven-value xyz/wxyz pose is required.")
    return transform(value[:3], value[3:])


def organized_cloud(depth, intrinsics, world_from_camera_usd):
    depth, intrinsics, extrinsic = array(depth), array(intrinsics), array(world_from_camera_usd)
    if depth.ndim == 3 and depth.shape[-1] == 1:
        depth = depth[..., 0]
    if depth.ndim != 2 or intrinsics.shape != (3, 3) or extrinsic.shape != (4, 4):
        raise ValueError("HxW depth, 3x3 intrinsics and a 4x4 optical pose are required.")
    if (not np.isfinite(intrinsics).all() or intrinsics[0, 0] <= 0 or intrinsics[1, 1] <= 0
            or np.allclose(intrinsics, np.eye(3)) or not np.isfinite(extrinsic).all()):
        raise ValueError("Camera calibration is invalid.")
    y, x = np.indices(depth.shape)
    rays = np.stack((x, y, np.ones_like(x)), axis=-1) @ np.linalg.inv(intrinsics).T
    points = rays * np.where(np.isfinite(depth) & (depth > 0), depth, np.nan)[..., None]
    points *= [1, -1, -1]
    return points @ extrinsic[:3, :3].T + extrinsic[:3, 3]


def ground_pixel(cloud, x, y, world_from_env):
    height, width, _ = cloud.shape
    if type(x) is not int or type(y) is not int or not (0 <= x < width and 0 <= y < height):
        raise ValueError(f"An integer pixel within {width}x{height} is required.")
    point = cloud[y, x]
    if not np.isfinite(point).all():
        raise ValueError("The selected pixel has no valid metric depth.")
    return (np.linalg.inv(world_from_env) @ np.r_[point, 1])[:3]


def pose_error(actual, target):
    return (float(np.linalg.norm(actual[:3, 3] - target[:3, 3])),
            float(Rotation.from_matrix(target[:3, :3] @ actual[:3, :3].T).magnitude()))


def solve_ik(fk, joints, limits, target):
    limits, joints = array(limits), array(joints)

    def residual(qpos):
        actual = fk.matrix(qpos)
        rotation = Rotation.from_matrix(target[:3, :3] @ actual[:3, :3].T).as_rotvec()
        return np.r_[target[:3, 3] - actual[:3, 3], 0.2 * rotation]

    seed = np.clip(joints, limits[:, 0], limits[:, 1])
    seed[np.abs(seed) < 1e-8] = 0
    seed = np.clip(seed, limits[:, 0], limits[:, 1])
    result = least_squares(residual, seed, bounds=(limits[:, 0], limits[:, 1]),
                           max_nfev=200, ftol=1e-10, xtol=1e-10, gtol=1e-10)
    distance, angle = pose_error(fk.matrix(result.x), target)
    if distance > 0.005 or angle > 0.03:
        raise ValueError(f"Unreachable IK target: {distance:.4f} m, {angle:.4f} rad.")
    return result.x
