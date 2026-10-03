import argparse
from datetime import datetime, timedelta
from hashlib import sha256
import json
import math
from pathlib import Path
import subprocess

from physical_harness.validation import ContractValidator


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit_retained_terminal_executions(run, events, samples, request_directory, episode_root, schema_path):
    selected = [status for status in run["executions"] if status["control_steps"] == 0]
    if not selected:
        return []
    require(all(value is not None for value in (samples, request_directory, episode_root, schema_path)),
            "Zero-control terminal admission requires original native samples, requests and episode sources.")
    from physical_harness.environments.robodojo.audit import audit_native_physics
    validator = ContractValidator.from_path(schema_path)
    sample_by_sequence = {sample["sequence"]: sample for sample in samples}
    require(len(sample_by_sequence) == len(samples), "Native sample identities are duplicated.")
    zero_ids = {status["execution_id"] for status in selected}
    for path in request_directory.rglob("*.json"):
        record = json.loads(path.read_text(encoding="utf-8"))
        identity = record.get("execution_id", record.get("segment", {}).get("execution_id"))
        require(identity not in zero_ids, "An already-ended execution issued a policy request or native action.")
    reports = []
    previous = None
    retained_native = None
    retained_images = None
    for status in run["executions"]:
        validator.parse("ExecutionStatus", status)
        if status["control_steps"] and status["stop_reason"] != "episode_terminated":
            previous, retained_native, retained_images = status, None, None
            continue
        updates = [event for event in events if event["type"] == "execution.updated"
                   and event["detail"]["execution"]["execution_id"] == status["execution_id"]]
        require(updates and updates[-1]["detail"]["execution"] == status,
                "Execution export differs from its final original event.")
        final_sample = sample_by_sequence[updates[-1]["detail"]["sensorSequence"]]
        validator.parse("EvidenceRef", final_sample["evidence"])
        require(final_sample["source"] == run["source"] and
                final_sample["evidence"]["task_scope"] == status["task_scope"] and
                final_sample["evidence"]["id"] in status["observation_refs"] and
                final_sample["visualization"]["provider"] == "robodojo" and final_sample["images"],
                "Retained terminal admission requires identified original native boundary cameras.")
        images = {image["name"]: image for image in final_sample["images"]}
        require(len(images) == len(final_sample["images"]) == 3,
                "Retained RoboDojo boundary requires all three distinct native cameras.")
        if status["control_steps"]:
            metadata = final_sample["visualization"]
            receipt_path = request_directory / status["execution_id"] / metadata["policyRequestId"] / (
                metadata["segmentId"] + ".json")
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            validator.parse("ActionSegment", receipt["segment"])
            validator.parse("ActionReceipt", receipt["receipt"])
            require(receipt["schema_version"] == "edh.native_policy_receipt.v1" and
                    receipt["segment"]["execution_id"] == status["execution_id"] and
                    receipt["segment"]["task_scope"] == status["task_scope"] and
                    receipt["control_index"] == status["control_steps"] and
                    receipt["uncertain_actions"] == 0 and receipt["native_step"]["episode_terminated"] is True and
                    status["state"] == "ended" and status["device_confirmed"] and
                    status["stop_reason"] == "episode_terminated",
                    "Zero-control admission requires a prior actual native terminal action receipt.")
            retained_native = receipt["native_step"]["native_physics"]
            native_source = audit_native_physics(episode_root, retained_native, receipt["segment"]["actions"][0],
                                               receipt["native_step"]["raw_sim_steps"])
            retained_images = images
            previous = status
            continue
        require(previous is not None and retained_native is not None and status["state"] == "ended" and
                status["device_confirmed"] is True and status["stop_reason"] == "episode_terminated" and
                status["policy_calls"] == status["raw_sim_steps"] == 0 and status["state_version"] == 1 and
                len(updates) == 1 and status["boundary_event_id"] != previous["boundary_event_id"] and
                status["clock_id"] == previous["clock_id"] and status["task_scope"] != previous["task_scope"] and
                images == retained_images,
                "Already-ended execution must publish a fresh zero-action boundary over unchanged native cameras.")
        candidates = [path for path in episode_root.rglob(retained_native["episode_id"]) if path.is_dir()]
        require(len(candidates) == 1, "Retained terminal native episode source is ambiguous.")
        episode = candidates[0]
        summary_path, reset_path = episode.parent / "summary.json", episode.parent / "reset.json"
        summary, reset = (json.loads(path.read_text(encoding="utf-8")) for path in (summary_path, reset_path))
        require(summary["episode_id"] == reset["episode_id"] == retained_native["episode_id"] and
                reset["step_id"] == 0 and summary["step_id"] == retained_native["step_id"] and
                summary["complete"] is True and summary["valid_for_success_rate"] is True and
                (summary["terminated"] is True or summary["truncated"] is True) and
                sum(item["control_steps"] for item in run["executions"]) == summary["step_id"],
                "Closed retained episode contains a reset or additional unidentified controls.")
        require([path.name for path in sorted(episode.glob("action_*.json"))] ==
                [f"action_{index:06d}.json" for index in range(summary["step_id"])],
                "Retained native action history contains a missing or additional control.")
        statuses = []
        last_monotonic = -1
        for position, path in enumerate(sorted(episode.glob("episode_status_*.json"))):
            record = json.loads(path.read_text(encoding="utf-8"))
            require(path.name == f"episode_status_{position:06d}.json" and
                    record["schema_version"] == "edh.robodojo.episode_status.v1" and
                    record["audit_position"] == position and record["episode_id"] == retained_native["episode_id"] and
                    type(record["monotonic_ns"]) is int and record["monotonic_ns"] > last_monotonic and
                    record["physical_steps"] == 0 and
                    record["native_physics_step_before"] == record["native_physics_step_after"] and
                    record["simulation_time_before_s"] == record["simulation_time_after_s"],
                    "Original native terminal status history changed identity, counters or time.")
            last_monotonic = record["monotonic_ns"]
            instant = datetime.fromisoformat(record["recorded_at"].replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(status["recorded_at"].replace("Z", "+00:00"))
            if not end_time - timedelta(seconds=status["elapsed_wall_time_s"]) <= instant <= end_time:
                continue
            observation = episode / "observations" / f"{summary['step_id']:06d}.npz"
            require(record["step_id"] == record["native_control_counter"] == summary["step_id"] and
                    record["native_end_flag"] is True and
                    (record["terminated"] is True or record["truncated"] is True) and
                    record["truncated"] == (record["native_control_counter"] >= record["native_step_limit"]) and
                    all(record[key] == summary[key] for key in ("terminated", "truncated", "success")) and
                    record["native_success_flag"] == summary["native_success"] and
                    record["native_physics_step_after"] == retained_native["native_physics_step_after"] and
                    record["simulation_time_after_s"] == retained_native["simulation_time_s"] and
                    record["physics_count_source"] == retained_native["physics_count_source"] and
                    record["physics_timestep_s"] == retained_native["physics_timestep_s"] and
                    record["observation_sha256"] == sha256(observation.read_bytes()).hexdigest() and
                    (episode.parent / record["observation_path"]).resolve() == observation.resolve() and
                    record["physics_provenance_sha256"] == native_source["physicsProvenanceSha256"],
                    "Fresh terminal preflight differs from the retained actual native episode.")
            statuses.append({"path": str(path), "sha256": sha256(path.read_bytes()).hexdigest()})
        require(statuses, "Zero-control boundary has no fresh native terminal preflight record.")
        checks = [event["detail"] for event in events if event["type"] == "verification.checked" and
                  event["detail"]["evidence"]["task_scope"] == status["task_scope"]]
        require(len(checks) == 1, "Already-ended execution requires one fresh independent formal native check.")
        checked_sample = next(sample for sample in samples if sample["evidence"]["id"] == checks[0]["evidence"]["id"])
        require({image["name"]: image for image in checked_sample["images"]} == retained_images,
                "Fresh formal check changed the retained native terminal observation.")
        reports.append({"executionId": status["execution_id"], "boundaryId": status["boundary_event_id"],
                        "actualControls": 0, "policyCalls": 0, "nativePhysicsSteps": 0,
                        "nativeSource": native_source, "nativeStatusRecords": statuses,
                        "summarySha256": sha256(summary_path.read_bytes()).hexdigest(),
                        "resetSha256": sha256(reset_path.read_bytes()).hexdigest(),
                        "currentNativeSuccess": summary["native_success"], "retainedCameraIdentity": True})
        previous = status
    return reports


def audit_native_videos(run, directory, retained_terminal_ids):
    frames = {}
    videos = []
    for status in run["executions"]:
        execution_id = status["execution_id"]
        recording = directory / execution_id
        manifest = json.loads((recording / "manifest.json").read_text(encoding="utf-8"))
        journal = [json.loads(line) for line in (recording / "frames.jsonl").read_text(encoding="utf-8").splitlines()]
        if execution_id in retained_terminal_ids:
            require(not journal and manifest == {"frames": 0, "cameras": [], "timeline": "native simulation time",
                    "origin_simulation_time_s": None, "last_simulation_time_s": -1.0} and
                    not list(recording.glob("*.mp4")),
                    "Authentic zero-control terminal execution must retain its original empty video journal.")
            continue
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


def conventional_policy_sources(run, request_directory, service_log, policy_manifest, schema_path):
    validator = ContractValidator.from_path(schema_path)
    manifest = json.loads(policy_manifest.read_text(encoding="utf-8"))
    pinned = manifest["upstream"]
    if manifest["id"] == "gr00t-n1d6-behavior-r1pro":
        require(pinned["embodiment_tag"] == "BEHAVIOR_R1_PRO" and
                manifest["action"]["control_mode"] == "behavior.r1pro_native" and
                manifest["action"]["native_channels"] == 23 and manifest["action"]["horizon"] == 32,
                "The BEHAVIOR policy manifest has an incompatible native controller binding.")
        embodiment_id = "behavior.r1pro"
    else:
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
        if manifest["id"] == "gr00t-n1d6-behavior-r1pro" and "model_actions" in record:
            raw = record["model_actions"]
            require(record.get("native_action_conversion") == "omnigibson-r1pro-controller-clipping-v1" and
                    len(raw) == 32 and len(actions) == min(request["max_actions"], 32),
                    "BEHAVIOR model horizon or controller conversion differs from its native binding.")
            for predicted, action in zip(raw[:len(actions)], actions, strict=True):
                require(len(predicted) == 23 and all(type(value) in (int, float) and math.isfinite(value)
                        for value in predicted), "BEHAVIOR original model action dimensions or values differ.")
                require(action == [min(channel["maximum"], max(channel["minimum"], value))
                                   for value, channel in zip(predicted, channels, strict=True)],
                        "BEHAVIOR action differs from the original native controller limits.")
        requests[request_id] = request
    provenance = {"checkpointRevision": pinned["checkpoint_revision"], "checkpointPath": checkpoint_path,
                  "policyImplementationSource": implementation_source,
                  "checkpointDigest": digest, "checkpointWeightSha256": weights,
                  "policyServiceLogSha256": sha256(service_log.read_bytes()).hexdigest()}
    return provider, inferences, requests, provenance


def audit_learned_policy(run, events, samples, request_directory, service_log, policy_manifest, schema_path,
                         native_frames=None, openpi_profile=None, robodojo_episode_root=None):
    require(all(value is not None for value in (samples, request_directory, service_log, schema_path)),
            "Learned-policy acceptance requires native samples, requests, service log and wire schema.")
    require((policy_manifest is not None) != (openpi_profile is not None),
            "Learned-policy acceptance requires exactly one conventional manifest or explicit OpenPI inventory profile.")
    validator = ContractValidator.from_path(schema_path)
    if openpi_profile is not None:
        from physical_harness.policies.openpi_audit import task_sources
        inferences, requests, provenance = task_sources(
            run, request_directory, openpi_profile["bridge_directory"], service_log,
            openpi_profile["native_log"], openpi_profile["verification"], validator,
            openpi_profile["policy_id"],
        )
        provider = "robodojo"
    else:
        provider, inferences, requests, provenance = conventional_policy_sources(
            run, request_directory, service_log, policy_manifest, schema_path,
        )
    native_physics_sources = []
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
                    ("request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")) and
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
                sample["evidence"]["id"] in status["observation_refs"] and
                (recorded["native_step"]["observation_id"] == metadata["observationId"] or
                 status["state"] == "ended" and status["device_confirmed"]),
                "Actual native receipt physics counts or post-action/stopped observation identity differ.")
        if provider == "robodojo" and robodojo_episode_root is not None:
            from physical_harness.environments.robodojo.audit import audit_native_physics
            native_physics_sources.append(audit_native_physics(
                robodojo_episode_root, recorded["native_step"]["native_physics"], action, raw_steps,
            ))
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
            "reportedNativeSteps": physics,
            "nativePhysicsSteps": physics if provider != "robodojo" or native_physics_sources else None,
            "nativePhysicsSourceAudit": native_physics_sources, **provenance,
            "uncommittedInferenceRequests": sorted(set(inferences) - set(committed)),
            }


def audit_role_completion(run, events):
    require(run["state"] in {"succeeded", "failed", "unknown"},
            "Clean role completion requires a model-completed task outcome.")
    require(not any(event["type"] in {"tool.failed", "agent.deadline"} for event in events),
            "Clean role completion requires successful tool calls and no role deadline.")
    calls = {}
    completed = []
    owner_todos = None
    terminals = {"agent.report", "verification.submit", "tasks.finish", "tasks.abandon"}
    for event in events:
        detail = event["detail"]
        if event["type"] == "dsh.tool-call":
            calls[detail["data"]["callId"]] = detail
        elif event["type"] == "dsh.tool-result":
            require(not detail["data"].get("error") and not any(
                block.get("isError") for block in detail["data"]["message"]["content"]
                if block["type"] == "tool-result"), "A native DSH tool result contains an error.")
        elif event["type"] == "agent.todos" and detail["assignmentId"] == run["decisionAssignmentId"]:
            owner_todos = detail["todos"]
        elif event["type"] == "tool.completed" and detail["tool"] in terminals:
            call = calls[detail["callId"]]
            identity = (call["assignmentId"], call["turn"], call["data"]["step"])
            require(not any(candidate["type"] == "agent.step-started" and
                            candidate["detail"]["assignmentId"] == identity[0] and
                            candidate["detail"]["turn"] == identity[1] and
                            candidate["detail"]["step"] > identity[2] for candidate in events),
                    "A role started another model step after its terminal tool.")
            ended = [candidate for candidate in events if candidate["type"] == "agent.turn-ended" and
                     candidate["detail"]["assignmentId"] == identity[0] and candidate["detail"]["turn"] == identity[1]]
            require(len(ended) == 1 and ended[0]["sequence"] > event["sequence"] and
                    ended[0]["detail"]["reason"]["kind"] == "completed",
                    "A terminal tool lacks one completed native turn with its committed receipt.")
            receipts = [candidate for candidate in events if candidate["type"] == "dsh.tool-result" and
                        candidate["detail"]["assignmentId"] == identity[0] and
                        candidate["detail"]["turn"] == identity[1] and
                        candidate["detail"]["data"]["message"]["source"].get("callId") == detail["callId"]]
            require(len(receipts) == 1 and event["sequence"] < receipts[0]["sequence"] < ended[0]["sequence"],
                    "The terminal native receipt must commit before the completed turn.")
            if detail["tool"] == "tasks.finish":
                require(owner_todos is not None and all(todo["status"] == "completed" for todo in owner_todos),
                        "The decision owner finished with incomplete TODOs.")
            completed.append({"tool": detail["tool"], "assignmentId": identity[0], "turn": identity[1],
                              "step": identity[2], "toolSequence": event["sequence"],
                              "receiptSequence": receipts[0]["sequence"], "endSequence": ended[0]["sequence"]})
    terminal_tool = "tasks.finish" if run["state"] == "succeeded" else "tasks.abandon"
    require(any(row["tool"] == "verification.submit" for row in completed) and
            any(row["tool"] == terminal_tool for row in completed), "Required formal and task completion tools are absent.")
    return {"status": "passed", "taskOutcome": run["state"], "terminalTools": completed,
            "ownerTodoCount": len(owner_todos) if owner_todos is not None else 0,
            "allOwnerTodosCompleted": owner_todos is not None and all(
                todo["status"] == "completed" for todo in owner_todos),
            "nativeToolErrors": 0, "postTerminalModelSteps": 0}


def audit(run, events, *, samples=None, request_directory=None, service_log=None, policy_manifest=None,
          schema_path=None, simulation_videos=None, openpi_profile=None, robodojo_episode_root=None):
    require(run["source"] in {"simulation", "hardware"}, "Acceptance requires a real run source.")
    require(run["state"] in {"succeeded", "failed", "cancelled", "unknown", "interrupted"},
            "Acceptance requires a terminal run.")
    require(len(events) == run["eventCount"], "The exported event count differs from the run.")
    assignments = {}
    sessions = set()
    executions = {}
    requests = {}
    terminal_reviews = {}
    running_reviews = {}
    running_review_count = 0
    verification_boundaries = set()
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
                        {"policy_stop", "planner_stop", "episode_terminated", "budget_exhausted"},
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
                if "control_generation" in prior:
                    require("control_generation" in status and
                            status["control_generation"] >= prior["control_generation"],
                            "Native execution control generation regressed.")
                require(prior["state"] != "ended", "Native execution published after its immutable end.")
            executions[status["execution_id"]] = status
            controls += status["control_steps"] - (prior["control_steps"] if prior else 0)
        elif kind == "message.delivered" and detail["payload"].get("kind") == "running-review":
            payload = detail["payload"]
            status, sample, cadence = (payload[key] for key in ("execution", "sample", "cadence"))
            require(status == executions.get(status["execution_id"]) and status["state"] == "running" and
                    "control_generation" in status, "Planner review lacks its current admitted native generation.")
            owner = assignments[detail["recipient"]]
            request = next(item for item in run["requests"] if
                           item["goal_id"] == status["task_scope"]["goal_id"] and
                           item["attempt_id"] == status["task_scope"]["attempt_id"])
            require(detail["sender"] == "execution-monitor" and owner["id"] == run["decisionAssignmentId"] and
                    request["owner_assignment_id"] == owner["id"] and
                    request["decision_owner_id"] == owner["sessionId"] and
                    sample["evidence"]["task_scope"] == status["task_scope"] and
                    sample["evidence"]["visibility"] == "agent" and detail["images"] == sample["images"] and
                    bool(detail["images"]), "Planner review differs from its owner or authorized native images.")
            require(cadence["enabled"] is True and type(cadence["controlStepInterval"]) is int and
                    1 <= cadence["controlStepInterval"] <= 1_000_000 and
                    type(cadence["wallTimeIntervalMs"]) is int and
                    1000 <= cadence["wallTimeIntervalMs"] <= 3_600_000,
                    "Planner review cadence is invalid.")
            identity = (status["execution_id"], status["control_generation"])
            earlier = running_reviews.get(identity)
            if earlier:
                prior_status, prior_time, prior_cadence = earlier
                require(cadence == prior_cadence and
                        status["control_steps"] - prior_status["control_steps"] >= cadence["controlStepInterval"] and
                        (current_time - prior_time).total_seconds() * 1000 >= cadence["wallTimeIntervalMs"],
                        "Planner review exceeded its admitted control/time cadence.")
            running_reviews[identity] = (status, current_time, cadence)
            running_review_count += 1
        elif kind == "execution.end-requested":
            status = executions.get(detail["executionId"])
            require(status is not None and status["state_version"] == detail["stateVersion"] and
                    status["state"] in {"running", "pausing", "paused"},
                    "Terminal review must reference the current admitted execution version.")
            require(detail["assignmentId"] == run["decisionAssignmentId"] and
                    isinstance(detail["reason"], str) and detail["reason"].strip(),
                    "Terminal review requires the decision owner and its stated reason.")
            owner = assignments[detail["assignmentId"]]
            request = next(item for item in run["requests"] if
                           item["goal_id"] == status["task_scope"]["goal_id"] and
                           item["attempt_id"] == status["task_scope"]["attempt_id"])
            require(request["owner_assignment_id"] == owner["id"] and
                    request["decision_owner_id"] == owner["sessionId"] and
                    request.get("recovery_id") == status["task_scope"].get("recovery_id"),
                    "Terminal review must retain the admitted current decision ownership and scope.")
            terminal_reviews[detail["executionId"]] = detail
        elif kind == "verification.requested":
            status = executions[detail["executionId"]]
            require(status["state"] == "ended" and status["device_confirmed"] and
                    status["stop_reason"] in {"policy_stop", "planner_stop", "episode_terminated", "budget_exhausted"},
                    "Formal verification began without an eligible confirmed end boundary.")
            require(status["boundary_event_id"] == detail["boundaryId"], "Verification boundary changed.")
            if status["stop_reason"] == "planner_stop":
                require(detail["executionId"] in terminal_reviews,
                        "Planner stop requires an actual prior authorized terminal review.")
            identity = (detail["executionId"], detail["boundaryId"])
            require(identity not in verification_boundaries, "A stopped boundary started another Verifier.")
            verification_boundaries.add(identity)
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
    retained_terminals = (audit_retained_terminal_executions(
        run, events, samples, request_directory, robodojo_episode_root, schema_path) if simulation_videos else [])
    native_frames, videos = audit_native_videos(run, simulation_videos, {
        item["executionId"] for item in retained_terminals}) if simulation_videos else (None, [])
    if run["state"] == "succeeded":
        require(any(event["type"] == "run.succeeded" for event in events), "No successful task event exists.")
        require(controls > 0 and (frames > 0 or native_frames), "Success requires real controls and native frames.")
        mode = run["configuration"]["launchProfile"]["executionMode"]
        if mode == "policy":
            require(not policy_sequences, "Learned-only execution contains a DSH policy Session.")
            learned = audit_learned_policy(run, events, samples, request_directory, service_log, policy_manifest,
                                           schema_path, native_frames, openpi_profile, robodojo_episode_root)
            require(learned["nativeActionReceipts"] == controls, "Learned receipt/control counts differ.")
        else:
            require(mode in {"direct", "hybrid"} and policy_sequences,
                    "Direct/hybrid success requires independent actual DSH policy Session telemetry.")
    elif policy_manifest is not None or openpi_profile is not None:
        require(run["configuration"]["launchProfile"]["executionMode"] == "policy" and not policy_sequences,
                "Explicit learned-source acceptance requires learned-only policy execution.")
        learned = audit_learned_policy(run, events, samples, request_directory, service_log, policy_manifest,
                                      schema_path, native_frames, openpi_profile, robodojo_episode_root)
        require(learned["nativeActionReceipts"] == controls, "Learned receipt/control counts differ.")
    return {"runId": run["id"], "source": run["source"], "state": run["state"],
            "checkedEvents": len(events), "independentUpperSessions": len(sessions),
            "executionPolicySessions": len(policy_sequences), "executedControls": controls,
            "recordedSimulatorFrames": frames, "formalVerdicts": len(verdicts),
            "runningPlannerReviews": running_review_count, "terminalReviewRequests": len(terminal_reviews),
            "workerRecordedFrames": sum(len(group) for group in native_frames.values()) if native_frames else 0,
            "workerVideos": videos,
            "retainedTerminalExecutions": retained_terminals,
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
    parser.add_argument("--openpi-checkpoint-verification", type=Path)
    parser.add_argument("--openpi-bridge-audit", type=Path)
    parser.add_argument("--openpi-native-service-log", type=Path)
    parser.add_argument("--openpi-policy-id")
    parser.add_argument("--robodojo-episode-root", type=Path)
    parser.add_argument("--simulation-videos", type=Path)
    parser.add_argument("--require-clean-role-completion", action="store_true")
    parser.add_argument("--schema-path", type=Path,
                        default=Path(__file__).resolve().parents[1] / "harness/contracts/schema/physical.schema.json")
    args = parser.parse_args()
    openpi_arguments = (args.openpi_checkpoint_verification, args.openpi_bridge_audit,
                        args.openpi_native_service_log, args.openpi_policy_id)
    require(not any(value is not None for value in openpi_arguments) or
            all(value is not None for value in openpi_arguments),
            "OpenPI task audit requires checkpoint verification, bridge audit, native service log and admitted policy ID.")
    openpi_profile = ({"verification": args.openpi_checkpoint_verification,
                       "bridge_directory": args.openpi_bridge_audit,
                       "native_log": args.openpi_native_service_log, "policy_id": args.openpi_policy_id}
                      if args.openpi_checkpoint_verification is not None else None)
    run = json.loads((args.export / "source/run.json").read_text(encoding="utf-8"))
    events = json.loads((args.export / "source/events.json").read_text(encoding="utf-8"))
    samples = json.loads(args.sensor_samples.read_text(encoding="utf-8")) if args.sensor_samples else None
    report = audit(run, events, samples=samples, request_directory=args.policy_requests,
                   service_log=args.policy_service_log, policy_manifest=args.policy_manifest,
                   schema_path=args.schema_path, simulation_videos=args.simulation_videos,
                   openpi_profile=openpi_profile, robodojo_episode_root=args.robodojo_episode_root)
    if args.require_clean_role_completion:
        report["roleCompletion"] = audit_role_completion(run, events)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
