import argparse
from copy import deepcopy
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys

from physical_harness.policies.openpi_audit import CHECKPOINT_SHA256, retained_sources, task_sources
from physical_harness.validation import ContractValidator


def inspect(configuration: Path, output: Path):
    root = Path(__file__).resolve().parents[1]
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Checkpoint audit output must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        resolved = Path(path).resolve(strict=True)
        sources[str(resolved)] = sha256(resolved.read_bytes()).hexdigest()
        return resolved

    document = json.loads(original(configuration).read_bytes())
    spec = importlib.util.spec_from_file_location("edh_recorded_run_audit", original(root / "scripts/audit-recorded-run.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    validator = ContractValidator.from_path(original(root / "harness/contracts/schema/physical.schema.json"))
    cases, bindings = [], {}

    def rejected(name, operation):
        try:
            operation()
        except ValueError as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise AssertionError(f"Invalid checkpoint selection was accepted: {name}")

    for entry in document["conventional"]:
        run = json.loads(original(entry["run"]).read_bytes())
        service_log, manifest = original(entry["serviceLog"]), original(entry["manifest"])
        requests = Path(entry["requests"]).resolve(strict=True)
        result = module.conventional_policy_sources(run, requests, service_log, manifest,
                                                    root / "harness/contracts/schema/physical.schema.json")
        provider, inferences, actual_requests, provenance = result
        if provider in bindings:
            raise AssertionError("Original audit inputs repeat a provider.")
        bindings[provider] = provenance["checkpointDigest"]
        for request_id in actual_requests:
            original(requests / f"{request_id}.json")
        cases.append({"name": f"{provider}.original-records", "result": "passed", "runId": run["id"],
                      "originalTaskState": run["state"], "identifiedInferences": len(inferences),
                      "provenance": provenance})
        selected = deepcopy(run)
        selected["configuration"]["launchProfile"]["checkpointSha256"] = provenance["checkpointDigest"]
        if module.conventional_policy_sources(selected, requests, service_log, manifest,
                                              root / "harness/contracts/schema/physical.schema.json") != result:
            raise AssertionError("Explicit reference selection changed original inference evidence.")
        cases.append({"name": f"{provider}.explicit-reference-selection", "result": "passed",
                      "scope": "Diagnostic selection metadata applied to original recorded inputs."})
        selected["configuration"]["launchProfile"]["checkpointSha256"] = "0" * 64
        rejected(f"{provider}.different-selection", lambda: module.conventional_policy_sources(
            selected, requests, service_log, manifest, root / "harness/contracts/schema/physical.schema.json"))
    if set(bindings) != {"behavior", "robocasa", "robotwin"}:
        raise AssertionError("Original audit input requires all three conventional providers.")
    native = document["openpi"]
    verification, bridge, service = (original(native[key]) for key in ("verification", "bridgeLog", "nativeLog"))
    reports = tuple(original(path) for path in native["retainedReports"])
    result = retained_sources(verification, bridge, service, reports, validator)
    if result["nativeActionReceipts"] != 0 or result["taskCompletionAcceptance"] is not False:
        raise AssertionError("Retained inference inspection published physical-task acceptance.")
    if retained_sources(verification, bridge, service, reports, validator, expected_sha256=CHECKPOINT_SHA256) != result:
        raise AssertionError("Explicit OpenPI reference selection changed original inference evidence.")
    bindings["robodojo"] = result["checkpointSHA256"]
    cases.extend([{"name": "robodojo.original-retained-records", "result": "passed", "report": result},
                  {"name": "robodojo.explicit-reference-selection", "result": "passed"}])
    rejected("robodojo.different-selection", lambda: retained_sources(
        verification, bridge, service, reports, validator, expected_sha256="0" * 64))
    rejected("robodojo.malformed-selection", lambda: retained_sources(
        verification, bridge, service, reports, validator, expected_sha256="invalid"))
    task = document["openpiTask"]
    run = json.loads(original(task["run"]).read_bytes())
    task_paths = [original(task[key]) for key in ("bridgeLog", "nativeLog", "verification")]
    request_directory = Path(task["requests"]).resolve(strict=True)
    bridge_directory = Path(task["bridgeDirectory"]).resolve(strict=True)

    def task_audit(selected_run):
        return task_sources(selected_run, request_directory, bridge_directory, *task_paths, validator, task["policyId"])

    task_result = task_audit(run)
    for request_id in task_result[1]:
        original(request_directory / f"{request_id}.json")
        original(bridge_directory / f"{request_id}.request.json")
        original(bridge_directory / f"{request_id}.inference.json")
    cases.append({"name": "robodojo.original-task-inputs", "result": "passed", "runId": run["id"],
                  "originalTaskState": run["state"], "identifiedInferences": len(task_result[0])})
    selected = deepcopy(run)
    selected["configuration"]["launchProfile"]["checkpointSha256"] = CHECKPOINT_SHA256
    if task_audit(selected) != task_result:
        raise AssertionError("Explicit OpenPI profile changed actual decoded input or action evidence.")
    cases.append({"name": "robodojo.explicit-task-profile-selection", "result": "passed",
                  "scope": "Diagnostic selection metadata applied to original recorded inputs."})
    selected["configuration"]["launchProfile"]["checkpointSha256"] = "0" * 64
    rejected("robodojo.different-task-profile-selection", lambda: task_audit(selected))
    for path in (root / "harness/physical-runtime/src/physical_harness/policies/provenance.py",
                 root / "harness/physical-runtime/src/physical_harness/policies/openpi_audit.py", Path(__file__)):
        original(path)
    for path, digest in sources.items():
        if sha256(Path(path).read_bytes()).hexdigest() != digest:
            raise AssertionError("An original source changed during recorded checkpoint inspection.")
    if any(name.split(".")[0] in {"jax", "torch", "openpi", "gr00t", "lerobot", "transformers"} for name in sys.modules):
        raise AssertionError("Recorded checkpoint inspection imported a model SDK.")
    report = {"sources": sources, "cases": cases, "referenceDigests": bindings,
              "originalFilesUnchanged": True, "modelSdkImported": False,
              "gpuJobs": 0, "modelCalls": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Original reference inference/request records and explicit selection admission; no custom-checkpoint inference or new physical task acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps({"providers": len(bindings), "cases": len(cases), "state": "passed", "gpuJobs": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    inspect(arguments.configuration, arguments.output)
