import argparse
import os
from pathlib import Path
import subprocess


def run(arguments, environment):
    subprocess.run([str(value) for value in arguments], env=environment, check=True)


def main():
    parser = argparse.ArgumentParser(description="Provision independent pinned RoboDojo dependencies for EDH.")
    parser.add_argument("--conda", type=Path, required=True)
    parser.add_argument("--environment-source", type=Path, required=True)
    parser.add_argument("--sdk-source", type=Path, required=True)
    parser.add_argument("--asset-source", type=Path, required=True)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--nvrtc-source", type=Path, required=True)
    parser.add_argument("--graphics-source", type=Path, required=True)
    parser.add_argument("--stage", choices=("source", "environment", "assets"), required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    local = root / ".local"
    scratch = local / "work" / "robodojo-provision"
    scratch.mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ, TMPDIR=str(scratch), TMP=str(scratch), TEMP=str(scratch),
                       CONDA_PKGS_DIRS=str(local / "cache" / "conda"),
                       PIP_CACHE_DIR=str(local / "cache" / "pip"), PYTHONNOUSERSITE="1")
    sdk, prefix = local / "deps" / "robodojo", local / "envs" / "robodojo-sim"
    if args.stage == "source":
        sources = [
            (args.sdk_source, sdk, "https://github.com/RoboDojo-Benchmark/RoboDojo.git",
             "726e9aabfaa642203722eb126f5eaf0f37f3e1ad"),
            (args.sdk_source / "third_party/IsaacLab", sdk / "third_party/IsaacLab",
             "https://github.com/yuechen0614/IsaacLab.git", "afca7b09d60d8beb9c1cb28b43066499940b969b"),
            (args.sdk_source / "third_party/curobo", sdk / "third_party/curobo",
             "https://github.com/yuechen0614/curobo.git", "d17b54ce32cba095c0b000c4c58777075d11de0e"),
            (args.sdk_source / "XPolicyLab", sdk / "XPolicyLab",
             "https://github.com/XPolicyLab/XPolicyLab.git", "bb9a0b5f5136a74503b679af830bfd0a3a837d5c"),
        ]
        for source, destination, url, revision in sources:
            if destination.exists():
                if (destination / ".git").is_dir():
                    installed = subprocess.check_output(
                        ["git", "-C", str(destination), "rev-parse", "HEAD"], text=True).strip()
                    if installed != revision or (destination / ".git/objects/info/alternates").exists():
                        raise ValueError(f"Existing SDK is not independent at the required revision: {destination}")
                    run(["git", "-C", destination, "remote", "set-url", "origin", url], environment)
                    continue
                if destination != sdk and destination.is_dir() and not any(destination.iterdir()):
                    destination.rmdir()
                else:
                    raise FileExistsError(destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            actual = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
            if actual != revision:
                raise ValueError(f"Unexpected SDK revision: {source}: {actual}")
            run(["git", "clone", "--no-hardlinks", "--no-local", source, destination], environment)
            run(["git", "-C", destination, "remote", "set-url", "origin", url], environment)
        libraries = local / "deps" / "graphics"
        run(["cp", "-a", args.graphics_source, libraries], environment)
        compiler = local / "deps" / "nvrtc"
        run(["cp", "-a", args.nvrtc_source, compiler], environment)
    elif args.stage == "assets":
        destination = args.data_root.resolve() / "Assets"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() or (sdk / "Assets").exists():
            raise FileExistsError("RoboDojo asset destination already exists.")
        run(["cp", "-a", args.asset_source, destination], environment)
        run(["diff", "--brief", "--recursive", args.asset_source, destination], environment)
        (sdk / "Assets").symlink_to(destination, target_is_directory=True)
    else:
        if (prefix / "conda-meta/history").exists():
            raise FileExistsError("An initialized native environment already exists.")
        specification = subprocess.check_output(
            [str(args.conda), "list", "--explicit", "--prefix", str(args.environment_source)],
            env=environment, text=True)
        specification_path = scratch / "native-environment-explicit.txt"
        specification_path.write_text(specification)
        run([args.conda, "create", "--yes", "--prefix", prefix, "--file", specification_path], environment)
        run(["rsync", "-a", "--exclude=__editable__*", "--exclude=isaacsim/kit/data/",
             "--exclude=isaacsim/kit/logs/", "--exclude=isaacsim/kit/cache/",
             str(args.environment_source / "lib/python3.11/site-packages") + "/",
             str(prefix / "lib/python3.11/site-packages") + "/"], environment)
        python = prefix / "bin" / "python"
        modules = [sdk / "third_party/IsaacLab/source" / name for name in (
            "isaaclab", "isaaclab_assets", "isaaclab_tasks", "isaaclab_mimic", "isaaclab_contrib", "isaaclab_rl")]
        run([python, "-m", "pip", "install", "--no-deps", "--no-build-isolation", "--force-reinstall",
             *modules, sdk / "third_party/curobo"], environment)
        run([python, "-m", "pip", "install", "yourdfpy==0.0.60", "msgpack==1.1.1",
             "imageio-ffmpeg", "jsonschema==4.25.1"], environment)
        run([python, "-m", "pip", "install", "--no-deps", root / "harness/physical-runtime"], environment)
        run([python, "-m", "pip", "check"], environment)


if __name__ == "__main__":
    main()
