import argparse
from functools import partial
import hashlib
import json
import os
from pathlib import Path
import socket
import time
from uuid import UUID

from physical_harness.policies.openpi_checkpoint import verify_arx_x5_normalization, verify_checkpoint
from physical_harness.policies.provenance import validate_checkpoint_sha256


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--checkpoint-sha256", type=validate_checkpoint_sha256)
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--verification-output", required=True, type=Path)
    parser.add_argument("--port", type=int, default=18830)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535.")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        if os.name == "posix":
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("127.0.0.1", args.port))
        start_native_service(args, listener)


def start_native_service(args, listener):
    checkpoint = args.checkpoint.resolve(strict=True)
    verified = verify_checkpoint(checkpoint, args.inventory)
    expected_sha256 = (
        "fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7"
        if args.checkpoint_sha256 is None else args.checkpoint_sha256
    )
    if verified["checkpoint_sha256"] != expected_sha256:
        raise ValueError("Checkpoint SHA256 differs from the configured identity.")
    if args.checkpoint_sha256 is None and (
            verified["revision"] != "35efbc7dedfdbeeb6e95fb749bd885d73d483e41" or len(verified["files"]) != 18):
        raise ValueError("The default RoboDojo inference checkpoint requires the pinned 18-file revision.")
    normalization = verify_arx_x5_normalization(checkpoint)
    normalization_record = next(item for item in verified["files"] if item["path"] == normalization["path"])
    if (normalization["sha256"] != normalization_record["sha256"]
            or normalization["bytes"] != normalization_record["bytes"]):
        raise ValueError("ARX X5 normalization differs from the verified checkpoint inventory.")
    verified["normalization"] = normalization
    args.verification_output.parent.mkdir(parents=True, exist_ok=True)
    args.verification_output.write_text(json.dumps(verified, indent=2) + "\n", encoding="utf-8")
    import jax
    import numpy as np
    from openpi.policies import policy_config
    from openpi.serving.websocket_policy_server import WebsocketPolicyServer, _health_check
    from openpi.training import config
    from openpi_client.base_policy import BasePolicy
    from websockets.asyncio.server import serve

    from physical_harness.policies.action_outputs import read_action_array
    from physical_harness.policies.openpi_model_input import prepare_model_input
    from physical_harness.policies.openpi_model_output import decode_model_actions

    class BoundPolicyServer(WebsocketPolicyServer):
        async def run(self):
            async with serve(self._handler, sock=listener, compression=None,
                             max_size=None, process_request=_health_check) as server:
                await server.serve_forever()

    class IdentifiedPolicy(BasePolicy):
        def __init__(self, policy, identity):
            self.policy = policy
            self.identity = identity
            self.index = 0
            self.metadata = {**identity, "inferences": 0}

        def infer(self, observation):
            started = time.monotonic()
            request_id = observation["edh_request_id"]
            if not isinstance(request_id, str) or str(UUID(request_id)) != request_id:
                raise ValueError("OpenPI inference requires a canonical EDH request UUID.")
            model_observation = {name: value for name, value in observation.items() if name != "edh_request_id"}
            prompt = model_observation["prompt"]
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError("OpenPI inference requires its original nonempty instruction.")
            output = self.policy.infer(model_observation)
            actions = read_action_array(output["actions"], dimensions=(50, 14),
                                        source="ARX X5 OpenPI inference", float32=True)
            identity = {**self.identity, "inference_index": self.index, "source_request_id": request_id,
                        "instruction_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
                        "elapsed_s": time.monotonic() - started,
                        "state_sha256": hashlib.sha256(np.asarray(observation["state"], dtype=np.float32).tobytes()).hexdigest(),
                        "camera_sha256": {name: hashlib.sha256(np.asarray(image).tobytes()).hexdigest()
                                          for name, image in observation["images"].items()}}
            self.index += 1
            self.metadata["inferences"] = self.index
            print(json.dumps({"event": "native_policy_inference", **identity}, allow_nan=False), flush=True)
            return {**output, "actions": actions, "policy_identity": identity}

    devices = jax.devices()
    if len(devices) != 1 or devices[0].platform != "gpu":
        raise RuntimeError("RoboDojo OpenPI requires exactly one explicitly selected GPU.")
    name = "pi05_base_aloha_full_sim_arx-x5_seed_0"
    trained = policy_config.create_trained_policy(config.get_config(name), checkpoint)
    trained._input_transform = partial(prepare_model_input, transform=trained._input_transform)
    trained._output_transform = partial(decode_model_actions, transform=trained._output_transform)
    source_directory = Path(policy_config.__file__).resolve(strict=True).parents[1]
    source_hashes = {
        str(path.relative_to(source_directory)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(source_directory.rglob("*.py"))
    }
    if not source_hashes:
        raise RuntimeError("The imported OpenPI implementation has no inspectable Python sources.")
    source_digest = hashlib.sha256(
        json.dumps(source_hashes, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    identity = {"request_identity_version": "edh.openpi.request_identity.v1",
                "checkpoint_sha256": verified["checkpoint_sha256"], "config": name,
                "backend": "OpenPI/JAX", "checkpoint_revision": verified["revision"],
                "checkpoint_path": str(checkpoint),
                "policy_source_directory": str(source_directory),
                "policy_source_files_sha256": source_hashes, "policy_source_sha256": source_digest,
                "action_horizon": 50, "action_dim": 14,
                "gripper_semantics": "continuous_0_closed_1_open"}
    policy = IdentifiedPolicy(trained, identity)
    print(json.dumps({"service": "openpi-robodojo-native", "port": args.port, **identity}), flush=True)
    BoundPolicyServer(policy, host="127.0.0.1", port=args.port,
                      metadata=policy.metadata).serve_forever()


if __name__ == "__main__":
    main()
