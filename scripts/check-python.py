import importlib
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

assert sys.version_info >= (3, 11), "Python 3.11+ required"
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[1]
source = root / "harness/physical-runtime/src"
sys.path.insert(0, str(source))
compiled = 0
for file in sorted(source.rglob("*.py")):
    compile(file.read_text(), str(file), "exec")
    compiled += 1
entrypoints = sorted((root / "examples/policies").glob("*.py"))
for file in entrypoints:
    compile(file.read_text(), str(file), "exec")
diagnostics = sorted((root / "scripts").glob("*.py"))
for file in diagnostics:
    compile(file.read_text(), str(file), "exec")
core_modules = (
    "physical_harness",
    "physical_harness.validation",
    "physical_harness.physical_boundary",
    "physical_harness.wire",
    "physical_harness.lifecycle",
    "physical_harness.environments",
    "physical_harness.execution",
    "physical_harness.execution.action_gate",
    "physical_harness.execution.native_device",
    "physical_harness.execution.policy_rollout",
    "physical_harness.execution.policy_records",
    "physical_harness.execution.worker_transport",
    "physical_harness.execution.worker",
    "physical_harness.policies",
    "physical_harness.policies.client",
    "physical_harness.policies.inference",
    "physical_harness.policies.server",
    "physical_harness.policies.services",
    "physical_harness.policies.services.gr00t_n1d6_robocasa",
    "physical_harness.policies.services.gr00t_n1d6_behavior",
    "physical_harness.policies.services.lerobot_pi05_robotwin",
    "physical_harness.policies.services.openpi_robodojo",
    "physical_harness.policies.services.openpi_robodojo_native",
    "physical_harness.perception",
    "physical_harness.verification",
    "physical_harness.backends",
    "physical_harness.embodiments",
)
for module in core_modules:
    importlib.import_module(module)
for file in (root / "docs/architecture/assets").glob("*.svg"):
    ET.parse(file)
ET.parse(root / "tests/fixtures/cup-scene.svg")
print(f"Compiled {compiled} Python files and imported {len(core_modules)} base modules; SVG XML valid.")
print(f"Compiled {len(entrypoints)} policy service and diagnostic entry points without importing model SDKs.")
print(f"Compiled {len(diagnostics)} Python diagnostic entries without starting their providers.")
print("No worker, simulator, learned policy or hardware behavior was exercised.")
