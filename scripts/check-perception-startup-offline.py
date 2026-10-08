import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
import sys


async def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Perception startup output must remain in a new .local/work directory.")
    output.mkdir(parents=True, exist_ok=False)
    executable = args.python.absolute()
    if not executable.is_file():
        raise FileNotFoundError(executable)
    sources = [Path(__file__)]
    cases = []
    for name in ("sam31", "yolo26_depth"):
        source = root / "harness/physical-runtime/src/physical_harness/perception" / f"{name}.py"
        sources.append(source)
        original = source.read_bytes()
        arguments = ["--checkpoint", str(output / "absent-checkpoint"),
                     "--checkpoint-sha256", "invalid-checkpoint-digest",
                     "--source-revision", "invalid-source-revision"]
        if name == "sam31":
            arguments += ["--work-root", str(output)]
            missing_text = b"Checkpoint and work directory must already exist."
            invalid_text = b"Invalid listening port."
        else:
            arguments += ["--device", "cpu"]
            missing_text = invalid_text = b"Checkpoint and listening port must be valid."
        for mode, supplied, expected in (
            ("help", ["--help"], None),
            ("required-arguments", [], b"the following arguments are required"),
            ("invalid-port", [*arguments, "--port", "65536"], invalid_text),
            ("missing-checkpoint", [*arguments, "--port", "18877"], missing_text),
        ):
            process = await asyncio.create_subprocess_exec(str(executable), str(source), *supplied,
                cwd=root, env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1"},
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                async with asyncio.timeout(10):
                    stdout, stderr = await process.communicate()
            finally:
                if process.returncode is None:
                    process.terminate()
                    await process.wait()
            (output / f"{name}.{mode}.stdout.txt").write_bytes(stdout)
            (output / f"{name}.{mode}.stderr.txt").write_bytes(stderr)
            if mode == "help":
                if process.returncode != 0 or b"usage:" not in stdout or stderr:
                    raise AssertionError(f"Perception help did not finish before optional SDK imports: {name}")
            elif (process.returncode != (2 if mode == "required-arguments" else 1)
                  or expected not in stderr or b"ModuleNotFoundError" in stderr or stdout):
                raise AssertionError(f"Perception argument admission did not preserve its original error: {name}/{mode}")
            if source.read_bytes() != original:
                raise AssertionError("Perception argument inspection changed its executable source.")
            cases.append({"service": name, "mode": mode, "pid": process.pid,
                          "exitCode": process.returncode, "ownedProcessExited": True,
                          "sdkAdmissionReached": False, "sourceUnchanged": True})
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in sources},
              "cases": cases, "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0,
              "nativeEnvironments": 0, "controls": 0,
              "scope": "Actual SAM/YOLO CLI argument admission; no SDK, model or perception-result acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, allow_nan=False, indent=2)
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    asyncio.run(inspect(parser.parse_args()))
