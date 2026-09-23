import argparse
import json
import os
from importlib.metadata import version
from pathlib import Path

import mujoco
import numpy as np
from OpenGL import GL
from PIL import Image


def renderer_check(output: Path) -> dict:
    model = mujoco.MjModel.from_xml_string(
        '<mujoco><worldbody><light pos="0 0 3"/>'
        '<geom type="plane" size="2 2 .1" rgba=".2 .3 .4 1"/>'
        '<body pos="0 0 1"><freejoint/>'
        '<geom type="box" size=".1 .1 .1" mass="1" rgba=".1 .4 .9 1"/>'
        '</body></worldbody></mujoco>'
    )
    data = mujoco.MjData(model)
    initial_height = float(data.qpos[2])
    for _ in range(100):
        mujoco.mj_step(model, data)
    if not float(data.qpos[2]) < initial_height:
        raise RuntimeError("MuJoCo did not advance the falling body's state.")
    with mujoco.Renderer(model, height=256, width=256) as renderer:
        renderer.update_scene(data)
        pixels = renderer.render()
        if pixels.shape != (256, 256, 3) or pixels.dtype != np.uint8 or pixels.std() == 0:
            raise RuntimeError("MuJoCo did not return a nonuniform RGB frame.")
        driver = {
            "vendor": GL.glGetString(GL.GL_VENDOR).decode(),
            "renderer": GL.glGetString(GL.GL_RENDERER).decode(),
            "version": GL.glGetString(GL.GL_VERSION).decode(),
        }
        if "NVIDIA" not in driver["vendor"]:
            raise RuntimeError("The selected renderer does not report NVIDIA GPU execution.")
        Image.fromarray(pixels).save(output / "renderer.png")
    return {
        "physics_steps": 100,
        "initial_height": initial_height,
        "final_height": float(data.qpos[2]),
        "frame": "renderer.png",
        "driver": driver,
    }


def environment_check(output: Path, name: str, seed: int) -> dict:
    from robocasa.utils.env_utils import create_env
    from robosuite import macros

    cameras = ["robot0_agentview_left", "robot0_agentview_right", "robot0_eye_in_hand"]
    env = create_env(
        env_name=name,
        robots="PandaOmron",
        split="pretrain",
        seed=seed,
        camera_names=cameras,
        camera_widths=256,
        camera_heights=256,
        render_onscreen=False,
    )
    try:
        observation = env.reset()
        frames = []
        for camera in cameras:
            pixels = observation[f"{camera}_image"]
            if pixels.shape != (256, 256, 3) or pixels.dtype != np.uint8 or pixels.std() == 0:
                raise RuntimeError(f"Camera {camera} did not return a nonuniform RGB frame.")
            if macros.IMAGE_CONVENTION == "opengl":
                pixels = pixels[::-1]
            elif macros.IMAGE_CONVENTION != "opencv":
                raise RuntimeError("Unsupported robosuite image convention.")
            filename = f"{camera}.png"
            Image.fromarray(pixels).save(output / filename)
            frames.append(filename)
        low, high = env.action_spec
        return {
            "environment": name,
            "robot": "PandaOmron",
            "seed": seed,
            "frames": frames,
            "instruction": env.get_ep_meta()["lang"],
            "initial_success": bool(env._check_success()),
            "action_dimension": env.action_dim,
            "action_low": low.tolist(),
            "action_high": high.tolist(),
            "controller": env.robots[0].composite_controller.get_action_info_dict(),
            "control_frequency_hz": env.control_freq,
            "policy_executed": False,
        }
    finally:
        env.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Check actual GPU rendering and RoboCasa reset.")
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--renderer-only", action="store_true")
    parser.add_argument("--environment", default="OpenCabinet")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if os.environ.get("MUJOCO_GL") != "egl":
        raise RuntimeError("Run this GPU check with MUJOCO_GL=egl.")
    output = args.output_directory.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {
        "packages": {
            name: version(name)
            for name in ["robocasa", "robosuite", "mujoco", "numpy", "edh-physical-harness"]
        },
        "renderer": renderer_check(output),
    }
    if not args.renderer_only:
        report["environment"] = environment_check(output, args.environment, args.seed)
    document = json.dumps(report, indent=2, allow_nan=False)
    (output / "result.json").write_text(document + "\n", encoding="utf-8")
    print(document)


if __name__ == "__main__":
    main()
