import argparse
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path

import numpy as np
from PIL import Image

from physical_harness.environments.robodojo.audit import audit_native_physics
from physical_harness.policies.openpi_audit import (
    CAMERAS, REQUEST_FIELDS, json_records, require, verify_actions, verify_request_inputs,
)
from physical_harness.validation import ContractValidator


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def instant(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def audit(packet, schema_path):
    validator = ContractValidator.from_path(schema_path)
    first, second = packet["first"], packet["second"]
    first_id, second_id = first["run"]["id"], second["run"]["id"]
    end = second["end"]
    require(end["control_steps"] == end["policy_calls"] == end["raw_sim_steps"] == 0,
            "Terminal task requires zero controls, policy calls and native physics steps.")
    receipt_path = Path(packet["finalReceipt"])
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    require(receipt["schema_version"] == "edh.native_policy_receipt.v1",
            "The original successful native task has no identified actual control receipt.")
    segment = validator.parse("ActionSegment", receipt["segment"])
    validator.parse("ActionReceipt", receipt["receipt"])
    native = receipt["native_step"]["native_physics"]
    require(segment["task_scope"]["task_id"] == first_id
            and segment["execution_id"] == first["end"]["execution_id"]
            and receipt["control_index"] == first["end"]["control_steps"]
            and receipt["native_step"]["episode_terminated"] is True
            and receipt["uncertain_actions"] == 0,
            "The retained first-task final receipt differs from its successful episode boundary.")
    native_source = audit_native_physics(Path(packet["nativeEpisodeRoot"]), native,
                                       segment["actions"][0], receipt["native_step"]["raw_sim_steps"])
    candidates = [path for path in Path(packet["nativeEpisodeRoot"]).rglob(native["episode_id"])
                  if path.is_dir()]
    require(len(candidates) == 1, "The retained native episode source is ambiguous.")
    episode = candidates[0]
    reset_path, summary_path = episode.parent / "reset.json", episode.parent / "summary.json"
    reset = json.loads(reset_path.read_text(encoding="utf-8"))
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    require(reset["episode_id"] == summary["episode_id"] == native["episode_id"]
            and reset["step_id"] == 0 and summary["step_id"] == native["step_id"]
            and summary["native_success"] is True and summary["success"] is True
            and summary["terminated"] is True and summary["truncated"] is False
            and summary["complete"] is True and summary["valid_for_success_rate"] is True,
            "The closed native source does not retain the same successful episode.")
    require(sum(status["control_steps"] for status in first["run"]["executions"]) == summary["step_id"],
            "The retained native episode includes controls outside the first task.")
    actions = sorted(episode.glob("action_*.json"))
    observations = sorted((episode / "observations").glob("*.npz"))
    require([path.name for path in actions] == [f"action_{index:06d}.json"
                                               for index in range(summary["step_id"])]
            and [path.name for path in observations] == [f"{index:06d}.npz"
                                                        for index in range(summary["step_id"] + 1)],
            "Native action/observation sources include a missing or additional physical step.")
    final_observation = episode / "observations" / f"{summary['step_id']:06d}.npz"
    provenance_digest = digest(episode.parent / "physics-provenance.json")
    status_paths = sorted(episode.glob("episode_status_*.json"))
    require(status_paths, "Retained terminal acceptance requires actual native episode_status records.")
    selected = []
    previous_monotonic = -1
    for position, path in enumerate(status_paths):
        status = json.loads(path.read_text(encoding="utf-8"))
        require(path.name == f"episode_status_{position:06d}.json"
                and status["schema_version"] == "edh.robodojo.episode_status.v1"
                and status["audit_position"] == position and status["episode_id"] == native["episode_id"]
                and type(status["monotonic_ns"]) is int and status["monotonic_ns"] > previous_monotonic
                and status["physical_steps"] == 0
                and status["native_physics_step_before"] == status["native_physics_step_after"]
                and status["simulation_time_before_s"] == status["simulation_time_after_s"]
                and status["native_control_counter"] == status["step_id"]
                and status["physics_provenance_sha256"] == provenance_digest,
                "Actual native status history changed identity, counters or simulation time.")
        previous_monotonic = status["monotonic_ns"]
        recorded = instant(status["recorded_at"])
        if not instant(second["run"]["createdAt"]) <= recorded <= instant(second["run"]["updatedAt"]):
            continue
        require(status["step_id"] == summary["step_id"]
                and status["native_end_flag"] is True and status["native_success_flag"] is True
                and status["terminated"] is True and status["truncated"] is False
                and status["success"] is True
                and status["native_physics_step_after"] == native["native_physics_step_after"]
                and status["simulation_time_after_s"] == native["simulation_time_s"]
                and status["physics_count_source"] == native["physics_count_source"]
                and status["physics_timestep_s"] == native["physics_timestep_s"]
                and status["observation_sha256"] == digest(final_observation)
                and (episode.parent / status["observation_path"]).resolve() == final_observation.resolve(),
                "The second task did not inspect the unchanged successful native episode.")
        require(recorded <= instant(end["recorded_at"]),
                "The native terminal status did not precede the fresh execution boundary.")
        selected.append({"path": str(path), "sha256": digest(path), "position": position})
    require(selected, "The second task has no actual native terminal preflight in its timestamp scope.")

    image_checks = []
    with np.load(final_observation, allow_pickle=False) as captured:
        require(float(captured["simulation_time_s"]) == native["simulation_time_s"],
                "The final native observation time differs from its original action source.")
        for images in packet["imageSources"]:
            require(set(images) == set(CAMERAS), "Formal boundary evidence lacks all native cameras.")
            for camera, source in images.items():
                path = Path(source["path"])
                encoded = path.read_bytes()
                require(sha256(encoded).hexdigest() == source["sha256"],
                        "The original model-facing camera bytes changed during acceptance.")
                with Image.open(BytesIO(encoded)) as image:
                    require(image.format == "PNG", "Native terminal camera evidence requires actual PNG bytes.")
                    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
                require(np.array_equal(rgb, captured[camera][..., :3]),
                        "The second-task camera evidence differs from the retained final SDK observation.")
                image_checks.append({"camera": camera, "sha256": source["sha256"], "pixelsMatch": True})

    request_count, retained_inferences = 0, {}
    for path in Path(packet["policyRequestDirectory"]).rglob("*.json"):
        value = json.loads(path.read_text(encoding="utf-8"))
        schema = value.get("schema_version")
        if schema == "physical.policy_request.v1":
            request = validator.parse("PolicyRequest", value)
            require(request["task_scope"]["task_id"] != second_id,
                    "The already-ended task issued a new policy request.")
            request_count += request["task_scope"]["task_id"] == first_id
        elif schema == "edh.native_policy_receipt.v1":
            action = validator.parse("ActionSegment", value["segment"])
            require(action["task_scope"]["task_id"] != second_id,
                    "The already-ended task issued a native ActionSegment.")
        elif schema is None and path.name == f"{value.get('request_id')}.inference.json":
            request = validator.parse("PolicyRequest", json.loads(
                path.with_name(f"{value['request_id']}.request.json").read_text(encoding="utf-8")))
            require(request["task_scope"]["task_id"] != second_id,
                    "The already-ended task issued a recorded native inference.")
            require(all(value[name] == request[name] for name in REQUEST_FIELDS),
                    "Retained native inference belongs to a different PolicyRequest.")
            verify_actions(value)
            verify_request_inputs(request, value)
            require(value["admitted_actions"] == value["actions"][:request["max_actions"]]
                    and value["admitted_actions"] and value["request_id"] not in retained_inferences,
                    "Retained native inference has an invalid or duplicated admitted action prefix.")
            retained_inferences[value["request_id"]] = value
        else:
            raise ValueError(f"Unknown actual policy record schema: {path}")
    require(request_count > 0, "The first successful task has no actual retained policy requests.")
    policy_logs = []
    service_records = []
    for filename in (packet["bridgeServiceLog"], packet["nativePolicyServiceLog"]):
        path = Path(filename)
        records = json_records(path)
        require(records, "The actual policy service log has no structured records.")
        require(not any(item.get("task_scope", {}).get("task_id") == second_id for item in records),
                "The already-ended task reached an actual learned policy service.")
        policy_logs.append({"path": str(path), "sha256": digest(path), "secondTaskRequests": 0})
        service_records.append(records)
    bridge_inferences = [item for item in service_records[0]
                         if item.get("event") == "policy_inference_completed"]
    native_records = [item for item in service_records[1]
                      if item.get("event") == "native_policy_inference"]
    native_inferences = {item["inference_index"]: item for item in native_records}
    require(bridge_inferences and native_inferences,
            "Retained terminal acceptance requires actual prior learned-service activity.")
    require(len(native_inferences) == len(native_records)
            and [item["inference_index"] for item in native_records] == list(range(len(native_records))),
            "The original native inference log has duplicated or incomplete identities.")
    require(len({item["request_id"] for item in bridge_inferences}) == len(bridge_inferences),
            "The original bridge inference log has duplicated request identities.")
    for record in bridge_inferences:
        source = native_inferences[record["inference_index"]]
        require(all(source[name] == record[name] for name in
                    ("state_sha256", "camera_sha256", "elapsed_s", "checkpoint_sha256")),
                "The bridge inference does not identify its actual native service request.")
        require(record["request_id"] in retained_inferences,
                "The original bridge inference has no actual retained inference file.")
        retained = retained_inferences[record["request_id"]]
        require(all(record.get(name) == value for name, value in retained.items()
                    if name != "admitted_actions"),
                "The actual retained inference differs from its original bridge service log.")
    require(set(retained_inferences) == {record["request_id"] for record in bridge_inferences},
            "Retained policy files contain an additional unidentified native inference.")
    require(max(native_inferences) == max(item["inference_index"] for item in bridge_inferences),
            "The native policy has an additional unidentified inference after the last bridge request.")
    return {"episodeId": native["episode_id"], "nativeStepId": native["step_id"],
            "nativeSource": native_source, "resetSha256": digest(reset_path),
            "summarySha256": digest(summary_path), "currentNativeSuccess": True,
            "statusRecords": selected, "unchangedNativeCounter": native["native_physics_step_after"],
            "unchangedSimulationTimeS": native["simulation_time_s"],
            "modelFacingCameras": image_checks, "secondNativeActionRequests": 0,
            "secondPolicyRequests": 0, "policyLogs": policy_logs}


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
