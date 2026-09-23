import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import imageio.v3 as iio
import numpy as np
import sapien


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--gpu-index", required=True, type=int)
    args = parser.parse_args()
    if args.gpu_index < 0:
        raise ValueError("GPU index must be nonnegative.")
    args.output_directory.mkdir(parents=True, exist_ok=True)

    sapien.render.set_camera_shader_dir("rt")
    device = sapien.Device(f"cuda:{args.gpu_index}")
    scene = sapien.Scene([
        sapien.physx.PhysxCpuSystem(),
        sapien.render.RenderSystem(device),
    ])
    scene.set_timestep(1 / 250)
    scene.add_ground(0)
    scene.set_ambient_light([0.3, 0.3, 0.3])
    scene.add_directional_light([0, 0, -1], [1, 1, 1])
    actor_builder = scene.create_actor_builder()
    actor_builder.add_box_collision(half_size=[0.1, 0.1, 0.1])
    actor_builder.add_box_visual(half_size=[0.1, 0.1, 0.1], material=[0.8, 0.2, 0.2])
    actor = actor_builder.build(name="render_check_box")
    actor.set_pose(sapien.Pose([0, 0, 0.5]))
    camera = scene.add_camera(name="check_camera", width=256, height=256, fovy=np.deg2rad(45), near=0.1, far=10)
    camera.entity.set_pose(sapien.Pose([1, 0, 1], [0.5, 0.5, 0.5, 0.5]))
    for _ in range(100):
        scene.step()
    scene.update_render()
    camera.take_picture()
    color = camera.get_picture("Color")
    if color.shape != (256, 256, 4) or not np.isfinite(color).all():
        raise RuntimeError("SAPIEN returned an invalid camera frame.")
    rgb = np.clip(color[:, :, :3] * 255, 0, 255).astype(np.uint8)
    if np.unique(rgb.reshape(-1, 3), axis=0).shape[0] < 2:
        raise RuntimeError("SAPIEN renderer check returned a uniform image.")
    iio.imwrite(args.output_directory / "render.png", rgb)
    result = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "sapien_version": sapien.__version__,
        "gpu_index": args.gpu_index,
        "device_name": device.name,
        "device_pci_string": device.pci_string,
        "device_cuda_id": device.cuda_id,
        "camera_shape": list(rgb.shape),
        "unique_colors": int(np.unique(rgb.reshape(-1, 3), axis=0).shape[0]),
        "physics_steps": 100,
        "actor_height": float(actor.get_pose().p[2]),
    }
    (args.output_directory / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
