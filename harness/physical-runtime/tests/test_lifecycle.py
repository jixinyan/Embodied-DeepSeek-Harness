"""Exercise the identical lifecycle cases used by TypeScript."""
import copy
import json
import unittest
from test_contracts import ROOT, VALIDATOR, patched
from physical_harness.lifecycle import LifecycleValidator

FIXTURES = json.loads((ROOT / "tests/contracts/lifecycle-cases.json").read_text())
LIFECYCLE = LifecycleValidator(VALIDATOR)


class LifecycleTests(unittest.TestCase):
    def test_shared_cases(self):
        for case in FIXTURES["cases"]:
            with self.subTest(case=case["name"]):
                value = patched(FIXTURES["bases"][case["base"]], case["patches"])
                before = copy.deepcopy(value)
                operation = value["operation"]
                method = "requires_verification" if operation == "requiresVerification" else operation
                result = getattr(LIFECYCLE, method)(*value["args"])
                if "expected" in case:
                    self.assertEqual(result, case["expected"])
                elif case["error"] is None:
                    self.assertEqual(result, [])
                else:
                    self.assertIn(case["error"], result)
                self.assertEqual(value, before)


if __name__ == "__main__":
    unittest.main()
