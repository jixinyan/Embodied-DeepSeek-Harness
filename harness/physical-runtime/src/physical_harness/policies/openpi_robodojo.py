import base64
import hashlib
from io import BytesIO
import re

import numpy as np
from PIL import Image
from openpi_client import msgpack_numpy
from websockets.sync.client import connect


class OpenPiRoboDojoPolicy:
    def __init__(self, uri: str, checkpoint_sha256: str, *, timeout_s: float = 300):
        if not re.fullmatch(r"[a-f0-9]{64}", checkpoint_sha256) or not 0 < timeout_s <= 900:
            raise ValueError("A checkpoint digest and positive bounded inference timeout are required.")
        self._timeout_s = timeout_s
        self._checkpoint_sha256 = checkpoint_sha256
        self._index = 0
        self._packer = msgpack_numpy.Packer()
        self._connection = connect(uri, proxy=None, compression=None, max_size=32 * 1024 * 1024,
                                   open_timeout=30, close_timeout=1, ping_timeout=None)
        try:
            self.metadata = msgpack_numpy.unpackb(self._connection.recv(timeout=30))
            if (self.metadata.get("checkpoint_sha256") != checkpoint_sha256 or
                    self.metadata.get("config") != "pi05_base_aloha_full_sim_arx-x5_seed_0" or
                    self.metadata.get("backend") != "OpenPI/JAX" or
                    self.metadata.get("action_horizon") != 50 or self.metadata.get("action_dim") != 14 or
                    self.metadata.get("inferences") != 0 or
                    self.metadata.get("gripper_semantics") != "continuous_0_closed_1_open"):
                raise ValueError("RoboDojo requires a fresh identified ARX X5 OpenPI service.")
        except BaseException:
            self.close()
            raise

    def infer(self, request: dict) -> tuple[list[list[float]], dict]:
        observation = request["observation"]
        if (request["action_spec"]["embodiment_id"] != "robodojo.dual-arx-x5" or
                request["action_spec"]["control_mode"] != "robodojo.qpos_target"):
            raise ValueError("The OpenPI RoboDojo service requires dual ARX X5 absolute qpos actions.")
        state = np.asarray(observation["proprioception"]["states"], dtype=np.float32)
        if state.shape != (14,) or not np.isfinite(state).all():
            raise ValueError("RoboDojo proprioception must contain 14 finite values.")
        instruction = observation["control_context"]["instruction"]
        if not isinstance(instruction, str) or not instruction.strip():
            raise ValueError("The original native instruction is required for learned inference.")
        images = {}
        camera_sha256 = {}
        for name in ("cam_high", "cam_left_wrist", "cam_right_wrist"):
            camera = observation["cameras"][name]
            encoded = base64.b64decode(camera["data_base64"], validate=True)
            with Image.open(BytesIO(encoded)) as image:
                if image.format != "PNG" or image.size != (camera["width"], camera["height"]):
                    raise ValueError("Camera bytes differ from their declared PNG dimensions.")
                pixels = np.asarray(image.convert("RGB"), dtype=np.uint8)
            images[name] = np.transpose(pixels, (2, 0, 1))
            camera_sha256[name] = hashlib.sha256(images[name].tobytes()).hexdigest()
        try:
            self._connection.send(self._packer.pack({"state": state, "prompt": instruction, "images": images}))
            response = self._connection.recv(timeout=self._timeout_s)
            if not isinstance(response, bytes):
                raise ValueError("OpenPI returned a nonbinary policy result.")
            predicted = msgpack_numpy.unpackb(response)
            identity = predicted["policy_identity"]
            if (identity["checkpoint_sha256"] != self._checkpoint_sha256 or
                    identity["inference_index"] != self._index or
                    identity["state_sha256"] != hashlib.sha256(state.tobytes()).hexdigest() or
                    identity["camera_sha256"] != camera_sha256):
                raise ValueError("OpenPI policy identity or inference sequence differs from the admitted service.")
            raw = np.asarray(predicted["actions"], dtype=np.float32)
            if raw.shape != (50, 14) or not np.isfinite(raw).all():
                raise ValueError("OpenPI RoboDojo must return a finite 50 by 14 action horizon.")
        except BaseException:
            self.close()
            raise
        actions = raw.copy()
        actions[:, [6, 13]] = np.clip(actions[:, [6, 13]], 0, 1)
        self._index += 1
        return actions[:request["max_actions"]].tolist(), {
            **identity, "native_instruction": instruction,
            "raw_actions": raw.tolist(), "actions": actions.tolist(),
            "gripper_transform": "native_continuous_opening_clamp_0_1",
        }

    def close(self):
        self._connection.close()
