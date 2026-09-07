"""Compile/import CPU modules without installing optional providers."""
import importlib
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

assert sys.version_info >= (3, 11), "Python 3.11+ required"
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[1]
source = root / "harness/physical-runtime/src"
sys.path.insert(0, str(source))
count = 0
for file in sorted(source.rglob("*.py")):
    compile(file.read_text(), str(file), "exec")
    parts = list(file.relative_to(source).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    importlib.import_module(".".join(parts))
    count += 1
for file in (root / "docs/architecture/assets").glob("*.svg"):
    ET.parse(file)
ET.parse(root / "tests/fixtures/cup-scene.svg")
print(f"Compiled/imported {count} Python modules; SVG XML valid.")
print("No worker, simulator, policy or hardware behavior was exercised.")
