import argparse
import hashlib
import json
from pathlib import Path
import time

import jax
import numpy as np
from openpi.policies import policy_config
from openpi.serving.websocket_policy_server import WebsocketPolicyServer
from openpi.training import config
from openpi_client.base_policy import BasePolicy

from physical_harness.policies.openpi_checkpoint import verify_checkpoint


class IdentifiedPolicy(BasePolicy):
    def __init__(self, policy, identity):
        self.policy = policy
        self.identity = identity
        self.index = 0
        self.metadata = {**identity, "inferences": 0}

    def infer(self, observation):
        started = time.monotonic()
        output = self.policy.infer(observation)
        actions = np.asarray(output["actions"], dtype=np.float32)
        if actions.shape != (50, 14) or not np.isfinite(actions).all():
            raise ValueError("ARX X5 OpenPI inference must return a finite 50 by 14 action horizon.")
        identity = {**self.identity, "inference_index": self.index,
                    "elapsed_s": time.monotonic() - started,
                    "state_sha256": hashlib.sha256(np.asarray(observation["state"], dtype=np.float32).tobytes()).hexdigest(),
                    "camera_sha256": {name: hashlib.sha256(np.asarray(image).tobytes()).hexdigest()
                                      for name, image in observation["images"].items()}}
        self.index += 1
        self.metadata["inferences"] = self.index
        print(json.dumps({"event": "native_policy_inference", **identity}, allow_nan=False), flush=True)
        return {**output, "policy_identity": identity}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--verification-output", required=True, type=Path)
    parser.add_argument("--port", type=int, default=18830)
    args = parser.parse_args()
    verified = verify_checkpoint(args.checkpoint, args.inventory)
    if verified["revision"] != "35efbc7dedfdbeeb6e95fb749bd885d73d483e41" or len(verified["files"]) != 18:
        raise ValueError("The selected RoboDojo inference checkpoint requires the pinned 18-file revision.")
    args.verification_output.parent.mkdir(parents=True, exist_ok=True)
    args.verification_output.write_text(json.dumps(verified, indent=2) + "\n", encoding="utf-8")
    devices = jax.devices()
    if len(devices) != 1 or devices[0].platform != "gpu":
        raise RuntimeError("RoboDojo OpenPI requires exactly one explicitly selected GPU.")
    name = "pi05_base_aloha_full_sim_arx-x5_seed_0"
    trained = policy_config.create_trained_policy(config.get_config(name), args.checkpoint)
    identity = {"checkpoint_sha256": verified["checkpoint_sha256"], "config": name,
                "backend": "OpenPI/JAX", "checkpoint_revision": verified["revision"],
                "action_horizon": 50, "action_dim": 14,
                "gripper_semantics": "continuous_0_closed_1_open"}
    policy = IdentifiedPolicy(trained, identity)
    print(json.dumps({"service": "openpi-robodojo-native", "port": args.port, **identity}), flush=True)
    WebsocketPolicyServer(policy, host="127.0.0.1", port=args.port,
                          metadata=policy.metadata).serve_forever()


if __name__ == "__main__":
    main()
