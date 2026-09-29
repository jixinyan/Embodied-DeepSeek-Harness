"""CPU protocol contract for the RoboDojo adapter; no Isaac Sim is started."""

import unittest
from unittest.mock import patch

import numpy as np

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.validation import ContractValidator


ROOT = __import__("pathlib").Path(__file__).resolve().parents[3]
VALIDATOR = ContractValidator.from_path(ROOT / "harness/contracts/schema/physical.schema.json")


class FakeRpc:
    def __init__(self, host, port, timeout):
        self.calls = []
        self.step = 0

    def request(self, operation, **arguments):
        self.calls.append((operation, arguments))
        if operation == "metadata":
            return {
                "task": "organize_table", "instruction": "Organize the table.",
                "simulator": "RoboDojo", "robot_adapter": "dual_arx_x5",
                "control_dt": 0.1, "max_episode_steps": 4, "action_dim": 14,
                "cameras": ["cam_high", "cam_left_wrist", "cam_right_wrist"],
            }
        if operation == "reset":
            return {"episode_id": "episode-1", "step_id": 0}
        if operation == "begin_combination":
            return {"physical_steps": 0}
        if operation == "teacher_observation":
            image = np.zeros((8, 8, 3), dtype=np.uint8)
            return {"cam_high": image, "cam_left_wrist": image, "cam_right_wrist": image, "states": np.zeros(14, dtype=np.float32)}
        if operation == "chunk_step":
            self.step += 1
            return {"steps": [{"step_id": self.step, "success": self.step == 1, "terminated": self.step == 1, "truncated": False}]}
        raise AssertionError(operation)

    def close(self):
        self.calls.append(("close", {}))


class RoboDojoTests(unittest.TestCase):
    def test_reset_step_and_check_preserve_native_identity(self):
        with patch("physical_harness.environments.robodojo._RoboDojoRpc", FakeRpc):
            environment = RoboDojoEnvironment(VALIDATOR)
            observation = environment.reset("organize_table", {"port": 43191, "seed": 7})
            description = environment.describe()
            self.assertEqual(description.provider, "robodojo")
            self.assertEqual(description.action_spec["channels"][0]["name"], "left_joint_0")
            result = environment.step([0.0] * 14, lambda: False)
            self.assertEqual(result.executed_actions, 1)
            self.assertTrue(result.episode_terminated)
            self.assertEqual(environment.check(["task_success"])[0].value, True)
            self.assertEqual(observation.state["states"], (0.0,) * 14)
            environment.close()

    def test_stop_before_rpc_does_not_commit_action(self):
        with patch("physical_harness.environments.robodojo._RoboDojoRpc", FakeRpc):
            environment = RoboDojoEnvironment(VALIDATOR)
            environment.reset("organize_table", {"port": 43191})
            before = len(environment._rpc.calls)
            result = environment.step([0.0] * 14, lambda: True)
            self.assertEqual(result.executed_actions, 0)
            self.assertEqual(len(environment._rpc.calls), before + 1)  # observe only
            environment.close()


if __name__ == "__main__":
    unittest.main()
