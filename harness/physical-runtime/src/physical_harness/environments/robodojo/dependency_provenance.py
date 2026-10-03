from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import distribution, version
import json
from pathlib import Path

from packaging.requirements import Requirement


def record_native_dependencies(output: Path) -> dict:
    import fastapi
    import isaaclab
    import isaacsim
    import starlette

    modules = {"fastapi": fastapi, "isaaclab": isaaclab, "isaacsim": isaacsim, "starlette": starlette}
    packages = {}
    for name in ("isaacsim-kernel", *modules):
        package = distribution(name)
        metadata_files = [item for item in package.files
                          if item.name in {"METADATA", "PKG-INFO"}
                          and any(part.endswith((".dist-info", ".egg-info")) for part in item.parts)]
        if len(metadata_files) != 1:
            raise RuntimeError(f"Native dependency {name} has no unique original distribution metadata file.")
        metadata_path = Path(package.locate_file(metadata_files[0])).resolve(strict=True)
        row = {"version": package.version, "requires": package.requires,
               "metadata_path": str(metadata_path),
               "metadata_sha256": sha256(metadata_path.read_bytes()).hexdigest()}
        if name in modules:
            module = modules[name]
            path = Path(module.__file__).resolve(strict=True)
            row.update(module_path=str(path), module_source_sha256=sha256(path.read_bytes()).hexdigest(),
                       module_version=getattr(module, "__version__", None))
        packages[name] = row
    requirements = []
    for parent, child in (("isaacsim-kernel", "fastapi"), ("fastapi", "starlette"), ("isaaclab", "starlette")):
        requirement = next(Requirement(item) for item in packages[parent]["requires"]
                           if Requirement(item).name == child)
        installed = version(child)
        requirements.append({"package": parent, "requirement": str(requirement),
                             "installed_version": installed,
                             "satisfied": requirement.specifier.contains(installed)})
    result = {"schema_version": "edh.robodojo.native_dependencies.v1",
              "recorded_at": datetime.now(timezone.utc).isoformat(),
              "phase": "after SimulationApp initialization", "packages": packages,
              "requirements": requirements}
    with (output / "native-dependencies.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
    return result
