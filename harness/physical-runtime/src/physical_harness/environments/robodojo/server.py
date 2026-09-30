import argparse
import ctypes
import importlib
import json
from pathlib import Path
import socket
import struct
import traceback
import zlib

import msgpack

from . import _MAX_BYTES, _VERSION, _decode_array, _encode_array, _read_exact


class ExternalPolicyConnection:
    def __init__(self, **configuration):
        pass

    def call(self, func_name, **arguments):
        if func_name != "reset":
            raise RuntimeError("Policy inference is owned by the EDH execution service.")

    def close(self):
        pass


def serve(session, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("127.0.0.1", port))
        listener.listen(1)
        print(json.dumps({"event": "ready", "port": port, "metadata": session.metadata}), flush=True)
        connection, _ = listener.accept()
        with connection:
            connection.settimeout(900)
            connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            while True:
                try:
                    header = _read_exact(connection, 4)
                except EOFError:
                    session._write_summary("controller_disconnect")
                    return
                length = struct.unpack("!I", header)[0]
                if not 0 < length <= _MAX_BYTES:
                    raise ValueError("Invalid native RPC packet length.")
                decoder = zlib.decompressobj()
                raw = decoder.decompress(_read_exact(connection, length), _MAX_BYTES + 1)
                if len(raw) > _MAX_BYTES or not decoder.eof or decoder.unused_data:
                    raise ValueError("Invalid compressed native RPC packet.")
                request = msgpack.unpackb(raw, raw=False, ext_hook=_decode_array)
                if (not isinstance(request, dict) or request.get("version") != _VERSION
                        or not isinstance(request.get("request_id"), str)
                        or not isinstance(request.get("args"), dict)):
                    raise ValueError("Invalid native RPC request envelope.")
                try:
                    result = session.dispatch(request["op"], request["args"])
                except BaseException:
                    session.poisoned = True
                    raise
                response = msgpack.packb({"version": _VERSION, "request_id": request["request_id"],
                                          "ok": True, "result": result}, default=_encode_array, use_bin_type=True)
                if len(response) > _MAX_BYTES:
                    raise ValueError("The native RPC response exceeds its byte limit.")
                payload = zlib.compress(response, level=1)
                connection.sendall(struct.pack("!I", len(payload)) + payload)


def main():
    parser = argparse.ArgumentParser(description="EDH-owned RoboDojo simulator and numerical tool service.")
    parser.add_argument("--task", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--eval-seed", type=int, default=0)
    parser.add_argument("--nvrtc-library", type=Path)
    preliminary, _ = parser.parse_known_args()
    if preliminary.nvrtc_library:
        compiler_library = ctypes.CDLL(str(preliminary.nvrtc_library.resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import cv2
    from isaaclab.app import AppLauncher

    AppLauncher.add_app_launcher_args(parser)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or args.output.exists():
        raise ValueError("Use a valid port and a fresh output directory.")
    args.headless, args.enable_cameras = True, True
    from env.global_configs import ROOT_DIR, BENCHMARK
    import yaml

    registry = importlib.import_module(f"task.{BENCHMARK}.task_registry")
    task_path = registry.task_config_path(str(Path(ROOT_DIR) / "task" / BENCHMARK / "config"), args.task)
    task_values = yaml.safe_load(Path(task_path).read_text())
    enable_monitor = bool(task_values.get("Articulation"))
    if enable_monitor:
        from src.eval_client.physx_warning_monitor import get_monitor

        get_monitor().start(enabled=True)
    app = AppLauncher(args).app
    env = session = None
    try:
        import torch
        from cuda.bindings import nvrtc
        from omegaconf import OmegaConf, open_dict
        from env.global_configs import ENV_CONFIG_PATH
        from utils.load_file import load_yaml
        from utils.pipeline_utils import process_config, process_randomization
        from src.eval_client import eval_env
        from .session import CAMERA_ALIASES, RoboDojoSession, write_json

        status, architectures = nvrtc.nvrtcGetSupportedArchs()
        major, minor = torch.cuda.get_device_capability()
        if int(status) != 0 or major * 10 + minor not in architectures:
            raise RuntimeError("The installed NVRTC compiler does not support the selected GPU.")
        root = Path(ENV_CONFIG_PATH)
        evaluation = load_yaml(str(root / "arx_x5.yml"))
        evaluation.update(task_name=args.task, num_envs=1, device_id=torch.cuda.current_device(),
                          eval_batch=False, policy_name="Pi_05", additional_info="edh",
                          seed=args.eval_seed, physx_monitor_enabled=enable_monitor)
        values = {key: load_yaml(str(root / key / (evaluation["config"][key] + ".yml")))
                  for key in ("sim", "scene", "camera", "robot")}
        values.update(eval_cfg=evaluation, deploy_cfg={"port": 1, "policy_name": "Pi_05"}, task_env=task_values)
        cfg = OmegaConf.create(values)
        cfg.sim.scene.num_envs = 1
        cfg = process_randomization(cfg)
        cfg, _ = process_config(cfg, task_name=args.task)
        with open_dict(cfg):
            cfg.eval_cfg.observation.vision.depth = True
            cfg.eval_cfg.observation.vision.approximate_depth = False
            for camera, aliases in CAMERA_ALIASES.items():
                names = [name for name in aliases if name in cfg.camera]
                if not names and camera in ("cam_left_wrist", "cam_right_wrist"):
                    names = [camera]
                if len(names) != 1:
                    raise ValueError(f"Expected exactly one configured native {camera}.")
                name = names[0]
                annotator = cfg.camera.annotator.get(name, cfg.camera.annotator.get("common"))
                if annotator is None:
                    raise ValueError(f"Missing native {camera} annotator.")
                capture = OmegaConf.to_container(annotator, resolve=True)
                capture.update(enabled=True, distance_to_image_plane_capture={"type": "distance_to_image_plane", "device": "cpu"})
                cfg.camera.annotator[name] = capture
            cfg.eval_cfg.eval_num = 1
            cfg.camera.default_frequency = cfg.eval_cfg.observation.collect_freq
            cfg.sim.seed = [0]
        for robot in cfg.robot.robots:
            robot.need_planner = robot.get("type", "target") != "target"
        original = eval_env.WsModelClient
        try:
            eval_env.WsModelClient = ExternalPolicyConnection
            env = eval_env.create_eval_env(cfg, app)
        finally:
            eval_env.WsModelClient = original
        session = RoboDojoSession(env, args.output, args.task)
        write_json(args.output / "resolved_config.json", OmegaConf.to_container(cfg, resolve=True))
        write_json(args.output / "runtime.json", {
            "service": __file__, "simulator_source": str(Path(ROOT_DIR).resolve()),
            "gpu": torch.cuda.get_device_name(), "gpu_capability": [major, minor],
            "nvrtc_architectures": list(architectures), "opencv": cv2.__version__,
            "native_task": args.task, "native_step_limit": session.metadata["max_episode_steps"]})
        serve(session, args.port)
    except BaseException:
        traceback.print_exc()
        raise
    finally:
        if session is not None:
            session._write_summary("server_close")
        if env is not None:
            env.close()
        app.close()


if __name__ == "__main__":
    main()
