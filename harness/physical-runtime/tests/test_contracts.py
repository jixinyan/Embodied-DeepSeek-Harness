"""Use the same canonical positive/negative wire inputs as TypeScript."""
import copy
import json
import unittest
from pathlib import Path

from physical_harness.validation import ContractValidator

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = json.loads((ROOT / "tests/contracts/wire-cases.json").read_text())
VALIDATOR = ContractValidator.from_path(ROOT / "harness/contracts/schema/physical.schema.json")


def patched(value, changes):
    result = copy.deepcopy(value)
    for change in changes:
        keys = [x.replace("~1", "/").replace("~0", "~") for x in change["path"][1:].split("/")]
        parent = result
        for part in keys[:-1]:
            parent = parent[int(part)] if isinstance(parent, list) else parent[part]
        key = int(keys[-1]) if isinstance(parent, list) else keys[-1]
        if change["op"] == "remove":
            del parent[key]
        else:
            parent[key] = copy.deepcopy(change["value"])
    return result


class ContractTests(unittest.TestCase):
    def test_shared_cases(self):
        for case in FIXTURES["cases"]:
            with self.subTest(case=case["name"]):
                base = FIXTURES["bases"][case["base"]]
                value = patched(base["value"], case["patches"])
                before = copy.deepcopy(value)
                issues = VALIDATOR.issues(base["contract"], value)
                self.assertEqual(not issues, case["valid"], issues)
                self.assertEqual(value, before)

    def test_non_json_values(self):
        base = copy.deepcopy(FIXTURES["bases"]["message"]["value"])
        for value in [float("nan"), float("inf"), lambda: 1, {1, 2}, (1, 2)]:
            base["payload"] = {"value": value}
            self.assertTrue(VALIDATOR.issues("MessageEnvelope", base))
        base["payload"] = base
        self.assertTrue(VALIDATOR.issues("MessageEnvelope", base))
        with self.assertRaisesRegex(ValueError, "Unknown contract"):
            VALIDATOR.parse("UnknownContract", {})


if __name__ == "__main__":
    unittest.main()
