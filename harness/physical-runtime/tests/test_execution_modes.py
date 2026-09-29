"""CPU checks for direct/hybrid proposal admission; no simulator or model is used."""

import unittest

from physical_harness.execution.modes import (
    ExecutionMode,
    HybridReview,
    execution_mode_from_policy_config,
    normalize_mode_response,
    validate_direct_action,
    validate_hybrid_proposal,
)


SPEC = {
    "channels": [
        {"name": "joint", "minimum": -1, "maximum": 1},
        {"name": "gripper", "minimum": 0, "maximum": 1},
    ]
}

REQUEST = {
    "request_id": "request-1",
    "execution_id": "execution-1",
    "task_scope": {"task_id": "task-1", "goal_id": "goal-1", "attempt_id": "attempt-1"},
    "generation": 0,
    "observation_id": "observation-1",
    "valid_until": "2026-09-30T00:00:00.000Z",
    "action_spec": SPEC,
}


class ExecutionModeTests(unittest.TestCase):
    def test_profile_modes_are_explicit(self):
        self.assertEqual(execution_mode_from_policy_config({}), ExecutionMode.POLICY)
        self.assertEqual(execution_mode_from_policy_config({"execution_mode": "direct"}), ExecutionMode.DIRECT)
        self.assertEqual(execution_mode_from_policy_config({"execution_mode": "hybrid"}), ExecutionMode.HYBRID)
        with self.assertRaises(ValueError):
            execution_mode_from_policy_config({"execution_mode": "gpt_only"})

    def test_direct_action_is_bounded(self):
        self.assertEqual(validate_direct_action([0.2, 1], SPEC), (0.2, 1.0))
        with self.assertRaises(ValueError):
            validate_direct_action([float("nan"), 0], SPEC)
        with self.assertRaises(ValueError):
            validate_direct_action([2, 0], SPEC)

    def test_hybrid_review_admits_only_safe_prefix(self):
        review = HybridReview("allow", "left and right arms are grounded", 0.8, 2, ("camera:1",), ("subtask:1",))
        result = validate_hybrid_proposal([[0.1, 0.2], [0.2, 0.3], [0.3, 0.4]], SPEC, review)
        self.assertEqual(result, ((0.1, 0.2), (0.2, 0.3)))
        with self.assertRaises(ValueError):
            validate_hybrid_proposal([[0.1, 0.2]], SPEC, HybridReview("intervene", "correct", 1, 1))

    def test_direct_and_hybrid_envelopes_become_canonical_chunks(self):
        direct = normalize_mode_response(
            {"mode": "direct", "request_id": "request-1", "action": [0.2, 0.5]},
            REQUEST,
            ExecutionMode.DIRECT,
        )
        self.assertEqual(direct["actions"], [[0.2, 0.5]])
        hybrid = normalize_mode_response(
            {
                "mode": "hybrid",
                "request_id": "request-1",
                "proposal": [[0.1, 0.2], [0.2, 0.3], [0.3, 0.4]],
                "review": {"decision": "allow", "reason": "grounded", "confidence": 0.9, "safe_steps": 2},
            },
            REQUEST,
            "hybrid",
        )
        self.assertEqual(hybrid["actions"], [[0.1, 0.2], [0.2, 0.3]])
        intervention = normalize_mode_response(
            {
                "mode": "hybrid",
                "request_id": "request-1",
                "proposal": [[0.1, 0.2]],
                "review": {"decision": "intervene", "reason": "unsafe", "confidence": 0.1, "safe_steps": 1},
                "intervention": [0.4, 0.6],
            },
            REQUEST,
            "hybrid",
        )
        self.assertEqual(intervention["actions"], [[0.4, 0.6]])


if __name__ == "__main__":
    unittest.main()
