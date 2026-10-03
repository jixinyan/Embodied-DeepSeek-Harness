import argparse
import hashlib
import json
from pathlib import Path

from physical_harness.validation import ContractValidator


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def inspect(args: argparse.Namespace) -> dict:
    validator = ContractValidator.from_path(args.schema_path)
    run = json.loads(args.run.read_text(encoding="utf-8"))
    events = json.loads(args.events.read_text(encoding="utf-8"))
    require(run["source"] in {"simulation", "hardware"}, "Review acceptance requires a native run source.")
    require(len(events) == run["eventCount"] and all(
        event["sequence"] == index for index, event in enumerate(events, 1)
    ), "Review acceptance requires the complete ordered event history.")
    native_calls = {}
    calls = {}
    receipts = {}
    ended = {}
    formal = {}
    assignments = {}
    reviews = []
    for event in events:
        detail = event["detail"]
        if event["type"] == "agent.created":
            assignments[detail["assignment"]["id"]] = detail["assignment"]
        elif event["type"] == "dsh.tool-call" and detail["data"]["name"] == "execution__end":
            native_calls[detail["data"]["callId"]] = detail
        elif event["type"] == "tool.started" and detail["tool"] == "execution.end":
            require(detail["assignmentId"] == run["decisionAssignmentId"], "Terminal review requires its actual decision owner.")
            require(bool(detail["args"]["reason"].strip()), "Terminal review requires its actual reason.")
            calls[detail["callId"]] = detail
        elif event["type"] == "tool.failed" and detail["tool"] == "execution.end":
            raise ValueError(f"Actual terminal review failed: {detail['error']}")
        elif event["type"] == "execution.updated" and detail["execution"]["state"] == "ended":
            status = validator.parse("ExecutionStatus", detail["execution"])
            require(status["execution_id"] not in ended, "An immutable ended execution was published again.")
            ended[status["execution_id"]] = {"status": status, "sequence": event["sequence"]}
        elif event["type"] == "tool.completed" and detail["tool"] == "execution.end":
            status = validator.parse("ExecutionStatus", detail["result"]["execution"])
            call = calls[detail["callId"]]
            native = native_calls[detail["callId"]]
            require(json.loads(native["data"]["arguments"]) == call["args"] and
                    native["assignmentId"] == call["assignmentId"],
                    "Terminal review arguments differ from the original native model call.")
            require(status["state"] == "ended" and status["device_confirmed"] and
                    status["execution_id"] == call["args"]["executionId"] and
                    status["task_scope"]["task_id"] == run["id"],
                    "Terminal review receipt lacks its matching confirmed ended execution.")
            source = ended[status["execution_id"]]
            require(status == source["status"] and source["sequence"] < event["sequence"],
                    "Terminal review receipt differs from its immutable native publication.")
            receipts.setdefault(status["execution_id"], []).append(status)
        elif event["type"] == "verification.requested":
            status = ended[detail["executionId"]]["status"]
            require(detail["boundaryId"] == status["boundary_event_id"] and
                    ended[detail["executionId"]]["sequence"] < event["sequence"],
                    "Formal verification preceded its actual confirmed end.")
            formal.setdefault(detail["executionId"], []).append(detail)
        elif event["type"] == "message.delivered" and detail["payload"].get("kind") == "running-review":
            reviews.append(event)
    require(bool(receipts), "No actual native model terminal-review receipt exists.")
    if args.require_running_review:
        require(bool(reviews), "No actual bounded Planner observation was delivered.")
    results = []
    for execution_id, returned in receipts.items():
        status = returned[0]
        require(all(value == status for value in returned), "Repeated review changed the immutable native ended receipt.")
        if args.require_repeat:
            require(len(returned) >= 2, "Repeated native model review was not executed.")
        if args.require_planner_stop:
            require(status["stop_reason"] == "planner_stop", "The actual native stop was not Planner-requested review.")
        require(len(formal.get(execution_id, [])) == 1, "Terminal review must retain one independent formal assignment.")
        request = next(item for item in run["requests"] if
                       item["goal_id"] == status["task_scope"]["goal_id"] and
                       item["attempt_id"] == status["task_scope"]["attempt_id"])
        require(request["owner_assignment_id"] == run["decisionAssignmentId"] and
                request.get("recovery_id") == status["task_scope"].get("recovery_id"),
                "Terminal review differs from its admitted request ownership or scope.")
        verifier = assignments[formal[execution_id][0]["assignmentId"]]
        require(verifier["sessionId"] != request["decision_owner_id"] and
                verifier["brief"]["task_scope"] == status["task_scope"],
                "Terminal review lacks an independent formal Session with its exact execution scope.")
        stop_path = args.policy_records / execution_id / f"stop-{status['boundary_event_id']}.json"
        stop_bytes = stop_path.read_bytes()
        stop = json.loads(stop_bytes)
        acknowledgement = validator.parse("StopAcknowledgement", stop["acknowledgement"])
        require(acknowledgement["execution_id"] == execution_id and
                acknowledgement["boundary_id"] == status["boundary_event_id"] and
                acknowledgement["device_confirmed"] and
                acknowledgement["generation"] == status["control_generation"] and
                stop["executed_actions"] == status["control_steps"] and
                stop["raw_sim_steps"] == status["raw_sim_steps"] and stop["uncertain_actions"] == 0,
                "The actual owner-thread stop acknowledgement differs from the ended receipt.")
        controls = []
        for path in (args.policy_records / execution_id).rglob("*.json"):
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("schema_version") == "edh.native_policy_receipt.v1":
                controls.append(record)
        require(bool(controls), "Terminal review requires actual learned-policy controls.")
        for record in controls:
            segment = validator.parse("ActionSegment", record["segment"])
            receipt = validator.parse("ActionReceipt", record["receipt"])
            require(segment["execution_id"] == execution_id and receipt["execution_id"] == execution_id and
                    segment["task_scope"] == status["task_scope"] and
                    receipt["generation"] == segment["generation"] < acknowledgement["generation"] and
                    record["control_index"] <= stop["executed_actions"] and record["uncertain_actions"] == 0,
                    "A recorded native action differs from its pre-stop admitted generation or counts.")
        require(sum(record["receipt"]["executed_actions"] for record in controls) == stop["executed_actions"],
                "Actual action receipts differ from owner-confirmed final control counts.")
        results.append({"executionId": execution_id, "stopReason": status["stop_reason"],
                        "generation": acknowledgement["generation"], "boundaryId": acknowledgement["boundary_id"],
                        "nativeControls": stop["executed_actions"], "rawSimSteps": stop["raw_sim_steps"],
                        "returnedReceipts": len(returned), "formalAssignments": 1,
                        "stopRecordSha256": hashlib.sha256(stop_bytes).hexdigest()})
    return {"runId": run["id"], "taskOutcome": run["state"], "runningReviews": len(reviews),
            "reviewExecutions": results, "observedInvariants": "passed"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--events", required=True, type=Path)
    parser.add_argument("--policy-records", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--require-repeat", action="store_true")
    parser.add_argument("--require-running-review", action="store_true")
    parser.add_argument("--require-planner-stop", action="store_true")
    args = parser.parse_args()
    result = inspect(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
