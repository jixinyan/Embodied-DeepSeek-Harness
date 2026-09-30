import argparse
from datetime import datetime
import json
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit(run, events):
    require(run["source"] in {"simulation", "hardware"}, "Acceptance requires a real run source.")
    require(run["state"] in {"succeeded", "failed", "cancelled", "unknown", "interrupted"},
            "Acceptance requires a terminal run.")
    require(len(events) == run["eventCount"], "The exported event count differs from the run.")
    assignments = {}
    sessions = set()
    executions = {}
    requests = {}
    checked = {}
    verdicts = {}
    recoveries = {}
    policy_sequences = {}
    controls = 0
    frames = 0
    previous_time = None
    for sequence, event in enumerate(events, 1):
        require(event["sequence"] == sequence, "The event sequence is incomplete.")
        current_time = datetime.fromisoformat(event["at"].replace("Z", "+00:00"))
        require(previous_time is None or current_time >= previous_time, "Event time moved backwards.")
        previous_time = current_time
        kind, detail = event["type"], event["detail"]
        if kind == "agent.created":
            assignment = detail["assignment"]
            require(assignment["id"] not in assignments and assignment["sessionId"] not in sessions,
                    "Role assignments must have independent native Sessions.")
            require(assignment["brief"]["task_scope"]["task_id"] == run["id"],
                    "An assignment belongs to another task.")
            if "verification.submit" in detail["tools"]:
                matching = [status for status in executions.values()
                            if status["task_scope"] == assignment["brief"]["task_scope"]]
                require(matching and matching[-1]["state"] == "ended" and
                        matching[-1]["device_confirmed"] and matching[-1]["stop_reason"] in
                        {"policy_stop", "episode_terminated", "budget_exhausted"},
                        "A Verifier was created during an unfinished execution.")
            assignments[assignment["id"]] = {**assignment, "createdSequence": sequence}
            sessions.add(assignment["sessionId"])
        elif kind == "execution.updated":
            status = detail["execution"]
            require(status["task_scope"]["task_id"] == run["id"], "Execution belongs to another task.")
            prior = executions.get(status["execution_id"])
            if prior:
                require(status["state_version"] > prior["state_version"], "Execution version did not advance.")
                require(status["control_steps"] >= prior["control_steps"], "Control count decreased.")
                require(status["task_scope"] == prior["task_scope"], "Execution scope changed.")
            executions[status["execution_id"]] = status
            controls += status["control_steps"] - (prior["control_steps"] if prior else 0)
        elif kind == "verification.requested":
            status = executions[detail["executionId"]]
            require(status["state"] == "ended" and status["device_confirmed"] and
                    status["stop_reason"] in {"policy_stop", "episode_terminated", "budget_exhausted"},
                    "Formal verification began without an eligible confirmed end boundary.")
            require(status["boundary_event_id"] == detail["boundaryId"], "Verification boundary changed.")
            assignment = assignments[detail["assignmentId"]]
            require(assignment["brief"]["task_scope"] == status["task_scope"], "Verifier scope differs.")
            require(assignment["sessionId"] != assignments[run["decisionAssignmentId"]]["sessionId"],
                    "Verifier must use an independent Session.")
            require(detail["assignmentId"] not in requests, "A Verifier assignment was reused.")
            requests[detail["assignmentId"]] = detail
        elif kind == "verification.checked":
            require(detail["assignmentId"] in requests, "Formal facts preceded verification admission.")
            require(detail["evidence"]["task_scope"] ==
                    executions[requests[detail["assignmentId"]]["executionId"]]["task_scope"],
                    "Formal evidence belongs to another execution scope.")
            checked[detail["assignmentId"]] = detail
        elif kind == "verification.completed":
            result = detail["result"]
            assignment_id = result["verifier_assignment_id"]
            request = requests[assignment_id]
            facts = checked[assignment_id]
            require(result["execution_id"] == request["executionId"] and
                    result["boundary_event_id"] == request["boundaryId"] and
                    result["verifier_id"] == assignments[assignment_id]["sessionId"],
                    "Formal verdict identity differs from its assignment and stopped boundary.")
            require(result["checks"] == facts["facts"] and
                    facts["evidence"]["id"] in result["evidence_refs"], "Verdict facts differ from native checks.")
            execution_request = next(item for item in run["requests"] if
                                     item["goal_id"] == result["task_scope"]["goal_id"] and
                                     item["attempt_id"] == result["task_scope"]["attempt_id"])
            criterion = execution_request["success_contract"]
            require(result["goal_contract_id"] == criterion["id"] and
                    result["goal_contract_version"] == criterion["version"], "Verdict changed the task criterion.")
            if result["status"] == "passed":
                values = {item["check_id"]: item["value"] for item in result["checks"]}
                selected = [values[item["check_id"]] is True for item in criterion.get("all", criterion.get("any"))]
                require(all(selected) if "all" in criterion else any(selected),
                        "A successful verdict contradicts its native criterion facts.")
            require(result["verdict_id"] not in verdicts, "A verdict was published twice.")
            verdicts[result["verdict_id"]] = result
        elif kind == "recovery.opened":
            context = detail["context"]
            failed = context["failedVerdict"]
            require(failed == verdicts.get(failed["verdict_id"]) and failed["status"] == "failed",
                    "Recovery requires a previously accepted formal failed verdict.")
            require(context["ownerAssignmentId"] == run["decisionAssignmentId"] and
                    context["decision"] in {"retry", "replan"} and context["changes"] and
                    context["attemptSummary"].strip(), "Recovery requires an explicit Planner decision and context.")
            recoveries[detail["recoveryId"]] = detail
        elif kind == "recovery.resolved":
            recovery = recoveries[detail["recoveryId"]]
            result = verdicts[detail["verdictId"]]
            require(result["status"] == "passed" and
                    result["task_scope"]["goal_id"] == recovery["context"]["originalGoalId"] and
                    result["task_scope"]["recovery_id"] == detail["recoveryId"],
                    "Recovery resolution requires original-goal formal success.")
        elif kind.startswith("policy."):
            session_id = detail["sessionId"]
            require(session_id not in sessions, "Execution policy shares an upper role Session.")
            require(detail["sequence"] == policy_sequences.get(session_id, 0) + 1,
                    "Execution-policy event sequence is incomplete.")
            require(detail["executionId"] in executions and
                    detail["taskScope"] == executions[detail["executionId"]]["task_scope"],
                    "Execution-policy telemetry differs from its admitted execution.")
            policy_sequences[session_id] = detail["sequence"]
        elif kind == "simulation.frame":
            require(detail["executionId"] in executions and detail["policyRequestId"] and
                    detail["segmentId"] and detail["nativeStepIndex"] > 0,
                    "A recorded simulator frame has no admitted control identity.")
            frames += 1
        elif kind == "run.succeeded":
            result = verdicts[detail["verdictId"]]
            require(result["status"] == "passed", "Task completion requires formal success.")
    require(len(requests) == len(verdicts), "An admitted formal verification has no verdict.")
    if run["state"] == "succeeded":
        require(any(event["type"] == "run.succeeded" for event in events), "No successful task event exists.")
        require(controls > 0 and frames > 0 and policy_sequences, "Success requires real controls, frames and policy trace.")
    return {"runId": run["id"], "source": run["source"], "state": run["state"],
            "checkedEvents": len(events), "independentUpperSessions": len(sessions),
            "executionPolicySessions": len(policy_sequences), "executedControls": controls,
            "recordedSimulatorFrames": frames, "formalVerdicts": len(verdicts),
            "recoveryChains": len(recoveries), "observedInvariants": "passed",
            "unobservedRecovery": not bool(recoveries)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run = json.loads((args.export / "source/run.json").read_text(encoding="utf-8"))
    events = json.loads((args.export / "source/events.json").read_text(encoding="utf-8"))
    report = audit(run, events)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
