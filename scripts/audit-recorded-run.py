import argparse
from datetime import datetime
from hashlib import sha256
import json
import math
from pathlib import Path
import subprocess

from physical_harness.validation import ContractValidator


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit_native_videos(run, directory):
    frames = {}
    videos = []
    for status in run["executions"]:
        execution_id = status["execution_id"]
        recording = directory / execution_id
        manifest = json.loads((recording / "manifest.json").read_text(encoding="utf-8"))
        journal = [json.loads(line) for line in (recording / "frames.jsonl").read_text(encoding="utf-8").splitlines()]
        require(journal and len(journal) == manifest["frames"] and manifest["cameras"] and
                manifest["timeline"] == "native simulation time", "Native video manifest lacks its complete frame journal.")
        origin = journal[0]["simulation_time_s"]
        require(origin == manifest["origin_simulation_time_s"] and
                journal[-1]["simulation_time_s"] == manifest["last_simulation_time_s"],
                "Native video manifest differs from recorded simulation time.")
        previous_time = -1.0
        for frame in journal:
            require(frame["execution_id"] == execution_id and frame["task_scope"] == status["task_scope"] and
                    math.isfinite(frame["simulation_time_s"]) and frame["simulation_time_s"] > previous_time and
                    frame["pts_us"] == round((frame["simulation_time_s"] - origin) * 1_000_000),
                    "Native video frame identity or simulator timestamp differs from its execution.")
            group = frames.setdefault(frame["segment_id"], [])
            require(not group or frame["native_step_index"] > group[-1]["native_step_index"],
                    "Native video segment frame indices are unordered.")
            group.append(frame)
            previous_time = frame["simulation_time_s"]
        for camera in manifest["cameras"]:
            require(Path(camera).name == camera and camera not in {".", ".."}, "Invalid recorded camera name.")
            video = recording / f"{camera}.mp4"
            decoded = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                      "frame=best_effort_timestamp_time", "-of", "json", str(video)],
                                     check=True, capture_output=True, text=True)
            timestamps = [float(item["best_effort_timestamp_time"]) for item in json.loads(decoded.stdout)["frames"]]
            require(len(timestamps) == len(journal), "Native video decoded frame count differs from its journal.")
            error = max(abs(timestamp - frame["pts_us"] / 1_000_000)
                        for timestamp, frame in zip(timestamps, journal, strict=True))
            require(error <= 0.000002, "Native MP4 timestamps differ from recorded simulation time.")
            subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"],
                           check=True, capture_output=True)
            videos.append({"executionId": execution_id, "camera": camera, "frames": len(journal),
                           "maxTimestampErrorS": error, "sha256": sha256(video.read_bytes()).hexdigest()})
    require(frames, "Native video acceptance requires actual recorded frames.")
    return frames, videos


def audit_learned_policy(run, events, samples, request_directory, service_log, policy_manifest, schema_path,
                         native_frames=None):
    require(all(value is not None for value in (samples, request_directory, service_log, policy_manifest)),
            "Learned-policy acceptance requires native samples, requests, service log and pinned manifest.")
    validator = ContractValidator.from_path(schema_path)
    manifest = json.loads(policy_manifest.read_text(encoding="utf-8"))
    pinned = manifest["upstream"]
    embodiment_id = manifest["action"]["action_spec"]["embodiment_id"]
    provider = embodiment_id.split(".", 1)[0]
    require(provider in {"robotwin", "robocasa", "behavior"},
            "The pinned learned manifest has no admitted native provider.")
    hashes = pinned["checkpoint_files_sha256"]
    digest = sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    weights = {name: value for name, value in hashes.items() if name.endswith((".safetensors", ".bin"))}
    require(weights and run["configuration"]["launchProfile"]["policy"] == manifest["id"],
            "The admitted policy differs from its pinned checkpoint manifest.")
    records = [json.loads(line) for line in service_log.read_text(encoding="utf-8").splitlines()
               if line.startswith("{")]
    startups = [record for record in records if record.get("service") == manifest["id"]
                and record.get("checkpoint_digest") == digest
                and record.get("checkpoint_revision") == pinned["checkpoint_revision"]
                and record.get("checkpoint_weight_sha256") == weights]
    require(len(startups) == 1, "The learned service lacks one matching pinned checkpoint startup.")
    checkpoint_path = startups[0]["checkpoint"]
    require(isinstance(checkpoint_path, str) and Path(checkpoint_path).is_absolute(),
            "The learned checkpoint has no identified actual service path.")
    implementation_source = startups[0].get("policy_source", startups[0].get("source", ""))
    require(isinstance(implementation_source, str) and pinned["policy_revision"] in implementation_source,
            "The learned service implementation lacks its pinned policy source revision.")
    inferences = {}
    for record in records:
        if record.get("event") != "policy_inference_completed" or record.get("task_scope", {}).get("task_id") != run["id"]:
            continue
        require(record["request_id"] not in inferences, "A learned inference request was recorded twice.")
        require(record.get("checkpoint_digest") == digest and
                record.get("checkpoint_revision") == pinned["checkpoint_revision"] and
                record.get("checkpoint_weight_sha256") == weights and record.get("checkpoint") == checkpoint_path,
                "Learned checkpoint identity changed during the actual task.")
        inferences[record["request_id"]] = record
    require(inferences, "The policy service has no identified inference for this task.")
    requests = {}
    for request_id, record in inferences.items():
        request = json.loads((request_directory / f"{request_id}.json").read_text(encoding="utf-8"))
        validator.parse("PolicyRequest", request)
        require(request["action_spec"]["embodiment_id"] == embodiment_id,
                "The native PolicyRequest differs from its pinned learned embodiment.")
        admitted = [item for item in run["requests"] if all(
            item[key] == request["task_scope"][key] for key in ("task_id", "goal_id", "attempt_id"))]
        require(len(admitted) == 1 and request["instruction"] == admitted[0]["instruction"],
                "The learned PolicyRequest instruction differs from its admitted task instruction.")
        require(all(request[key] == record[key] for key in
                    ("request_id", "execution_id", "task_scope", "generation", "observation_id")),
                "Learned inference does not match its actual native PolicyRequest.")
        actions = record["actions"]
        require(0 < len(actions) <= request["max_actions"], "Learned response exceeds its actual inference ticket.")
        channels = request["action_spec"]["channels"]
        for action in actions:
            require(len(action) == len(channels) and all(
                type(value) in (int, float) and channel["minimum"] <= value <= channel["maximum"]
                for value, channel in zip(action, channels, strict=True)),
                "Learned service actions violate the admitted native ActionSpec.")
        if manifest["id"] == "lerobot-pi05-robotwin-aloha-agilex":
            raw = record["model_actions"]
            require(len(raw) == len(actions), "RoboTwin model/native action counts differ.")
            for predicted, action in zip(raw, actions, strict=True):
                require(len(predicted) == 14 and len(action) == 14 and
                        all(type(value) in (int, float) and math.isfinite(value) for value in predicted),
                        "RoboTwin original model action dimensions or values differ.")
                require(action == [min(1, max(0, value)) if index in (6, 13) else value
                                   for index, value in enumerate(predicted)],
                        "RoboTwin gripper conversion changed its original model arm targets.")
        requests[request_id] = request
    by_sequence = {}
    for sample in samples:
        validator.parse("EvidenceRef", sample["evidence"])
        require(sample["source"] == run["source"] and sample["evidence"]["task_scope"]["task_id"] == run["id"],
                "A native sensor sample belongs to another task or source.")
        require(sample["sequence"] not in by_sequence, "Native sensor sample sequences are duplicated.")
        by_sequence[sample["sequence"]] = sample
    prior = {}
    segments = {}
    committed = {}
    physics = 0
    for event in events:
        if event["type"] != "execution.updated":
            continue
        status = event["detail"]["execution"]
        previous = prior.get(status["execution_id"])
        count = status["control_steps"] - (previous["control_steps"] if previous else 0)
        prior[status["execution_id"]] = status
        if not count:
            continue
        require(count == 1, "Learned acceptance requires each actual native action receipt.")
        sample = by_sequence[event["detail"]["sensorSequence"]]
        metadata = sample["visualization"]
        request_id, segment_id = metadata["policyRequestId"], metadata["segmentId"]
        require(segment_id not in segments, "An actual native segment was committed twice.")
        request = requests[request_id]
        require(request["execution_id"] == status["execution_id"] and request["task_scope"] == status["task_scope"] and
                sample["evidence"]["task_scope"] == status["task_scope"] and
                metadata["uncertainActions"] == 0 and metadata["provider"] == provider,
                "Learned native receipt differs from its admitted task, provider or confirmed counts.")
        index = committed.get(request_id, 0)
        action = json.loads(metadata["actionValues"])
        require(action == inferences[request_id]["actions"][index],
                "Native receipt action differs from the actual learned response prefix.")
        recorded = json.loads((request_directory / status["execution_id"] / request_id /
                               f"{segment_id}.json").read_text(encoding="utf-8"))
        require(recorded["schema_version"] == "edh.native_policy_receipt.v1",
                "Actual native receipt recording has an unsupported schema.")
        segment, receipt = recorded["segment"], recorded["receipt"]
        validator.parse("ActionSegment", segment)
        validator.parse("ActionReceipt", receipt)
        require(all(segment[key] == request[key] for key in
                    ("request_id", "execution_id", "task_scope", "generation", "observation_id", "action_spec")) and
                all(receipt[key] == segment[key] for key in ("execution_id", "generation", "segment_id")) and
                segment["segment_id"] == segment_id and segment["actions"] == [action] and
                receipt["executed_actions"] == recorded["native_step"]["executed_actions"] == count and
                recorded["control_index"] == status["control_steps"] and recorded["uncertain_actions"] == 0,
                "Actual native segment/receipt generation, action or control count differs from its inference ticket.")
        raw_steps = status["raw_sim_steps"] - (previous["raw_sim_steps"] if previous else 0)
        require(raw_steps > 0 and raw_steps == metadata["nativeRawSimSteps"],
                "Native receipt physics steps differ from cumulative actual execution counts.")
        require(recorded["native_step"]["raw_sim_steps"] == raw_steps and
                recorded["raw_sim_steps"] == status["raw_sim_steps"] and
                metadata["observationId"] in status["observation_refs"] and
                (recorded["native_step"]["observation_id"] == metadata["observationId"] or
                 status["state"] == "ended" and status["device_confirmed"]),
                "Actual native receipt physics counts or post-action/stopped observation identity differ.")
        require(sample["evidence"]["visibility"] == "agent", "Native action receipt has invalid evidence visibility.")
        if sample["images"]:
            require(len(sample["images"]) == len(request["observation"]["cameras"]),
                    "Native action receipt camera group differs from the policy observation.")
        else:
            require(native_frames and status["state"] == "running" and sample["evidence"]["kind"] == "event" and
                    sample["evidence"]["id"] == f'{metadata["observationId"]}:status:{status["state_version"]}',
                    "Metadata-only action receipt lacks identified native video evidence.")
        if native_frames is not None:
            recorded_frames = native_frames[segment_id]
            require(all(frame["policy_request_id"] == request_id and
                        frame["execution_id"] == status["execution_id"] and
                        frame["task_scope"] == status["task_scope"] and
                        0 < frame["native_step_index"] <= raw_steps for frame in recorded_frames),
                    "Worker-local native video differs from its actual admitted action receipt.")
        segments[segment_id] = {"request_id": request_id, "execution_id": status["execution_id"],
                                "raw_steps": raw_steps, "provider": metadata["provider"]}
        committed[request_id] = index + 1
        physics += raw_steps
    require(segments and set(committed) <= set(inferences),
            "An actual committed prefix lacks its identified learned inference source.")
    require(physics == sum(status["raw_sim_steps"] for status in prior.values()),
            "Native receipt physics steps differ from the complete execution event counters.")
    if native_frames is not None:
        require(set(native_frames) == set(segments), "Native video and actual action receipt segment sets differ.")
    for event in events:
        if event["type"] != "simulation.frame":
            continue
        detail = event["detail"]
        segment = segments[detail["segmentId"]]
        require(detail["policyRequestId"] == segment["request_id"] and
                detail["executionId"] == segment["execution_id"] and
                0 < detail["nativeStepIndex"] <= segment["raw_steps"] and
                detail["sample"]["visualization"]["provider"] == segment["provider"] and
                detail["sample"]["source"] == run["source"] and detail["sample"]["images"] and
                detail["sample"]["evidence"]["task_scope"] == prior[segment["execution_id"]]["task_scope"],
                "A native frame differs from its actual learned action receipt.")
    return {"identifiedLearnedRequests": len(inferences), "nativeActionReceipts": len(segments),
            "nativePhysicsSteps": physics, "checkpointRevision": pinned["checkpoint_revision"],
            "checkpointPath": checkpoint_path, "policyImplementationSource": implementation_source,
            "uncommittedInferenceRequests": sorted(set(inferences) - set(committed)),
            "checkpointDigest": digest, "checkpointWeightSha256": weights,
            "policyServiceLogSha256": sha256(service_log.read_bytes()).hexdigest()}


def audit(run, events, *, samples=None, request_directory=None, service_log=None, policy_manifest=None,
          schema_path=None, simulation_videos=None):
    require(run["source"] in {"simulation", "hardware"}, "Acceptance requires a real run source.")
    require(run["state"] in {"succeeded", "failed", "cancelled", "unknown", "interrupted"},
            "Acceptance requires a terminal run.")
    require(len(events) == run["eventCount"], "The exported event count differs from the run.")
    assignments = {}
    sessions = set()
    executions = {}
    requests = {}
    checked = {}
    verdicts = {}
    recoveries = {}
    policy_sequences = {}
    controls = 0
    frames = 0
    previous_time = None
    for sequence, event in enumerate(events, 1):
        require(event["sequence"] == sequence, "The event sequence is incomplete.")
        current_time = datetime.fromisoformat(event["at"].replace("Z", "+00:00"))
        require(previous_time is None or current_time >= previous_time, "Event time moved backwards.")
        previous_time = current_time
        kind, detail = event["type"], event["detail"]
        if kind == "agent.created":
            assignment = detail["assignment"]
            require(assignment["id"] not in assignments and assignment["sessionId"] not in sessions,
                    "Role assignments must have independent native Sessions.")
            require(assignment["brief"]["task_scope"]["task_id"] == run["id"],
                    "An assignment belongs to another task.")
            if "verification.submit" in detail["tools"]:
                matching = [status for status in executions.values()
                            if status["task_scope"] == assignment["brief"]["task_scope"]]
                require(matching and matching[-1]["state"] == "ended" and
                        matching[-1]["device_confirmed"] and matching[-1]["stop_reason"] in
                        {"policy_stop", "episode_terminated", "budget_exhausted"},
                        "A Verifier was created during an unfinished execution.")
            assignments[assignment["id"]] = {**assignment, "createdSequence": sequence}
            sessions.add(assignment["sessionId"])
        elif kind == "execution.updated":
            status = detail["execution"]
            require(status["task_scope"]["task_id"] == run["id"], "Execution belongs to another task.")
            prior = executions.get(status["execution_id"])
            if prior:
                require(status["state_version"] > prior["state_version"], "Execution version did not advance.")
                require(status["control_steps"] >= prior["control_steps"], "Control count decreased.")
                require(status["task_scope"] == prior["task_scope"], "Execution scope changed.")
            executions[status["execution_id"]] = status
            controls += status["control_steps"] - (prior["control_steps"] if prior else 0)
        elif kind == "verification.requested":
            status = executions[detail["executionId"]]
            require(status["state"] == "ended" and status["device_confirmed"] and
                    status["stop_reason"] in {"policy_stop", "episode_terminated", "budget_exhausted"},
                    "Formal verification began without an eligible confirmed end boundary.")
            require(status["boundary_event_id"] == detail["boundaryId"], "Verification boundary changed.")
            assignment = assignments[detail["assignmentId"]]
            require(assignment["brief"]["task_scope"] == status["task_scope"], "Verifier scope differs.")
            require(assignment["sessionId"] != assignments[run["decisionAssignmentId"]]["sessionId"],
                    "Verifier must use an independent Session.")
            require(detail["assignmentId"] not in requests, "A Verifier assignment was reused.")
            requests[detail["assignmentId"]] = detail
        elif kind == "verification.checked":
            require(detail["assignmentId"] in requests, "Formal facts preceded verification admission.")
            require(detail["evidence"]["task_scope"] ==
                    executions[requests[detail["assignmentId"]]["executionId"]]["task_scope"],
                    "Formal evidence belongs to another execution scope.")
            checked[detail["assignmentId"]] = detail
        elif kind == "verification.completed":
            result = detail["result"]
            assignment_id = result["verifier_assignment_id"]
            request = requests[assignment_id]
            facts = checked[assignment_id]
            require(result["execution_id"] == request["executionId"] and
                    result["boundary_event_id"] == request["boundaryId"] and
                    result["verifier_id"] == assignments[assignment_id]["sessionId"],
                    "Formal verdict identity differs from its assignment and stopped boundary.")
            require(result["checks"] == facts["facts"] and
                    facts["evidence"]["id"] in result["evidence_refs"], "Verdict facts differ from native checks.")
            execution_request = next(item for item in run["requests"] if
                                     item["goal_id"] == result["task_scope"]["goal_id"] and
                                     item["attempt_id"] == result["task_scope"]["attempt_id"])
            criterion = execution_request["success_contract"]
            require(result["goal_contract_id"] == criterion["id"] and
                    result["goal_contract_version"] == criterion["version"], "Verdict changed the task criterion.")
            if result["status"] == "passed":
                values = {item["check_id"]: item["value"] for item in result["checks"]}
                selected = [values[item["check_id"]] is True for item in criterion.get("all", criterion.get("any"))]
                require(all(selected) if "all" in criterion else any(selected),
                        "A successful verdict contradicts its native criterion facts.")
            require(result["verdict_id"] not in verdicts, "A verdict was published twice.")
            verdicts[result["verdict_id"]] = result
        elif kind == "recovery.opened":
            context = detail["context"]
            failed = context["failedVerdict"]
            require(failed == verdicts.get(failed["verdict_id"]) and failed["status"] == "failed",
                    "Recovery requires a previously accepted formal failed verdict.")
            require(context["ownerAssignmentId"] == run["decisionAssignmentId"] and
                    context["decision"] in {"retry", "replan"} and context["changes"] and
                    context["attemptSummary"].strip(), "Recovery requires an explicit Planner decision and context.")
            recoveries[detail["recoveryId"]] = detail
        elif kind == "recovery.resolved":
            recovery = recoveries[detail["recoveryId"]]
            result = verdicts[detail["verdictId"]]
            require(result["status"] == "passed" and
                    result["task_scope"]["goal_id"] == recovery["context"]["originalGoalId"] and
                    result["task_scope"]["recovery_id"] == detail["recoveryId"],
                    "Recovery resolution requires original-goal formal success.")
        elif kind.startswith("policy."):
            session_id = detail["sessionId"]
            require(session_id not in sessions, "Execution policy shares an upper role Session.")
            require(detail["sequence"] == policy_sequences.get(session_id, 0) + 1,
                    "Execution-policy event sequence is incomplete.")
            require(detail["executionId"] in executions and
                    detail["taskScope"] == executions[detail["executionId"]]["task_scope"],
                    "Execution-policy telemetry differs from its admitted execution.")
            policy_sequences[session_id] = detail["sequence"]
        elif kind == "simulation.frame":
            require(detail["executionId"] in executions and detail["policyRequestId"] and
                    detail["segmentId"] and detail["nativeStepIndex"] > 0,
                    "A recorded simulator frame has no admitted control identity.")
            frames += 1
        elif kind == "run.succeeded":
            result = verdicts[detail["verdictId"]]
            require(result["status"] == "passed", "Task completion requires formal success.")
    require(len(requests) == len(verdicts), "An admitted formal verification has no verdict.")
    learned = None
    native_frames, videos = audit_native_videos(run, simulation_videos) if simulation_videos else (None, [])
    if run["state"] == "succeeded":
        require(any(event["type"] == "run.succeeded" for event in events), "No successful task event exists.")
        require(controls > 0 and (frames > 0 or native_frames), "Success requires real controls and native frames.")
        mode = run["configuration"]["launchProfile"]["executionMode"]
        if mode == "policy":
            require(not policy_sequences, "Learned-only execution contains a DSH policy Session.")
            learned = audit_learned_policy(run, events, samples, request_directory, service_log, policy_manifest,
                                           schema_path, native_frames)
            require(learned["nativeActionReceipts"] == controls, "Learned receipt/control counts differ.")
        else:
            require(mode in {"direct", "hybrid"} and policy_sequences,
                    "Direct/hybrid success requires independent actual DSH policy Session telemetry.")
    return {"runId": run["id"], "source": run["source"], "state": run["state"],
            "checkedEvents": len(events), "independentUpperSessions": len(sessions),
            "executionPolicySessions": len(policy_sequences), "executedControls": controls,
            "recordedSimulatorFrames": frames, "formalVerdicts": len(verdicts),
            "workerRecordedFrames": sum(len(group) for group in native_frames.values()) if native_frames else 0,
            "workerVideos": videos,
            "recoveryChains": len(recoveries), "observedInvariants": "passed",
            "unobservedRecovery": not bool(recoveries), "learnedPolicy": learned}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sensor-samples", type=Path)
    parser.add_argument("--policy-requests", type=Path)
    parser.add_argument("--policy-service-log", type=Path)
    parser.add_argument("--policy-manifest", type=Path)
    parser.add_argument("--simulation-videos", type=Path)
    parser.add_argument("--schema-path", type=Path,
                        default=Path(__file__).resolve().parents[1] / "harness/contracts/schema/physical.schema.json")
    args = parser.parse_args()
    run = json.loads((args.export / "source/run.json").read_text(encoding="utf-8"))
    events = json.loads((args.export / "source/events.json").read_text(encoding="utf-8"))
    samples = json.loads(args.sensor_samples.read_text(encoding="utf-8")) if args.sensor_samples else None
    report = audit(run, events, samples=samples, request_directory=args.policy_requests,
                   service_log=args.policy_service_log, policy_manifest=args.policy_manifest,
                   schema_path=args.schema_path, simulation_videos=args.simulation_videos)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
