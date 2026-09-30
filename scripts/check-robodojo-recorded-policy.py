import argparse
import asyncio
import base64
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path
from time import monotonic
from uuid import uuid4

import numpy as np
from PIL import Image

from physical_harness.environments.robodojo import ACTION_SPEC, CAMERA_NAMES
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(args):
    fingerprint = json.loads(args.fingerprint.read_text(encoding="utf-8"))
    reset = json.loads(args.reset.read_text(encoding="utf-8"))
    cameras = {}
    with np.load(args.observation, allow_pickle=False) as source:
        for name in (*CAMERA_NAMES, "states"):
            values = source[name]
            actual = {"shape": list(values.shape), "dtype": str(values.dtype),
                      "sha256": hashlib.sha256(values.tobytes()).hexdigest()}
            if actual != fingerprint["fields"][name]:
                raise ValueError(f"Recorded native observation differs from its fingerprint: {name}")
            if name in CAMERA_NAMES:
                encoded = BytesIO()
                Image.fromarray(values).save(encoded, format="PNG")
                cameras[name] = {"mime_type": "image/png",
                                 "width": values.shape[1], "height": values.shape[0],
                                 "data_base64": base64.b64encode(encoded.getvalue()).decode("ascii")}
        states = source["states"].tolist()
        instruction = str(source["instruction"].item())
    if instruction != reset["instruction"] or reset["initial_state_hash"] != fingerprint["fields"]["states"]["sha256"]:
        raise ValueError("Recorded instruction or state differs from its native reset.")
    request = {
        "schema_version": "physical.policy_request.v1", "request_id": str(uuid4()),
        "execution_id": str(uuid4()),
        "task_scope": {"task_id": reset["metadata"]["task"], "goal_id": "recorded-inference", "attempt_id": "recorded-inference-1"},
        "generation": 0, "observation_id": f"{reset['episode_id']}:0",
        "instruction": instruction,
        "valid_until": (datetime.now(timezone.utc) + timedelta(seconds=args.timeout_s)).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "action_spec": deepcopy(ACTION_SPEC), "max_actions": 16,
        "observation": {"schema_version": "edh.policy_observation.v1",
                        "source_observation_id": f"{reset['episode_id']}:0",
                        "environment": "robodojo", "embodiment_id": ACTION_SPEC["embodiment_id"],
                        "cameras": cameras, "proprioception": {"states": states},
                        "control_context": {"instruction": instruction, "episode_id": reset["episode_id"], "step_id": 0}},
    }
    validator = ContractValidator.from_path(args.schema)
    validator.parse("PolicyRequest", request)
    client = WebSocketPolicyClient(args.policy_uri, validator, timeout_s=args.timeout_s)
    started = monotonic()
    try:
        response = await client.infer(request)
    finally:
        await client.close()
    report = {"scope": "Real checkpoint inference on retained native RoboDojo RGB and state; no device execution",
              "source_observation": str(args.observation), "source_episode_id": reset["episode_id"],
              "source_fields": fingerprint["fields"], "instruction": instruction,
              "elapsed_s": monotonic() - started, "action_count": len(response["actions"]),
              "request_id": request["request_id"], "response": response}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"response", "source_fields"}}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True, type=Path)
    parser.add_argument("--fingerprint", required=True, type=Path)
    parser.add_argument("--reset", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--policy-uri", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--timeout-s", type=float, default=600)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
