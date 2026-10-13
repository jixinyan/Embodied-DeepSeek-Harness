import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tomllib
from urllib.parse import unquote, urlparse


def identity(path):
    source = path.resolve(strict=True)
    with source.open("rb") as content:
        sha256 = hashlib.file_digest(content, "sha256").hexdigest()
    return {"path": str(source), "sha256": sha256}


def main():
    if not __debug__:
        raise RuntimeError("CPU evidence inspection requires Python assertions to remain enabled.")
    parser = argparse.ArgumentParser(description="Verify actual CPU installation and runtime artifacts against their Git source.")
    parser.add_argument("--installation", type=Path, required=True)
    parser.add_argument("--runtime", type=Path, required=True)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    output.relative_to(root / ".local/work")
    assert not output.exists(), "Use a new evidence output file."
    revision = subprocess.run(
        ["git", "rev-parse", "--verify", "--end-of-options", f"{args.source_revision}^{{commit}}"],
        cwd=root, check=True, capture_output=True, text=True,
    ).stdout.strip()
    comparisons = []

    def source_bytes(relative):
        path = Path(relative)
        assert not path.is_absolute() and ".." not in path.parts, "Source must identify a repository file."
        return subprocess.run(
            ["git", "show", f"{revision}:{path.as_posix()}"],
            cwd=root, check=True, capture_output=True,
        ).stdout

    def compare(relative, expected):
        sha256 = hashlib.sha256(source_bytes(relative)).hexdigest()
        assert sha256 == expected, f"Source identity differs: {relative}"
        comparisons.append({"path": str(relative), "sha256": sha256})

    installation = args.installation.resolve(strict=True)
    runtime = args.runtime.resolve(strict=True)
    plan_read_names = (
        "original-plan", "foreign-task", "document-version", "storage-version",
        "schema-version", "duplicate-goals",
    )
    files = [
        installation / "cpu-install-report.json",
        installation / "cpu-installation/installation.json",
        *(runtime / component / "acceptance.json" for component in (
            "device-owner", "session-owner", "worker-transport", "agent-tools",
        )),
        runtime / "agent-tools/data/records.jsonl",
        runtime / "task-plans/acceptance.json",
        runtime / "task-plans/data/records.jsonl",
        *(runtime / "task-plans/read" / name / "records.jsonl" for name in plan_read_names),
    ]
    inputs = [identity(path) for path in files]
    report, manifest, device, session, transport, tools = [json.loads(path.read_bytes()) for path in files[:6]]
    plans = json.loads(files[7].read_bytes())
    assert report["version"] == "1" and report["install"], "Require the complete actual pip installation report."
    assert manifest["format"] == "edh.cpu-installation.v1"
    assert manifest["supplementalInstallReports"] == [], "CI artifacts require one complete installation report."
    assert inputs[0]["sha256"] == manifest["installReport"]["sha256"]
    assert manifest["dependencyCheck"] == "No broken requirements found."
    assert manifest["optionalSDKsImported"] == []
    for field in ("gpuAllocated", "modelInferencePerformed", "simulatorAllocated"):
        assert manifest[field] is False, f"CPU installation scope differs: {field}"
    project = tomllib.loads(source_bytes("harness/physical-runtime/pyproject.toml").decode("utf-8"))
    assert len(manifest["distributions"]) == len(report["install"])
    names = set()
    for saved, installed in zip(manifest["distributions"], report["install"], strict=True):
        assert saved == {
            "name": installed["metadata"]["name"],
            "version": installed["metadata"]["version"],
            "download": installed["download_info"],
        }, "Distribution/version/download identity differs."
        assert saved["name"] not in names, "Duplicate installation distribution."
        names.add(saved["name"])
    required = {project["project"]["name"], "jsonschema", "filelock", "pillow", "websockets", "msgpack", "numpy", "psutil", "av"}
    assert required.issubset(names), "Require the complete CPU adapter and recording installation."
    editable = manifest["editableSource"]
    assert next(entry for entry in manifest["distributions"] if entry["name"] == project["project"]["name"])["download"] == editable
    location = urlparse(editable["url"])
    assert location.scheme == "file" and location.netloc in ("", "localhost")
    assert editable["dir_info"]["editable"] is True
    package = Path(unquote(location.path))
    assert package.is_absolute() and package.parts[-2:] == ("harness", "physical-runtime")
    source_root = package.parents[1]
    assert Path(manifest["installReport"]["path"]).relative_to(source_root) == Path(".local/work/cpu-install-report.json")
    assert len(manifest["sources"]) == 3
    for entry in manifest["sources"]:
        compare(Path(entry["path"]).relative_to(source_root), entry["sha256"])
    assert {Path(entry["path"]).relative_to(source_root).as_posix() for entry in manifest["sources"]} == {
        "harness/physical-runtime/pyproject.toml", "harness/physical-runtime/constraints.txt",
        "scripts/check-cpu-installation.py",
    }
    modules = manifest["importedModules"]
    assert len({entry["module"] for entry in modules}) == len(modules) == 13
    assert {entry["module"] for entry in modules} == {
        "jsonschema", "filelock", "PIL", "websockets",
        "physical_harness.validation", "physical_harness.physical_boundary",
        "physical_harness.execution.action_gate", "physical_harness.execution.worker",
        "physical_harness.policies.services.gr00t_n1d6_behavior",
        "physical_harness.policies.services.gr00t_n1d6_robocasa",
        "physical_harness.policies.services.lerobot_pi05_robotwin",
        "physical_harness.policies.services.openpi_robodojo",
        "physical_harness.policies.services.openpi_robodojo_native",
    }
    for entry in modules:
        path = Path(entry["path"])
        if entry["module"].startswith("physical_harness."):
            path.relative_to(package / "src")
            compare(path.relative_to(source_root), entry["sha256"])
        else:
            path.relative_to(Path(manifest["environment"]))

    cases = {}
    for component, record, expected_count in (
        ("device-owner", device, 6), ("session-owner", session, 4),
        ("worker-transport", transport, 16),
    ):
        assert len(record["cases"]) == expected_count, f"Incomplete runtime evidence: {component}"
        sources = record["sources"]
        assert len(sources) == {"device-owner": 4, "session-owner": 7, "worker-transport": 5}[component]
        identities = sources.items() if isinstance(sources, dict) else (
            (entry["path"], entry["sha256"]) for entry in sources
        )
        for path, sha256 in identities:
            compare(path, sha256)
        if component == "worker-transport":
            assert record["schemaVersion"] == "edh.worker_transport_cpu.v1"
            assert record["sourceHashesUnchanged"] is True and record["cudaVisibleDevices"] == ""
            assert record["nativeWorkerProcesses"] == expected_count
            for field in ("environmentAllocationPerformed", "modelInferencePerformed", "physicalControlPerformed"):
                assert record[field] is False
            assert len({case["name"] for case in record["cases"]}) == expected_count
            for case in record["cases"]:
                assert type(case["pid"]) is int and case["pid"] > 0
                assert type(case["code"]) is int and case["signal"] is None
        else:
            for field in ("unobservedErrors", "gpuJobs", "modelCalls", "policyCalls", "nativeEnvironmentAllocations", "controls"):
                assert type(record[field]) is int and record[field] == 0
            for case in record["cases"]:
                owner = case["owner"]
                assert owner["closed"] is True and owner["stopped"] is True and owner["closing"] is False
                for field in ("pending_owner_operations", "retained_cancelled_operations", "pending_cancelled_operations", "executed_actions", "uncertain_actions", "raw_sim_steps"):
                    assert type(owner[field]) is int and owner[field] == 0
            if component == "session-owner":
                assert type(record["recordedFrames"]) is int and record["recordedFrames"] == 0
                assert all(case["recordingJournalClosed"] is True and case["recordingFrames"] == 0 for case in record["cases"])
        cases[component] = expected_count
    assert tools["schemaVersion"] == "edh.core_tools_cpu.v2"
    assert tools["journalSha256"] == inputs[6]["sha256"]
    assert tools["writerReleased"] is True and tools["hostDisposed"] is True
    assert tools["agentsDisposed"] is True
    for field in ("environmentAllocationPerformed", "modelInferencePerformed", "physicalControlPerformed"):
        assert tools[field] is False
    assert len(tools["sources"]) == 20
    assert len({entry["path"] for entry in tools["sources"]}) == 20
    for entry in tools["sources"]:
        compare(Path(entry["path"]).relative_to(source_root), entry["sha256"])
    expected_tools = {
        "write-original-source": False, "read-private-source": False,
        "search-private-source": False, "write-empty-content": False,
        "update-current-version": False, "persist-question-and-conclude-turn": False,
        "same-call-question-identity": False, "additional-parameter": True,
        "string-version": True, "unsafe-version": True, "version-conflict": True,
        "invalid-private-path": True, "oversized-content": True,
        "caller-abort-before-write": True, "conflicting-question-identity": True,
    }
    assert len(tools["checks"]) == len(expected_tools)
    assert {case["name"]: case["isError"] for case in tools["checks"]} == expected_tools
    for case in tools["checks"]:
        assert type(case["isError"]) is bool
        if not case["isError"]:
            assert case["concludesTurn"] is (case["name"] in {
                "persist-question-and-conclude-turn", "same-call-question-identity",
            })
    expected_extensions = {
        "detached-factory-input": False, "constructor-binding": False,
        "toString-binding": False, "core-id-before-factory": True,
        "core-alias-before-factory": True, "reserved-name-before-factory": True,
        "invalid-id-before-factory": True, "mismatched-native-name": True,
        "detached-native-schemas": False, "private-scope-source-length": False,
        "independent-scope-source-length": False, "constructor-source-length": False,
        "toString-source-length": False, "native-invalid-arguments": True,
        "native-caller-cancellation": True, "foreign-scope-tool": True,
        "released-scope-tool": True, "remaining-scope-operational": False,
        "released-all-scopes": True,
    }
    assert len(tools["extensionChecks"]) == len(expected_extensions)
    assert {case["name"]: case["rejected"] for case in tools["extensionChecks"]} == expected_extensions
    assert all(type(case["rejected"]) is bool for case in tools["extensionChecks"])
    assert type(tools["factoryCalls"]) is int and tools["factoryCalls"] == 5
    assert type(tools["extensionReads"]) is int and tools["extensionReads"] == 5
    first_length = len(source_bytes("harness/agent-runtime/tools/src/core-definition.ts")) + 1
    second_length = len(source_bytes("harness/agent-runtime/tools/src/extension-definition.ts"))
    expected_outcomes = [
        ("source__length", first_length, None),
        ("source__length", second_length, None),
        ("constructor", first_length, None),
        ("toString", first_length, None),
        ("source__length", None, "INVALID_ARGS"),
        ("source__length", None, "ABORTED_BEFORE_DISPATCH"),
        ("constructor", None, "UNKNOWN_TOOL"),
        ("source__length", None, "UNKNOWN_TOOL"),
        ("source__length", second_length, None),
        ("source__length", None, "UNKNOWN_TOOL"),
    ]
    assert len(tools["extensionOutcomes"]) == len(expected_outcomes)
    for actual, (name, value, code) in zip(tools["extensionOutcomes"], expected_outcomes, strict=True):
        assert actual == {"name": name, "value": value, "errorCode": code, "isError": code is not None}
        if value is not None:
            assert type(actual["value"]) is int
    cases["agent-tools"] = len(expected_tools) + len(expected_extensions)
    assert plans["schemaVersion"] == "edh.task_plans_cpu.v1"
    assert plans["journalSha256"] == inputs[8]["sha256"]
    assert plans["writerReleased"] is True
    for field in ("environmentAllocationPerformed", "modelInferencePerformed", "physicalControlPerformed"):
        assert plans[field] is False
    assert len(plans["sources"]) == 11
    assert len({entry["path"] for entry in plans["sources"]}) == 11
    for entry in plans["sources"]:
        compare(Path(entry["path"]).relative_to(source_root), entry["sha256"])
    catalog = json.loads(source_bytes("examples/tasks/robodojo-build-tower.json"))
    assert plans["catalogRevision"] == catalog["revision"]
    assert plans["configuredGoal"] == catalog["tasks"]["build_tower"]["goal"]
    assert plans["storedPlanVersion"] == 2
    compact = plans["compaction"]
    assert compact["compacted"] is True
    assert compact["before"]["records"] == compact["after"]["records"] == 1
    assert compact["before"]["sequence"] == compact["after"]["sequence"] == 2
    assert compact["after"]["supersededBytes"] == 0
    assert compact["reclaimedBytes"] > 0
    expected_plans = {
        "configured-initial-template": False, "persist-configured-plan": False,
        "read-only-next-template": False, "foreign-owner-template": True,
        "stale-plan-write": True, "completion-without-verdict": True,
        "changed-final-criterion": True, "abandoned-final-goal": True,
        "publish-next-version": False, "reopen-versioned-plan": False,
        "compacted-version": False,
        **{f"read-{name}": name != "original-plan" for name in plan_read_names},
    }
    assert len(plans["checks"]) == len(expected_plans)
    assert all(type(case["rejected"]) is bool for case in plans["checks"])
    assert {case["name"]: case["rejected"] for case in plans["checks"]} == expected_plans
    admissions = plans["readAdmissions"]
    assert len(admissions) == len(plan_read_names)
    for name, admission, saved in zip(plan_read_names, admissions, inputs[9:], strict=True):
        assert admission["name"] == name
        assert Path(admission["journalPath"]) == Path("read") / name / "records.jsonl"
        assert admission["journalSha256"] == saved["sha256"]
        assert admission["journalUnchanged"] is True and admission["writerReleased"] is True
    cases["task-plans"] = len(expected_plans)
    retry_directory = runtime / "model-retry"
    retry_report_path = retry_directory / "acceptance.json"
    retry = json.loads(retry_report_path.read_bytes())
    assert retry["schemaVersion"] == "edh.model_retry.cpu.v2"
    assert retry["listenerClosed"] is True and retry["agentsReleased"] is True
    for field in ("gpuAllocationCount", "modelResponseCount", "simulatorAllocationCount"):
        assert type(retry[field]) is int and retry[field] == 0
    protocols = ("chat_completions", "responses")
    modes = ("bounded", "fractional", "jitter", "disabled", "independent", "next-turn", "cancel", "dispose", "always-cancel", "team")
    assert len(retry["checks"]) == len(protocols) * len(modes) == 20
    assert {case["name"] for case in retry["checks"]} == {f"{protocol}:{mode}" for protocol in protocols for mode in modes}
    assert len(retry["sources"]) == len({entry["path"] for entry in retry["sources"]}) == 36
    for entry in retry["sources"]:
        compare(Path(entry["path"]).relative_to(source_root), entry["sha256"])
    retry_paths = [retry_report_path]
    native_sessions = {}
    assert len(retry["journals"]) == 22
    assert len({entry["sessionId"] for entry in retry["journals"]}) == 22
    for entry in retry["journals"]:
        file = Path(entry["file"])
        assert file.name == str(file) and file.suffix == ".json"
        saved = retry_directory / file
        assert identity(saved)["sha256"] == entry["sha256"]
        events = json.loads(saved.read_bytes())
        assert len(events) == entry["eventCount"]
        assert [event["seq"] for event in events] == list(range(len(events)))
        native_sessions[entry["sessionId"]] = events
        retry_paths.append(saved)
    chain_ids = set()
    for protocol in protocols:
        for mode in modes:
            case = next(case for case in retry["checks"] if case["name"] == f"{protocol}:{mode}")
            waiting = mode in ("cancel", "dispose", "always-cancel")
            turns = 2 if mode == "next-turn" else 1
            sessions = 2 if mode == "independent" else 1
            requests = 1 if waiting or mode == "disabled" else 3 * turns
            assert case["requests"] == requests * sessions and case["sessions"] == sessions
            assert case["modelResponseCount"] == 0 and case["expectedFailure"] == "TRANSPORT"
            if waiting:
                assert 0 <= case["elapsedMs"] < 3000
            if waiting or mode == "fractional":
                status = case["waitingHistory"]
                assert status["eventCount"] > status["archivedBefore"] > 0
                assert status["residentEvents"] == status["eventCount"] - status["archivedBefore"] == 1
                assert 0 < status["residentBytes"] <= 1024
            selected = [entry for entry in retry["journals"] if entry["file"] == f"{protocol}-{mode}-{entry['sessionId']}.json"]
            assert len(selected) == sessions
            for entry in selected:
                events = native_sessions[entry["sessionId"]]
                attempts = [event for event in events if event["type"] == "assistant/attempt"]
                scheduled = [event for event in events if event["type"] == "llm/retry"]
                started = [event for event in events if event["type"] == "llm/retry-started"]
                ended = [event for event in events if event["type"] == "turn/end"]
                assert len(attempts) == requests and len(ended) == turns
                assert not any(event["type"] in ("assistant/message", "tool/call", "tool/result") for event in events)
                for attempt in attempts:
                    stream = attempt["data"]["stream"]
                    assert len(stream) == 1 and stream[0]["type"] == "chunk"
                    chunk = stream[0]["chunk"]
                    assert chunk["type"] == "finish" and chunk["reason"]["kind"] == "error"
                    assert chunk["reason"]["failure"]["code"] == "TRANSPORT"
                assert len(scheduled) == (1 if waiting else 0 if mode == "disabled" else 2 * turns)
                assert len(started) == (0 if waiting else len(scheduled))
                assert all(event["data"]["reason"]["kind"] == ("aborted" if waiting else "error") for event in ended)
                for event in scheduled:
                    data = event["data"]
                    assert data["failure"]["code"] == "TRANSPORT" and data["provider"] == "local"
                    assert data["mode"] == ("always" if mode == "always-cancel" else "normal")
                    if data["mode"] == "normal":
                        assert data["maxRetries"] == 2
                for index in range(turns) if not waiting and scheduled else ():
                    pair = scheduled[index * 2:index * 2 + 2]
                    assert [event["data"]["retry"] for event in pair] == [1, 2]
                    delays = [event["data"]["delayMs"] for event in pair]
                    if mode == "jitter":
                        assert 4.5 <= delays[0] <= 5.5 and 9 <= delays[1] <= 10
                    else:
                        assert delays == ([5.25, 10.5] if mode == "fractional" else [5, 10])
                    chain = pair[0]["data"]["retryId"]
                    assert chain == pair[1]["data"]["retryId"] and chain not in chain_ids
                    chain_ids.add(chain)
                for scheduled_event, started_event in zip(scheduled, started):
                    assert scheduled_event["seq"] < started_event["seq"]
                    assert all(scheduled_event["data"][field] == started_event["data"][field] for field in ("retryId", "turn", "step", "retry"))
    assert len(retry["traces"]) == 2
    for trace in retry["traces"]:
        file = Path(trace["file"])
        assert file.name == str(file) and file.suffix == ".json"
        saved = retry_directory / file
        assert identity(saved)["sha256"] == trace["sha256"]
        observed = [event for event in json.loads(saved.read_bytes()) if event["type"] == "agent.model-retry"]
        events = native_sessions[trace["sessionId"]]
        assert len(observed) == 4
        for event in observed:
            detail = event["detail"]
            native = events[detail["sessionSequence"]]
            assert detail["sessionId"] == trace["sessionId"] and detail["member"] == "lead"
            assert detail["type"] == native["type"] and detail["data"] == native["data"]
        retry_paths.append(saved)
    history = retry["history"]
    assert history["journalPath"] == "history/records.jsonl"
    journal_path = retry_directory / history["journalPath"]
    assert identity(journal_path)["sha256"] == history["journalSha256"]
    assert not (journal_path.parent / "writer.lock").exists()
    assert history["referencePolicy"] == "edh-native-payload-sources-v5"
    assert history["journalUnchanged"] is True and history["writerReleased"] is True and history["reopened"] is True
    assert len(history["sessions"]) == 22
    assert {item["sessionId"] for item in history["sessions"]} == set(native_sessions)
    assert len({(item["runId"], item["assignmentId"]) for item in history["sessions"]}) == 22
    assert type(history["payloadAdmissions"]) is int
    assert history["payloadAdmissions"] >= sum(len(events) for events in native_sessions.values())
    invalid_names = ("negative-delay", "nonfinite-delay", "nan-delay", "timer-overflow", "retry-over-budget", "missing-normal-budget", "always-normal-budget", "unknown-mode", "unknown-field")
    assert len(history["rejectedPayloadInputs"]) == 18
    assert set(history["rejectedPayloadInputs"]) == {f"{protocol}:{name}" for protocol in protocols for name in invalid_names}
    for item in history["sessions"]:
        assert item["eventCount"] == len(native_sessions[item["sessionId"]])
        assert item["eventCount"] > item["archivedBefore"] > 0
        assert item["residentEvents"] == item["eventCount"] - item["archivedBefore"] == 1
        assert 0 < item["residentBytes"] <= 1024
    retry_paths.append(journal_path)
    files.extend(retry_paths)
    inputs.extend(identity(path) for path in retry_paths)
    cases["model-retry"] = len(retry["checks"])
    assert [identity(path) for path in files] == inputs, "CPU evidence changed during inspection."
    output.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "schemaVersion": "edh.cpu_runtime_evidence.v5",
        "sourceRevision": revision,
        "checker": identity(Path(__file__)),
        "inputs": inputs, "sourceComparisons": comparisons,
        "distributions": len(manifest["distributions"]), "imports": len(modules), "cases": cases,
        "scope": "Actual CPU installation/runtime artifact consistency and exact Git source identities; native model and physical-task acceptance remain separate.",
    }
    with output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, allow_nan=False, indent=2)
        stream.write("\n")
    print(json.dumps({"sourceRevision": revision, "sourceComparisons": len(comparisons), "distributions": result["distributions"], "imports": len(modules), "cases": cases, "output": str(output)}))


if __name__ == "__main__":
    main()
