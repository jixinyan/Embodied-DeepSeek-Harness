import argparse
import ctypes
import json
import os
import signal
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Start the EDH RoboDojo service with explicit deployment paths.")
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    config = json.loads(args.configuration.read_text())
    required = {"python", "sdk", "data", "output", "task", "port", "gpu", "workspace"}
    allowed = required | {"nvrtcLibrary", "graphicsLibraryDirectory", "kitArguments", "evalSeed"}
    if required - config.keys() or config.keys() - allowed:
        raise ValueError("RoboDojo deployment has missing or unknown fields.")
    root = Path(config["workspace"]).resolve(strict=True)
    python, sdk, data = (Path(config[name]).resolve(strict=True) for name in ("python", "sdk", "data"))
    output = (args.output or Path(config["output"])).resolve()
    if output.exists() or (sdk / "Assets").resolve(strict=True) != data / "Assets":
        raise ValueError("Use a fresh output directory and SDK assets bound to the configured data directory.")
    source = root / "harness/physical-runtime/src"
    scratch = root / ".local/work/robodojo-runtime" / output.name
    scratch.mkdir(parents=True, exist_ok=False)
    cache = root / ".local/cache/robodojo"
    cache.mkdir(parents=True, exist_ok=True)
    search = [source, sdk, sdk / "XPolicyLab", sdk / "third_party/IsaacLab/source/isaaclab",
              sdk / "third_party/curobo"]
    environment = dict(os.environ, PATH=str(python.parent) + os.pathsep + os.environ["PATH"],
                       CONDA_PREFIX=str(python.parent.parent), PYTHONPATH=os.pathsep.join(map(str, search)),
                       PYTHONNOUSERSITE="1", PYTHONDONTWRITEBYTECODE="1", PYTHONUNBUFFERED="1",
                       CUDA_VISIBLE_DEVICES=str(config["gpu"]), ROBODOJO_DATA_ROOT=str(data),
                       TMPDIR=str(scratch), TMP=str(scratch), TEMP=str(scratch),
                       XDG_RUNTIME_DIR=str(scratch / "xdg"), XDG_CACHE_HOME=str(cache),
                       TORCH_EXTENSIONS_DIR=str(cache / "torch_extensions"),
                       CUDA_CACHE_PATH=str(cache / "cuda"), WARP_CACHE_PATH=str(cache / "warp"),
                       OMNI_KIT_ACCEPT_EULA="Y")
    (scratch / "xdg").mkdir(mode=0o700)
    if config.get("graphicsLibraryDirectory"):
        graphics = Path(config["graphicsLibraryDirectory"]).resolve(strict=True)
        environment["LD_LIBRARY_PATH"] = str(graphics) + os.pathsep + environment.get("LD_LIBRARY_PATH", "")
    command = [str(python), "-m", "physical_harness.environments.robodojo.server",
               "--task", config["task"], "--port", str(config["port"]), "--output", str(output),
               "--eval-seed", str(config.get("evalSeed", 0)), "--device", "cuda:0", "--headless"]
    if config.get("nvrtcLibrary"):
        command.extend(["--nvrtc-library", str(Path(config["nvrtcLibrary"]).resolve(strict=True))])
    if config.get("kitArguments"):
        command.extend(["--kit_args", config["kitArguments"]])
    if sys.platform == "linux":
        parent = os.getppid()
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(1, signal.SIGTERM, 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "Cannot bind native service lifetime to its owner.")
        if os.getppid() != parent:
            raise RuntimeError("The native service owner exited during startup.")
    os.chdir(sdk)
    os.execve(python, command, environment)


if __name__ == "__main__":
    main()
