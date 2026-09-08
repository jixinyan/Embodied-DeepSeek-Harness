"""Run the shared typed-message and tool-boundary cases in Python."""
import copy
import json
import unittest
from test_contracts import ROOT, patched
from physical_harness.boundary import BoundaryValidator

SOURCE = json.loads((ROOT / "harness/contracts/schema/physical.schema.json").read_text())
FIXTURES = json.loads((ROOT / "tests/contracts/boundary-cases.json").read_text())
SHARED = BoundaryValidator(SOURCE, FIXTURES["extensions"])


class BoundaryTests(unittest.TestCase):
    def test_shared_cases(self):
        for case in FIXTURES["cases"]:
            with self.subTest(case=case["name"]):
                value = patched(FIXTURES["bases"][case["base"]], case["patches"])
                before = copy.deepcopy(value)

                def invoke():
                    if value["method"] == "construct":
                        return BoundaryValidator(SOURCE, value["extensions"])
                    return getattr(SHARED, value["method"])(*value["args"])

                if case["throws"]:
                    with self.assertRaises((ValueError, TypeError)):
                        invoke()
                else:
                    result = invoke()
                    if value["method"] not in ("definition", "construct"):
                        if case["error"] is None:
                            self.assertEqual(result, [])
                        else:
                            self.assertIn(case["error"], result)
                self.assertEqual(value, before)

    def test_registration_snapshot(self):
        source, extensions = copy.deepcopy(SOURCE), copy.deepcopy(FIXTURES["extensions"])
        validator = BoundaryValidator(source, extensions)
        source["x-edh-message-types"]["tool.invoke"]["version"] = "changed"
        extensions["messages"][0]["version"] = "changed"
        self.assertEqual(validator.message(FIXTURES["bases"]["message"]["args"][0]), [])
        self.assertEqual(validator.message(FIXTURES["bases"]["custom_message"]["args"][0]), [])


if __name__ == "__main__":
    unittest.main()
