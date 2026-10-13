import argparse
from copy import deepcopy
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
from unittest import TestCase

import psutil

from physical_harness.environments.factory import create_native_environment
from physical_harness.execution.worker import NativeWorkerSession
from physical_harness.validation import ContractValidator


SDK_MODULES = (
    "torch", "transformers", "jax", "gr00t", "lerobot", "sapien", "robocasa",
    "robosuite", "omnigibson", "isaacsim",
)


def require_cpu_scope():
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("Environment factory checks require CUDA_VISIBLE_DEVICES=''.")
    for prefix in SDK_MODULES:
        if any(module == prefix or module.startswith(prefix + ".") for module in sys.modules):
            raise RuntimeError(f"Environment factory CPU scope imported {prefix}.")


def inspect(args):
    require_cpu_scope()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Environment factory output must remain under .local/work.")
    configuration_path = args.config.resolve(strict=True)
    original = json.loads(configuration_path.read_bytes())["worker"]
    if original["provider"] not in ("robodojo", "robotwin", "robocasa", "behavior"):
        raise ValueError("Require an original supported native Worker configuration.")
    names = [
        "scripts/check-native-environment-factory-offline.py",
        "harness/contracts/schema/physical.schema.json",
        "harness/physical-runtime/src/physical_harness/validation.py",
        "harness/physical-runtime/src/physical_harness/environments/__init__.py",
        "harness/physical-runtime/src/physical_harness/environments/factory.py",
        "harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py",
        "harness/physical-runtime/src/physical_harness/execution/worker.py",
        "harness/physical-runtime/src/physical_harness/perception/metric_capture.py",
        "harness/physical-runtime/src/physical_harness/perception/metric_geometry.py",
    ]
    sources = [{"path": str(path), "sha256": sha256(path.read_bytes()).hexdigest()}
               for path in [configuration_path, *(root / name for name in names)]]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    output.mkdir(parents=True, exist_ok=False)
    source_file = output / "source-root-file"
    source_file.write_bytes(configuration_path.read_bytes())
    cases = []
    inputs = [{"path": source_file.name, "sha256": sha256(source_file.read_bytes()).hexdigest()}]
    test = TestCase()
    process = psutil.Process()
    original_directory = Path.cwd().resolve()
    original_children = [(child.pid, child.create_time()) for child in process.children(recursive=True)]
    original_fds = process.num_fds()

    def save(name, configuration):
        path = output / f"{name}.json"
        with path.open("x", encoding="utf-8") as stream:
            json.dump(configuration, stream, allow_nan=False, indent=2)
            stream.write("\n")
        inputs.append({"path": path.name, "sha256": sha256(path.read_bytes()).hexdigest()})
        return path

    def reject(name, configuration, error, message):
        before = deepcopy(configuration)
        path = save(name, configuration)
        with test.assertRaisesRegex(error, message) as raised:
            create_native_environment(configuration, validator)
        assert configuration == before
        require_cpu_scope()
        cases.append({"name": name, "rejected": True, "input": path.name,
                      "errorType": type(raised.exception).__name__, "error": str(raised.exception)})

    reject("missing-provider", {}, KeyError, "provider")
    reject("unknown-provider", {"provider": "unregistered"}, ValueError, "Unsupported native environment provider")
    for provider in ("robocasa", "robodojo"):
        for name, value in (("directory", str(output)), ("file", str(source_file)), ("null", None)):
            reject(f"{provider}-source-root-{name}", {"provider": provider, "source_root": value},
                   ValueError, "source_root")
    for provider in ("robotwin", "behavior"):
        reject(f"{provider}-missing-source-root", {"provider": provider}, KeyError, "source_root")
        reject(f"{provider}-null-source-root", {"provider": provider, "source_root": None},
               TypeError, "path")
        reject(f"{provider}-file-source-root", {"provider": provider, "source_root": str(source_file)},
               ValueError, "installed source directory")
        reject(f"{provider}-absent-source-root", {"provider": provider, "source_root": str(output / "absent")},
               FileNotFoundError, "absent")

    # RoboDojo adapter 构造只建立本地状态；reset 负责连接和启动环境。
    from physical_harness.environments.robodojo import ACTION_SPEC, RoboDojoEnvironment

    instances = []
    configuration = {"provider": "robodojo"}
    path = save("robodojo-constructor", configuration)
    for _ in range(2):
        environment = create_native_environment(configuration, validator)
        assert type(environment) is RoboDojoEnvironment
        assert environment._validator is validator
        assert environment._rpc is None and environment._service is None
        assert environment._metadata is None and environment._step_id == 0
        assert environment._episode_id is None and environment._task_id is None
        validator.parse("ActionSpec", ACTION_SPEC)
        assert len(ACTION_SPEC["channels"]) == 14
        instances.append(environment)
    assert instances[0] is not instances[1]
    assert instances[0]._metric_capture is not instances[1]._metric_capture
    cases.append({"name": "robodojo-independent-constructors", "rejected": False,
                  "input": path.name, "instances": len(instances), "actionChannels": 14})
    for index, environment in enumerate(instances):
        with test.assertRaisesRegex(RuntimeError, "has not been reset"):
            environment.episode_terminated()
        cases.append({"name": f"robodojo-{index}-uninitialized-episode", "rejected": True,
                      "input": path.name})
        with test.assertRaisesRegex(RuntimeError, "has not been reset"):
            environment.observe()
        cases.append({"name": f"robodojo-{index}-uninitialized-observation", "rejected": True,
                      "input": path.name})
        environment.close()
        environment.close()
        assert environment._rpc is None and environment._service is None
        cases.append({"name": f"robodojo-{index}-repeated-close", "rejected": False,
                      "input": path.name})
    require_cpu_scope()
    assert Path.cwd().resolve() == original_directory
    assert [(child.pid, child.create_time()) for child in process.children(recursive=True)] == original_children
    assert process.num_fds() == original_fds
    for source in sources:
        assert sha256(Path(source["path"]).read_bytes()).hexdigest() == source["sha256"]
    for item in inputs:
        assert sha256((output / item["path"]).read_bytes()).hexdigest() == item["sha256"]
    record = {
        "schemaVersion": "edh.environment_factory_cpu.v1", "sources": sources,
        "inputs": inputs, "cases": cases, "originalProvider": original["provider"],
        "originalSourcesUnchanged": True, "configurationInputsUnchanged": True,
        "workingDirectoryUnchanged": True, "childProcessesUnchanged": True,
        "fileDescriptorsUnchanged": True, "nativeConstructorInstances": len(instances),
        "optionalSdkModulesImported": [], "environmentAllocationPerformed": False,
        "modelInferencePerformed": False, "physicalControlPerformed": False,
        "workerClass": f"{NativeWorkerSession.__module__}.{NativeWorkerSession.__qualname__}",
        "scope": "Production environment factory admission and uninitialized RoboDojo adapter construction; no RPC reset, SDK provider, model, simulator or device allocation.",
    }
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(record, stream, allow_nan=False, indent=2)
        stream.write("\n")
    print(json.dumps({"cases": len(cases), "sources": len(sources), "inputs": len(inputs),
                      "nativeConstructorInstances": len(instances), "gpuAllocations": 0}))


def main():
    if not __debug__:
        raise RuntimeError("Environment factory checks require enabled assertions.")
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args())


if __name__ == "__main__":
    main()
