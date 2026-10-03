import argparse
import json
from pathlib import Path

from physical_harness.policies.openpi_audit import retained_sources
from physical_harness.validation import ContractValidator


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint-verification", required=True, type=Path)
    parser.add_argument("--bridge-service-log", required=True, type=Path)
    parser.add_argument("--native-service-log", required=True, type=Path)
    parser.add_argument("--retained-inference", required=True, type=Path, action="append")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--schema-path", type=Path,
                        default=Path(__file__).resolve().parents[1] / "harness/contracts/schema/physical.schema.json")
    args = parser.parse_args()
    report = retained_sources(args.checkpoint_verification, args.bridge_service_log, args.native_service_log,
                              tuple(args.retained_inference), ContractValidator.from_path(args.schema_path))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
