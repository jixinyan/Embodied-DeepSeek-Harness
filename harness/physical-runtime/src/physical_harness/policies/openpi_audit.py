import base64
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image

from physical_harness.validation import ContractValidator
from physical_harness.policies.client import validate_response


CHECKPOINT_REVISION = "35efbc7dedfdbeeb6e95fb749bd885d73d483e41"
CHECKPOINT_SHA256 = "fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7"
POLICY_SOURCE_REVISION = "bb9a0b5f5136a74503b679af830bfd0a3a837d5c"
CAMERAS = ("cam_high", "cam_left_wrist", "cam_right_wrist")
IDENTITY_FIELDS = ("checkpoint_sha256", "checkpoint_revision", "config", "backend",
                   "action_horizon", "action_dim", "gripper_semantics")
REQUEST_FIELDS = ("request_id", "execution_id", "task_scope", "generation", "observation_id")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def json_records(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("{")]


def checkpoint_identity(path: Path) -> tuple[dict, dict]:
    verification = json.loads(path.read_text(encoding="utf-8"))
    files = verification["files"]
    require(verification["revision"] == CHECKPOINT_REVISION and len(files) == 18,
            "RoboDojo OpenPI requires the pinned verified 18-file checkpoint revision.")
    require(files == sorted(files, key=lambda item: item["path"]) and
            len({item["path"] for item in files}) == len(files), "Checkpoint inventory paths are unordered or duplicated.")
    for item in files:
        name = Path(item["path"])
        require(not name.is_absolute() and ".." not in name.parts and
                (item["path"] == "_CHECKPOINT_METADATA" or name.parts[0] in {"params", "assets"}) and
                type(item["bytes"]) is int and item["bytes"] > 0 and
                re.fullmatch(r"[a-f0-9]{64}", item["sha256"]), "Checkpoint inventory entry is invalid.")
    digest = sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    require(digest == verification["checkpoint_sha256"] == CHECKPOINT_SHA256 and
            sum(item["bytes"] for item in files) == verification["bytes"],
            "Checkpoint inventory aggregate SHA256 or byte total differs from verification.")
    identity = {"checkpoint_sha256": digest, "checkpoint_revision": CHECKPOINT_REVISION,
                "config": "pi05_base_aloha_full_sim_arx-x5_seed_0", "backend": "OpenPI/JAX",
                "action_horizon": 50, "action_dim": 14, "gripper_semantics": "continuous_0_closed_1_open"}
    return identity, verification


def verify_identity(record: dict, identity: dict) -> None:
    require(all(record.get(name) == identity[name] for name in IDENTITY_FIELDS),
            "Actual OpenPI service or inference differs from its verified checkpoint/configuration identity.")
    for name in ("checkpoint_path", "policy_source_directory", "policy_source_files_sha256", "policy_source_sha256"):
        if name in identity:
            require(record.get(name) == identity[name], "Imported policy sources or checkpoint path changed.")


def service_sources(verification_path: Path, bridge_log: Path, native_log: Path) -> tuple[dict, dict, list[dict]]:
    identity, verification = checkpoint_identity(verification_path)
    bridge = json_records(bridge_log)
    native = json_records(native_log)
    bridge_start = [item for item in bridge if item.get("service") == "openpi-robodojo-json"]
    native_start = [item for item in native if item.get("service") == "openpi-robodojo-native"]
    require(len(bridge_start) == len(native_start) == 1,
            "OpenPI acceptance requires one identified native startup and one JSON bridge startup.")
    verify_identity(native_start[0], identity)
    source = native_start[0]
    source_fields = ("checkpoint_path", "policy_source_directory", "policy_source_files_sha256", "policy_source_sha256")
    if any(name in source for name in source_fields):
        require(all(name in source for name in source_fields), "Native policy source identity is incomplete.")
        require(isinstance(source["checkpoint_path"], str) and Path(source["checkpoint_path"]).is_absolute() and
                isinstance(source["policy_source_directory"], str) and Path(source["policy_source_directory"]).is_absolute(),
                "Native policy sources and checkpoint require absolute recorded paths.")
        hashes = source["policy_source_files_sha256"]
        require(isinstance(hashes, dict) and hashes, "Native policy sources have no file hashes.")
        for name, digest in hashes.items():
            require(isinstance(name, str) and name.endswith(".py") and not Path(name).is_absolute() and
                    ".." not in Path(name).parts and isinstance(digest, str) and re.fullmatch(r"[a-f0-9]{64}", digest),
                    "Native policy source file identity is invalid.")
        require(source["policy_source_sha256"] == sha256(
            json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
            "Imported OpenPI source file inventory differs from its aggregate SHA256.")
        identity.update({name: source[name] for name in source_fields})
    verify_identity(bridge_start[0]["metadata"], identity)
    require(bridge_start[0]["checkpoint_sha256"] == identity["checkpoint_sha256"] and
            bridge_start[0]["metadata"]["inferences"] == 0,
            "OpenPI bridge did not admit a fresh matching native service.")
    native_inferences = {}
    for item in native:
        if item.get("event") != "native_policy_inference":
            continue
        verify_identity(item, identity)
        index = item["inference_index"]
        require(type(index) is int and index == len(native_inferences), "Native OpenPI inference sequence is incomplete.")
        native_inferences[index] = item
    bridge_inferences = []
    seen_requests = set()
    for item in bridge:
        if item.get("event") != "policy_inference_completed":
            continue
        verify_identity(item, identity)
        index = item["inference_index"]
        require(type(index) is int and index == len(bridge_inferences) and index in native_inferences,
                "JSON bridge inference sequence differs from the actual native inference sequence.")
        require(item["request_id"] not in seen_requests, "OpenPI bridge inference request is duplicated.")
        source = native_inferences[index]
        require(all(source[name] == item[name] for name in ("state_sha256", "camera_sha256", "elapsed_s")),
                "JSON bridge input hashes or elapsed time differ from the actual native inference record.")
        require(type(item["elapsed_s"]) in (int, float) and np.isfinite(item["elapsed_s"]) and item["elapsed_s"] >= 0,
                "OpenPI native inference elapsed time is invalid.")
        verify_actions(item)
        seen_requests.add(item["request_id"])
        bridge_inferences.append(item)
    require(bridge_inferences, "OpenPI logs contain no identified completed inference.")
    return identity, verification, bridge_inferences


def verify_actions(record: dict) -> None:
    raw = np.asarray(record["raw_actions"], dtype=np.float32)
    actions = np.asarray(record["actions"], dtype=np.float32)
    require(raw.shape == actions.shape == (50, 14) and np.isfinite(raw).all() and np.isfinite(actions).all(),
            "Actual OpenPI inference requires finite original and transformed 50 by 14 action horizons.")
    transformed = raw.copy()
    transformed[:, [6, 13]] = np.clip(transformed[:, [6, 13]], 0, 1)
    require(record["gripper_transform"] == "native_continuous_opening_clamp_0_1" and
            np.array_equal(actions, transformed) and record["actions"] == transformed.tolist() and
            record["raw_actions"] == raw.tolist(),
            "OpenPI action conversion differs from its original float32 model horizon.")


def verify_request_inputs(request: dict, record: dict) -> None:
    observation = request["observation"]
    require(request["action_spec"]["embodiment_id"] == "robodojo.dual-arx-x5" and
            request["action_spec"]["control_mode"] == "robodojo.qpos_target" and
            len(request["action_spec"]["channels"]) == 14 and
            observation["source_observation_id"] == request["observation_id"],
            "OpenPI request differs from the native ARX X5 action or observation identity.")
    state = np.asarray(observation["proprioception"]["states"], dtype=np.float32)
    require(state.shape == (14,) and np.isfinite(state).all() and
            sha256(state.tobytes()).hexdigest() == record["state_sha256"],
            "OpenPI inference state hash differs from the actual admitted float32 state.")
    require(record["native_instruction"] == observation["control_context"]["instruction"],
            "OpenPI inference differs from its original native instruction.")
    require(set(observation["cameras"]) == set(record["camera_sha256"]) == set(CAMERAS),
            "OpenPI inference cameras differ from the admitted three-camera input.")
    for name in CAMERAS:
        camera = observation["cameras"][name]
        encoded = base64.b64decode(camera["data_base64"], validate=True)
        with Image.open(BytesIO(encoded)) as image:
            require(image.format == "PNG" and image.size == (camera["width"], camera["height"]),
                    "OpenPI request PNG bytes differ from their declared camera dimensions.")
            rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
        digest = sha256(np.transpose(rgb, (2, 0, 1)).tobytes()).hexdigest()
        require(digest == record["camera_sha256"][name], "OpenPI native camera hash differs from its actual admitted RGB.")


def task_sources(run: dict, request_directory: Path, bridge_directory: Path, bridge_log: Path,
                 native_log: Path, verification_path: Path, validator: ContractValidator,
                 policy_id: str) -> tuple[dict, dict, dict]:
    identity, verification, records = service_sources(verification_path, bridge_log, native_log)
    require(run["source"] == "simulation", "The selected RoboDojo OpenPI rollout profile requires an actual simulation source.")
    require(isinstance(policy_id, str) and policy_id.strip() and
            run["configuration"]["launchProfile"]["policy"] == policy_id,
            "The admitted run policy differs from the selected OpenPI RoboDojo profile.")
    require(run["configuration"]["launchProfile"]["checkpoint"] ==
            f"RoboDojo-sim-arx_x5-joint-0/59999@{identity['checkpoint_sha256'][:16]}",
            "The admitted checkpoint selection differs from the actual identified OpenPI checkpoint.")
    inferences, requests = {}, {}
    for record in records:
        if record.get("task_scope", {}).get("task_id") != run["id"]:
            continue
        request_id = record["request_id"]
        require(re.fullmatch(r"[a-f0-9-]+", request_id), "OpenPI request path identity is invalid.")
        request = json.loads((request_directory / f"{request_id}.json").read_text(encoding="utf-8"))
        bridge_request = json.loads((bridge_directory / f"{request_id}.request.json").read_text(encoding="utf-8"))
        inference = json.loads((bridge_directory / f"{request_id}.inference.json").read_text(encoding="utf-8"))
        validator.parse("PolicyRequest", request)
        require(request == bridge_request, "JSON bridge canonical PolicyRequest differs from the recorded worker request.")
        require(all(record[name] == inference[name] == request[name] for name in REQUEST_FIELDS),
                "OpenPI inference identity differs from the actual worker and bridge requests.")
        require(all(inference[name] == record[name] for name in (*identity, "inference_index", "state_sha256",
                    "camera_sha256", "native_instruction", "raw_actions", "actions", "gripper_transform", "elapsed_s")),
                "Retained OpenPI inference differs from its actual native/bridge log.")
        verify_request_inputs(request, record)
        actions = inference["admitted_actions"]
        require(actions == record["actions"][:request["max_actions"]] and actions,
                "OpenPI returned action prefix differs from its actual full model horizon and inference budget.")
        admitted = [item for item in run["requests"] if all(item[name] == request["task_scope"][name]
                    for name in ("task_id", "goal_id", "attempt_id"))]
        require(len(admitted) == 1 and request["instruction"] == admitted[0]["instruction"],
                "OpenPI task instruction differs from its admitted execution request.")
        response = {**{name: request[name] for name in (*REQUEST_FIELDS, "valid_until", "action_spec")},
                    "schema_version": "physical.action_chunk.v1", "actions": actions}
        validate_response(validator, request, response)
        requests[request_id] = request
        inferences[request_id] = {**record, "actions": actions}
    require(inferences, "OpenPI service has no identified completed inference for this actual task.")
    provenance = {"checkpointRevision": identity["checkpoint_revision"],
                  "checkpointPath": identity.get("checkpoint_path"),
                  "checkpointPathEvidence": "native service and inference records" if "checkpoint_path" in identity
                  else "not recorded by native service",
                  "policyImplementationSource": identity["config"],
                  "importedPolicySourceDirectory": identity.get("policy_source_directory"),
                  "importedPolicySourceSha256": identity.get("policy_source_sha256"),
                  "importedPolicySourceFileSha256": identity.get("policy_source_files_sha256"),
                  "declaredPolicySourceRevision": POLICY_SOURCE_REVISION,
                  "policySourceRevisionEvidence": "deployment source pin; absent from service telemetry",
                  "checkpointDigest": identity["checkpoint_sha256"],
                  "checkpointFileSha256": {item["path"]: item["sha256"] for item in verification["files"]},
                  "checkpointVerificationSha256": sha256(verification_path.read_bytes()).hexdigest(),
                  "policyServiceLogSha256": sha256(bridge_log.read_bytes()).hexdigest(),
                  "nativePolicyServiceLogSha256": sha256(native_log.read_bytes()).hexdigest(),
                  "inventoryProfile": "robodojo-openpi-18-file"}
    return inferences, requests, provenance


def retained_sources(verification_path: Path, bridge_log: Path, native_log: Path,
                     reports: tuple[Path, ...], validator: ContractValidator) -> dict:
    identity, verification, records = service_sources(verification_path, bridge_log, native_log)
    requests = {item["request_id"]: item for item in records}
    inspected = set()
    for path in reports:
        report = json.loads(path.read_text(encoding="utf-8"))
        response = report["response"]
        validator.parse("ActionChunk", response)
        request_id = report["request_id"]
        require(request_id not in inspected and request_id in requests,
                "Retained response has a duplicate or unidentified actual OpenPI request.")
        record = requests[request_id]
        require(response["request_id"] == request_id and response["execution_id"] == record["execution_id"] and
                report["action_count"] == len(response["actions"]) and
                response["actions"] == record["actions"][:report["action_count"]] and
                report["instruction"] == record["native_instruction"] and
                report["source_fields"]["states"]["sha256"] == record["state_sha256"],
                "Retained response prefix, original instruction or state identity differs from actual OpenPI inference.")
        inspected.add(request_id)
    require(inspected == set(requests), "Retained source audit requires each completed bridge inference response.")
    return {"scope": "Actual retained native/bridge inference records and checkpoint verification",
            "checkpointSHA256": identity["checkpoint_sha256"], "checkpointRevision": identity["checkpoint_revision"],
            "checkpointFiles": len(verification["files"]), "checkpointBytes": verification["bytes"],
            "completedInferences": len(records), "requestIds": sorted(inspected),
            "crossServiceInputHashes": "passed", "rawActionConversion": "passed", "retainedResponsePrefixes": "passed",
            "decodedPolicyRequestInputs": "unavailable in retained source reports",
            "nativeActionReceipts": 0, "taskCompletionAcceptance": False,
            "checkpointVerificationSHA256": sha256(verification_path.read_bytes()).hexdigest(),
            "bridgeServiceLogSHA256": sha256(bridge_log.read_bytes()).hexdigest(),
            "nativeServiceLogSHA256": sha256(native_log.read_bytes()).hexdigest()}
