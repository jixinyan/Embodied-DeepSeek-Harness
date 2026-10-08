import argparse
import asyncio
from copy import deepcopy
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys
import socket
import time

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.resources import ResourceArbiter
from physical_harness.policies.client import PolicyProtocolError, WebSocketPolicyClient, validate_response
from physical_harness.policies.openpi_audit import CHECKPOINT_SHA256, retained_sources, task_sources
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


async def inspect(configuration: Path, output: Path):
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

    def wire_selection(provider, request, inference, digest):
        selected = deepcopy(request)
        selected["checkpoint_sha256"] = digest
        response = {key: deepcopy(selected[key]) for key in (
            "request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")}
        response.update(schema_version="physical.action_chunk.v1", actions=deepcopy(inference["actions"]),
                        checkpoint_sha256=digest)
        validator.parse("PolicyRequest", selected)
        if validate_response(validator, selected, response) != response:
            raise AssertionError("Selected identity changed original model actions.")
        cases.append({"name": f"{provider}.selected-wire-identity", "result": "passed",
                      "scope": "Declared identity metadata on original request/action values; validation only."})
        for name, changed in (("missing", None), ("different", "0" * 64)):
            invalid = deepcopy(response)
            if changed is None:
                del invalid["checkpoint_sha256"]
            else:
                invalid["checkpoint_sha256"] = changed
            rejected(f"{provider}.{name}-wire-identity", lambda: validate_response(validator, selected, invalid))
        return selected

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
        request_id = next(iter(actual_requests))
        wire_selection(provider, actual_requests[request_id], inferences[request_id], bindings[provider])
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
    request_id = next(iter(task_result[1]))
    selected_request = wire_selection("robodojo", task_result[1][request_id], task_result[0][request_id], CHECKPOINT_SHA256)
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
    device = NativeActionDevice(RoboDojoEnvironment(validator))
    resources = ResourceArbiter(output / "resources", "cpu-checkpoint-admission")
    lease = resources.acquire(("motion",))
    gate = ActionGate(validator, device, execution_id=selected_request["execution_id"],
                      task_scope=selected_request["task_scope"], action_spec=selected_request["action_spec"],
                      max_control_steps=selected_request["max_actions"], max_wall_time_s=30,
                      lease_valid=lease.valid, checkpoint_sha256=CHECKPOINT_SHA256)
    try:
        ticket = gate.request(selected_request["instruction"], selected_request["observation_id"],
                              selected_request["observation"], observed_monotonic=time.monotonic())
        if ticket["checkpoint_sha256"] != CHECKPOINT_SHA256:
            raise AssertionError("ActionGate request lost its selected checkpoint identity.")
        for name, digest in (("missing", None), ("different", "0" * 64)):
            response = {key: deepcopy(ticket[key]) for key in (
                "request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")}
            response.update(schema_version="physical.action_chunk.v1", actions=task_result[0][request_id]["actions"])
            if digest is not None:
                response["checkpoint_sha256"] = digest
            try:
                await gate.execute(response)
            except PolicyProtocolError as error:
                cases.append({"name": f"robodojo.gate-{name}-identity", "result": "rejected",
                              "originalError": str(error), "controls": 0})
            else:
                raise AssertionError("ActionGate admitted an unidentified checkpoint response.")
        if gate.snapshot()["reserved_actions"] or device.raw_sim_steps or device.executed_actions:
            raise AssertionError("Checkpoint admission diagnostic supplied action effects.")
    finally:
        try:
            await device.close()
        finally:
            lease.release()
    if lease.valid() or not device.diagnostic_snapshot()["closed"]:
        raise AssertionError("Checkpoint Gate diagnostic retained its device owner or resource lease.")

    closed_port = socket.socket()
    closed_port.bind(("127.0.0.1", 0))
    upstream = WebSocketPolicyClient(f"ws://127.0.0.1:{closed_port.getsockname()[1]}", validator, timeout_s=3)
    forwarded = []

    async def forward(request):
        forwarded.append(request["request_id"])
        return await upstream.infer(request)

    try:
        for identity in (lambda: bindings["robodojo"], None):
            server = await serve_policy(forward, validator, checkpoint_sha256=identity, timeout_s=5)
            client = WebSocketPolicyClient(f"ws://127.0.0.1:{server.sockets[0].getsockname()[1]}", validator, timeout_s=10)
            try:
                selections = ("0" * 64, CHECKPOINT_SHA256) if identity is not None else (CHECKPOINT_SHA256,)
                for digest in selections:
                    request = deepcopy(selected_request)
                    request["checkpoint_sha256"] = digest
                    before = len(forwarded)
                    try:
                        await client.infer(request)
                    except PolicyProtocolError as error:
                        if str(error) != "Policy server reported an inference failure.":
                            raise
                    else:
                        raise AssertionError("An unavailable policy returned actions during CPU admission.")
                    admitted = identity is not None and digest == CHECKPOINT_SHA256
                    if len(forwarded) != before + int(admitted) or client.last_response is not None or client._connection is not None:
                        raise AssertionError("Checkpoint identity did not control actual inference/connection admission.")
                    name = "selected-unavailable-upstream" if admitted else "different-service-identity" if identity else "unidentified-service"
                    cases.append({"name": f"robodojo.transport-{name}", "result": "rejected",
                                  "inferenceAdmitted": admitted, "actionsReturned": False})
            finally:
                server.close()
                await client.close()
                await server.wait_closed()
            if server.connections:
                raise AssertionError("Checkpoint transport diagnostic retained connections.")
    finally:
        await upstream.close()
        closed_port.close()
    for path in (root / "harness/physical-runtime/src/physical_harness/policies/provenance.py",
                 root / "harness/physical-runtime/src/physical_harness/policies/openpi_audit.py",
                 root / "harness/physical-runtime/src/physical_harness/policies/client.py",
                 root / "harness/physical-runtime/src/physical_harness/policies/server.py",
                 root / "harness/physical-runtime/src/physical_harness/execution/action_gate.py",
                 root / "harness/physical-runtime/src/physical_harness/execution/native_device.py",
                 root / "harness/physical-runtime/src/physical_harness/execution/resources.py", Path(__file__)):
        original(path)
    for path, digest in sources.items():
        if sha256(Path(path).read_bytes()).hexdigest() != digest:
            raise AssertionError("An original source changed during recorded checkpoint inspection.")
    if any(name.split(".")[0] in {"jax", "torch", "openpi", "gr00t", "lerobot", "transformers"} for name in sys.modules):
        raise AssertionError("Recorded checkpoint inspection imported a model SDK.")
    report = {"sources": sources, "cases": cases, "referenceDigests": bindings,
              "originalFilesUnchanged": True, "modelSdkImported": False,
              "deviceOwnerReleased": True, "resourceLeaseReleased": True, "policyConnectionsReleased": True,
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
    asyncio.run(inspect(arguments.configuration, arguments.output))
