import argparse
import hashlib
import importlib
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlparse


def identity(path):
    source = path.resolve(strict=True)
    with source.open("rb") as content:
        digest = hashlib.file_digest(content, "sha256").hexdigest()
    return {"path": str(source), "sha256": digest}


def main():
    parser = argparse.ArgumentParser(description="Inspect a real isolated CPU installation and its pip report.")
    parser.add_argument("--install-report", type=Path, required=True)
    parser.add_argument("--supplemental-install-report", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    output.relative_to(root / ".local/work")
    assert sys.version_info >= (3, 11), "Python 3.11+ required."
    assert sys.prefix != sys.base_prefix, "Use an isolated Python environment."
    assert os.environ.get("CUDA_VISIBLE_DEVICES") == "", "Set CUDA_VISIBLE_DEVICES to an empty value."
    assert not output.exists(), "Use a new output directory."
    report_paths = [args.install_report, *args.supplemental_install_report]
    report_sources = [identity(path) for path in report_paths]
    reports = [json.loads(path.read_text()) for path in report_paths]
    assert all(report["version"] == "1" for report in reports), "Unsupported pip installation report."
    assert all(report["install"] for report in reports), "Installation reports must contain installed distributions."
    manifest_path = root / "harness/physical-runtime/pyproject.toml"
    manifest = tomllib.loads(manifest_path.read_text())
    package_name = manifest["project"]["name"]
    package = importlib.metadata.distribution(package_name)
    editable = json.loads(package.read_text("direct_url.json"))
    assert editable["dir_info"]["editable"] is True
    location = urlparse(editable["url"])
    assert location.scheme == "file" and location.netloc in ("", "localhost")
    assert Path(unquote(location.path)).resolve(strict=True) == manifest_path.parent
    distributions = {}
    for report in reports:
        names = set()
        for entry in report["install"]:
            metadata = entry["metadata"]
            name = metadata["name"]
            normalized = name.lower().replace("_", "-").replace(".", "-")
            assert normalized not in names, f"Duplicate installed distribution: {name}"
            names.add(normalized)
            assert importlib.metadata.version(name) == metadata["version"], f"Installed version differs for {name}."
            value = {"name": name, "version": metadata["version"], "download": entry["download_info"]}
            if normalized in distributions:
                assert distributions[normalized] == value, f"Conflicting installation reports for {name}."
            distributions[normalized] = value
    required = {package_name, "jsonschema", "filelock", "pillow", "websockets"}
    assert required.issubset(distributions), "Supply the complete initial CPU installation report."
    versions = list(distributions.values())
    checked = subprocess.run([sys.executable, "-m", "pip", "check"], check=True, capture_output=True, text=True)
    modules = []
    for name in (
        "jsonschema", "filelock", "PIL", "websockets",
        "physical_harness.validation", "physical_harness.physical_boundary",
        "physical_harness.execution.action_gate", "physical_harness.execution.worker",
        "physical_harness.policies.listener",
        "physical_harness.policies.services.gr00t_n1d6_behavior",
        "physical_harness.policies.services.gr00t_n1d6_robocasa",
        "physical_harness.policies.services.lerobot_pi05_robotwin",
        "physical_harness.policies.services.openpi_robodojo",
        "physical_harness.policies.services.openpi_robodojo_native",
    ):
        module = importlib.import_module(name)
        source = identity(Path(module.__file__))
        if name.startswith("physical_harness."):
            Path(source["path"]).relative_to(manifest_path.parent / "src")
        else:
            Path(source["path"]).relative_to(Path(sys.prefix).resolve())
        modules.append({"module": name, **source})
    forbidden = {"torch", "jax", "vllm", "openpi", "lerobot", "gr00t", "omnigibson", "isaacsim", "robosuite", "sapien"}
    assert not forbidden.intersection(name.split(".")[0] for name in sys.modules), "Optional model/simulator SDK imported."
    assert [identity(path) for path in report_paths] == report_sources
    output.mkdir(parents=True, exist_ok=False)
    result = {
        "format": "edh.cpu-installation.v1",
        "python": sys.version, "executable": sys.executable,
        "environment": str(Path(sys.prefix).resolve()), "platform": platform.platform(),
        "installReport": report_sources[0], "supplementalInstallReports": report_sources[1:],
        "sources": [identity(manifest_path), identity(root / "harness/physical-runtime/constraints.txt"), identity(Path(__file__))],
        "distributions": versions, "importedModules": modules, "dependencyCheck": checked.stdout.strip(),
        "editableSource": editable, "optionalSDKsImported": [],
        "gpuAllocated": False, "modelInferencePerformed": False, "simulatorAllocated": False,
        "scope": "Actual isolated editable installation, pip dependency validation and production import origins; no native execution.",
    }
    (output / "installation.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"distributions": len(versions), "modules": len(modules), "output": str(output), "nativeAllocations": 0}))


if __name__ == "__main__":
    main()
