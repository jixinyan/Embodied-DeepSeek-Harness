import argparse
from hashlib import sha256
import importlib.util
import json
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit(packet, schema_path):
    module_path = Path(__file__).with_name("audit-recorded-run.py")
    specification = importlib.util.spec_from_file_location("edh_recorded_native_audit", module_path)
    reader = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(reader)
    provider = packet["provider"]
    require(provider in {"robotwin", "behavior", "robocasa"}, "Unsupported retained provider terminal source.")
    first, second = packet["first"], packet["second"]
    require(first["run"]["state"] == second["run"]["state"] == "succeeded" and
            first["run"]["id"] != second["run"]["id"] and
            len(second["run"]["executions"]) == 1 and second["run"]["executions"][0] == second["end"],
            "Retained terminal source requires distinct actual successful tasks and one fresh terminal execution.")
    directory = Path(packet["policyRequestDirectory"])
    positive = reader.audit(first["run"], first["run"]["events"], samples=first["samples"],
                            request_directory=directory, service_log=Path(packet["nativePolicyServiceLog"]),
                            policy_manifest=Path(packet["policyManifest"]), schema_path=schema_path,
                            simulation_videos=Path(packet["simulationVideos"]))
    positive["roleCompletion"] = reader.audit_role_completion(first["run"], first["run"]["events"])
    require(positive["executedControls"] > 0 and positive["learnedPolicy"]["nativeActionReceipts"] > 0,
            "The prior task requires complete original learned-control and video acceptance.")
    prior_end = first["end"]
    require(first["run"]["executions"][-1] == prior_end,
            "The retained prior boundary differs from the actual final execution.")
    prior_sample = next(sample for sample in first["samples"]
                        if sample["evidence"]["id"] == prior_end["observation_refs"][0])
    terminal = reader.audit_recorded_provider_terminals(
        second["run"], second["run"]["events"], second["samples"], directory, schema_path, provider,
        prior_execution=(prior_end, prior_sample), retained_runs=[first["run"], second["run"]])
    require(len(terminal) == 1 and terminal[0]["currentNativeSuccess"] is True,
            "The new terminal task requires its current unchanged successful native predicate.")
    reader.audit_native_videos(second["run"], Path(packet["simulationVideos"]), {second["end"]["execution_id"]},
                              allow_terminal_only=True)
    service = Path(packet["nativePolicyServiceLog"])
    records = [json.loads(line) for line in service.read_text(encoding="utf-8").splitlines()
               if line.startswith("{")]
    require(not any(record.get("task_scope", {}).get("task_id") == second["run"]["id"] for record in records),
            "The already-ended task reached the original learned policy service.")
    completion = reader.audit_role_completion(second["run"], second["run"]["events"])
    camera_identities = [{camera: record["sha256"] for camera, record in images.items()}
                         for images in packet["imageSources"]]
    require(len(camera_identities) == 4 and all(value == camera_identities[0] for value in camera_identities),
            "Retained task boundary and formal checks changed original model-facing camera bytes.")
    for images in packet["imageSources"]:
        for source in images.values():
            require(sha256(Path(source["path"]).read_bytes()).hexdigest() == source["sha256"],
                    "Original retained native camera bytes changed during acceptance.")
    return {"provider": provider, "positiveTask": positive, "terminalTask": terminal[0],
            "terminalRoleCompletion": completion, "currentNativeSuccess": True,
            "policyServiceLogSha256": sha256(service.read_bytes()).hexdigest(),
            "modelFacingCameraSha256": camera_identities[0], "twoOriginalTaskHistories": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-records", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--schema-path", type=Path,
                        default=Path(__file__).resolve().parents[1] / "harness/contracts/schema/physical.schema.json")
    args = parser.parse_args()
    report = audit(json.loads(args.source_records.read_text(encoding="utf-8")), args.schema_path)
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
