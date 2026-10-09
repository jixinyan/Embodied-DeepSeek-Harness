import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
import socket
import sys

from physical_harness.policies.openpi_checkpoint import verify_arx_x5_normalization, verify_checkpoint
from physical_harness.policies.provenance import checkpoint_identity, recorded_checkpoint_identity


async def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Checkpoint binding output must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    records = []
    sources = [Path(__file__), root / "harness/physical-runtime/src/physical_harness/policies/provenance.py",
               root / "harness/physical-runtime/src/physical_harness/policies/openpi_checkpoint.py",
               root / "harness/physical-runtime/src/physical_harness/policies/services/openpi_robodojo_native.py",
               root / "examples/policies/serve_openpi_robodojo_native.py"]
    for provider, checkpoint, filename in (
            ("behavior", args.behavior_checkpoint, "gr00t-n1d6-behavior.json"),
            ("robocasa", args.robocasa_checkpoint, "gr00t-n1d6-robocasa.json"),
            ("robotwin", args.robotwin_checkpoint, "lerobot-pi05-robotwin.json")):
        manifest = root / "examples/policies" / filename
        original_manifest = manifest.read_bytes()
        known = json.loads(original_manifest)["upstream"]
        expected = sha256(json.dumps(known["checkpoint_files_sha256"], sort_keys=True,
                                    separators=(",", ":")).encode("utf-8")).hexdigest()
        selected = checkpoint_identity(str(checkpoint), manifest, expected_sha256=expected)
        recorded = recorded_checkpoint_identity(selected, json.loads(original_manifest), expected_sha256=expected)
        if any(recorded[key] != selected[key] for key in recorded):
            raise AssertionError("Actual checkpoint files differ from the recorded identity reader.")
        if selected["checkpoint_digest"] != expected or selected["checkpoint_revision"] != known["checkpoint_revision"]:
            raise AssertionError("The original checkpoint differs from the selected manifest identity.")
        try:
            checkpoint_identity(str(checkpoint), manifest, expected_sha256="0" * 64)
        except ValueError as error:
            if str(error) != "Checkpoint SHA256 differs from the configured identity.":
                raise
        else:
            raise AssertionError("The actual checkpoint accepted a different configured digest.")
        if checkpoint_identity(str(checkpoint), manifest) != selected or manifest.read_bytes() != original_manifest:
            raise AssertionError("The original checkpoint or manifest changed during inspection.")
        records.append({"provider": provider, "identity": selected, "selectedDigestAccepted": True,
                        "completeRecordedIdentityAccepted": True,
                        "differentDigestRejected": True, "originalFilesUnchanged": True})
        sources.append(manifest)
    native = args.robodojo_checkpoint.resolve(strict=True)
    inventory = args.robodojo_inventory.resolve(strict=True)
    original_inventory = inventory.read_bytes()
    verified = verify_checkpoint(native, inventory)
    expected = "fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7"
    if (verified["checkpoint_sha256"] != expected or len(verified["files"]) != 18
            or verified["revision"] != "35efbc7dedfdbeeb6e95fb749bd885d73d483e41"):
        raise AssertionError("The original RoboDojo checkpoint identity differs.")
    normalization = verify_arx_x5_normalization(native)
    normalization_record = next(item for item in verified["files"] if item["path"] == normalization["path"])
    if (normalization_record["sha256"] != normalization["sha256"]
            or normalization_record["bytes"] != normalization["bytes"]):
        raise AssertionError("Original ARX X5 normalization differs from its verified inventory.")
    target = output / "verification-target"
    target.mkdir()
    cases = []
    for entry, command in (
            ("example", [str(root / "examples/policies/serve_openpi_robodojo_native.py")]),
            ("module", ["-m", "physical_harness.policies.services.openpi_robodojo_native"])):
        for mode, digest, expected_error in (
                ("selected-digest-report-path", expected, b"IsADirectoryError"),
                ("different-digest", "0" * 64, b"Checkpoint SHA256 differs from the configured identity.")):
            with socket.create_server(("127.0.0.1", 0)) as candidate:
                native_port = candidate.getsockname()[1]
            process = await asyncio.create_subprocess_exec(str(args.python.absolute()), *command,
                "--checkpoint", str(native), "--inventory", str(inventory),
                "--checkpoint-sha256", digest, "--verification-output", str(target), "--port", str(native_port), cwd=root,
                env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
                     "PYTHONPATH": str(root / "harness/physical-runtime/src")},
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                async with asyncio.timeout(180):
                    stdout, stderr = await process.communicate()
            finally:
                if process.returncode is None:
                    process.terminate()
                    await process.wait()
            (output / f"{entry}.{mode}.stdout.txt").write_bytes(stdout)
            (output / f"{entry}.{mode}.stderr.txt").write_bytes(stderr)
            if (process.returncode != 1 or expected_error not in stderr or b"ModuleNotFoundError" in stderr
                    or stdout or list(target.iterdir())):
                raise AssertionError("Native OpenPI checkpoint selection did not preserve its actual pre-SDK error.")
            if mode == "selected-digest-report-path" and os.fsencode(str(target)) not in stderr:
                raise AssertionError("The selected native checkpoint did not reach its original report-path error.")
            with socket.create_server(("127.0.0.1", native_port)):
                pass
            cases.append({"entry": entry, "mode": mode, "pid": process.pid, "exitCode": process.returncode,
                          "originalError": expected_error.decode(), "ownedProcessExited": True,
                          "reservedPort": native_port, "boundPortReusable": True, "modelLoaded": False})
    if (verify_checkpoint(native, inventory) != verified or inventory.read_bytes() != original_inventory
            or verify_arx_x5_normalization(native) != normalization):
        raise AssertionError("The original native checkpoint or inventory changed during inspection.")
    if any(name.split(".")[0] in {"jax", "torch", "gr00t", "lerobot", "openpi", "transformers"} for name in sys.modules):
        raise AssertionError("Checkpoint binding inspection imported a model SDK.")
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in sources},
              "checkpointSelections": records, "nativeCheckpoint": verified, "nativeNormalization": normalization,
              "nativeInventorySha256": sha256(original_inventory).hexdigest(), "nativeCases": cases,
              "originalFilesUnchanged": True, "modelSdkImported": False,
              "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Actual original checkpoint selection/digest rejection and native CLI report-path admission; no fine-tuned-model or loaded-policy acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps({"providers": len(records) + 1, "nativeCases": len(cases), "state": "passed", "gpuJobs": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--behavior-checkpoint", type=Path, required=True)
    parser.add_argument("--robocasa-checkpoint", type=Path, required=True)
    parser.add_argument("--robotwin-checkpoint", type=Path, required=True)
    parser.add_argument("--robodojo-checkpoint", type=Path, required=True)
    parser.add_argument("--robodojo-inventory", type=Path, required=True)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))
