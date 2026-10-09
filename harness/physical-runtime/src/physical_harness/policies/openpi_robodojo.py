import hashlib
import re

import numpy as np
from openpi_client import msgpack_numpy
from websockets.sync.client import connect

from physical_harness.policies.action_outputs import read_action_array, selected_action_count
from physical_harness.policies.observation_inputs import decode_camera, decode_state, read_policy_observation


def prepare_policy_input(request: dict) -> dict:
    observation = read_policy_observation(request, "robodojo.dual-arx-x5")
    if (request["action_spec"]["embodiment_id"] != "robodojo.dual-arx-x5" or
            request["action_spec"]["control_mode"] != "robodojo.qpos_target"):
        raise ValueError("The OpenPI RoboDojo service requires dual ARX X5 absolute qpos actions.")
    state = decode_state(observation["proprioception"]["states"], 14)
    instruction = observation["control_context"]["instruction"]
    if not isinstance(instruction, str) or not instruction.strip():
        raise ValueError("The original native instruction is required for learned inference.")
    images = {}
    for name in ("cam_high", "cam_left_wrist", "cam_right_wrist"):
        camera = observation["cameras"][name]
        pixels = decode_camera(camera, expected_sizes=((camera["width"], camera["height"]),))
        images[name] = np.transpose(pixels, (2, 0, 1))
    return {"state": state, "prompt": instruction, "images": images}


class OpenPiRoboDojoPolicy:
    def __init__(self, uri: str, checkpoint_sha256: str, *, timeout_s: float = 300):
        if not re.fullmatch(r"[a-f0-9]{64}", checkpoint_sha256) or not 0 < timeout_s <= 900:
            raise ValueError("A checkpoint digest and positive bounded inference timeout are required.")
        self._timeout_s = timeout_s
        self._checkpoint_sha256 = checkpoint_sha256
        self._index = -1
        self._packer = msgpack_numpy.Packer()
        self._connection = connect(uri, proxy=None, compression=None, max_size=32 * 1024 * 1024,
                                   open_timeout=30, close_timeout=1, ping_timeout=None)
        try:
            self.metadata = msgpack_numpy.unpackb(self._connection.recv(timeout=30))
            if (self.metadata.get("checkpoint_sha256") != checkpoint_sha256 or
                    self.metadata.get("config") != "pi05_base_aloha_full_sim_arx-x5_seed_0" or
                    self.metadata.get("backend") != "OpenPI/JAX" or
                    self.metadata.get("action_horizon") != 50 or self.metadata.get("action_dim") != 14 or
                    self.metadata.get("request_identity_version") != "edh.openpi.request_identity.v1" or
                    type(self.metadata.get("inferences")) is not int or self.metadata["inferences"] < 0 or
                    self.metadata.get("gripper_semantics") != "continuous_0_closed_1_open"):
                raise ValueError("RoboDojo requires an identified ARX X5 OpenPI service with request-bound inference.")
            self._index = self.metadata["inferences"] - 1
        except BaseException:
            self.close()
            raise

    def infer(self, request: dict) -> tuple[list[list[float]], dict]:
        count = selected_action_count(request["max_actions"], 50, source="OpenPI RoboDojo")
        prepared = prepare_policy_input(request)
        state, instruction = prepared["state"], prepared["prompt"]
        camera_sha256 = {name: hashlib.sha256(pixels.tobytes()).hexdigest()
                         for name, pixels in prepared["images"].items()}
        try:
            self._connection.send(self._packer.pack({**prepared, "edh_request_id": request["request_id"]}))
            response = self._connection.recv(timeout=self._timeout_s)
            if not isinstance(response, bytes):
                raise ValueError("OpenPI returned a nonbinary policy result.")
            predicted = msgpack_numpy.unpackb(response)
            identity = predicted["policy_identity"]
            if (any(identity.get(name) != value for name, value in self.metadata.items() if name != "inferences") or
                    identity.get("source_request_id") != request["request_id"] or
                    identity.get("instruction_sha256") != hashlib.sha256(instruction.encode("utf-8")).hexdigest() or
                    type(identity.get("inference_index")) is not int or identity["inference_index"] <= self._index or
                    identity["state_sha256"] != hashlib.sha256(state.tobytes()).hexdigest() or
                    identity["camera_sha256"] != camera_sha256):
                raise ValueError("OpenPI policy identity or inference sequence differs from the admitted service.")
            raw = read_action_array(predicted["actions"], dimensions=(50, 14),
                                    source="OpenPI RoboDojo", float32=True)
        except BaseException:
            self.close()
            raise
        actions = raw.copy()
        actions[:, [6, 13]] = np.clip(actions[:, [6, 13]], 0, 1)
        self._index = identity["inference_index"]
        return actions[:count].tolist(), {
            **identity, "native_instruction": instruction,
            "raw_actions": raw.tolist(), "actions": actions.tolist(),
            "gripper_transform": "native_continuous_opening_clamp_0_1",
        }

    def close(self):
        self._connection.close()
