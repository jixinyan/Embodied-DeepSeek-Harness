"""Pure lifecycle contract gates; callers own authority, persistence and I/O."""
from datetime import datetime
from .validation import ContractValidator


def same_scope(a, b):
    return all(a.get(key) == b.get(key) for key in ("task_id", "goal_id", "attempt_id", "recovery_id"))


def request_scope(request):
    return {key: request[key] for key in ("task_id", "goal_id", "attempt_id", "recovery_id") if key in request}


def instant(timestamp):
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


class LifecycleValidator:
    def __init__(self, contracts: ContractValidator):
        self.contracts = contracts

    def _transition(self, kind, previous, next_state):
        return [] if next_state in self.contracts.lifecycle.get(kind, {}).get(previous, []) else ["invalid_transition"]

    def requires_verification(self, status):
        self.contracts.parse("ExecutionStatus", status)
        return status["state"] in ("paused", "ended")

    def execution(self, request, previous, next_state, actor_agent_id=None):
        self.contracts.parse("SubgoalRequest", request)
        self.contracts.parse("ExecutionStatus", previous)
        self.contracts.parse("ExecutionStatus", next_state)
        errors = self._transition("execution", previous["state"], next_state["state"])
        if previous["execution_id"] != next_state["execution_id"] or not same_scope(previous["task_scope"], next_state["task_scope"]) or not same_scope(next_state["task_scope"], request_scope(request)):
            errors.append("execution_identity_mismatch")
        if next_state["state_version"] <= previous["state_version"]:
            errors.append("stale_state_version")
        if next_state["clock_id"] != previous["clock_id"]:
            errors.append("clock_mismatch")
        if any(next_state[key] < previous[key] for key in ("control_steps", "policy_calls", "elapsed_wall_time_s")) or ("raw_sim_steps" in previous and ("raw_sim_steps" not in next_state or next_state["raw_sim_steps"] < previous["raw_sim_steps"])):
            errors.append("counter_regression")
        if next_state["control_steps"] > request["budget"]["max_control_steps"]:
            errors.append("step_budget_exceeded")
        exhausted = next_state["control_steps"] >= request["budget"]["max_control_steps"] or next_state["elapsed_wall_time_s"] >= request["budget"]["max_wall_time_s"]
        if exhausted and next_state["state"] != "ended":
            errors.append("budget_requires_end")
        if not exhausted and next_state.get("stop_reason") == "budget_exhausted":
            errors.append("budget_not_exhausted")
        if previous["state"] == "paused" and next_state["state"] == "running" and actor_agent_id != request["decision_owner_id"]:
            errors.append("resume_requires_owner")
        if previous["state"] == "paused" and next_state["state"] != "running" and next_state["control_steps"] != previous["control_steps"]:
            errors.append("motion_while_paused")
        return errors

    def verification(self, previous, next_state):
        self.contracts.parse("VerificationResult", previous)
        self.contracts.parse("VerificationResult", next_state)
        errors = self._transition("verification", previous["status"], next_state["status"])
        keys = ("verdict_id", "verification_request_id", "execution_id", "boundary_event_id", "goal_contract_id", "goal_contract_version", "verifier_id", "verifier_assignment_id")
        if not same_scope(previous["task_scope"], next_state["task_scope"]) or any(previous[key] != next_state[key] for key in keys):
            errors.append("verification_identity_mismatch")
        return errors

    def verdict(self, result, context):
        request, execution, evidence, check_facts = (context[key] for key in ("request", "execution", "evidence", "checkFacts"))
        self.contracts.parse("VerificationResult", result)
        self.contracts.parse("SubgoalRequest", request)
        self.contracts.parse("ExecutionStatus", execution)
        for record in evidence:
            self.contracts.parse("EvidenceRef", record)
        for fact in check_facts:
            self.contracts.parse("CheckResult", fact)
        errors = []
        if not same_scope(result["task_scope"], request_scope(request)) or not same_scope(result["task_scope"], execution["task_scope"]) or result["execution_id"] != execution["execution_id"] or result["boundary_event_id"] != execution.get("boundary_event_id") or result["verification_request_id"] != context["verificationRequestId"]:
            errors.append("verdict_identity_mismatch")
        if result["verifier_id"] != context["verifierId"] or result["verifier_assignment_id"] != context["verifierAssignmentId"]:
            errors.append("wrong_verifier")
        if result["goal_contract_id"] != request["success_contract"]["id"] or result["goal_contract_version"] != request["success_contract"]["version"]:
            errors.append("criterion_version_mismatch")
        if not self.requires_verification(execution):
            errors.append("missing_execution_boundary")
        if result["status"] in ("pending", "running"):
            errors.append("not_a_final_verdict")
        if result["status"] not in ("passed", "failed"):
            return errors
        if not execution["device_confirmed"]:
            errors.append("unconfirmed_stop")
        if result["clock_id"] != execution["clock_id"]:
            errors.append("clock_mismatch")
        if "boundary_at" not in execution or instant(result["observed_at"]) < instant(execution["boundary_at"]):
            errors.append("stale_verdict")
        records = {record["id"]: record for record in evidence}
        facts = {fact["check_id"]: fact for fact in check_facts}
        if len(records) != len(evidence) or len(facts) != len(check_facts):
            errors.append("ambiguous_evidence")
        contract = request["success_contract"]
        criteria = contract.get("all", contract.get("any", []))
        ids = {criterion["check_id"] for criterion in criteria}
        if len(result["checks"]) != len(ids) or any(check["check_id"] not in ids for check in result["checks"]):
            errors.append("check_coverage_mismatch")
        for evidence_id in result["evidence_refs"]:
            record = records.get(evidence_id)
            if record is None:
                errors.append("missing_evidence")
                continue
            if record["visibility"] != "agent" or not same_scope(record["task_scope"], result["task_scope"]):
                errors.append("evidence_scope_mismatch")
            if record["clock_id"] != execution["clock_id"] or "boundary_at" not in execution or instant(record["observed_at"]) < instant(execution["boundary_at"]) or instant(record["observed_at"]) > instant(result["observed_at"]):
                errors.append("stale_or_unaligned_evidence")
        for check in result["checks"]:
            fact = facts.get(check["check_id"])
            if fact is None or fact["value"] != check["value"]:
                errors.append("fact_mismatch")
            if any(e not in result["evidence_refs"] for e in check["evidence_refs"]) or (fact is not None and any(e not in check["evidence_refs"] for e in fact["evidence_refs"])):
                errors.append("check_evidence_mismatch")
        values = [facts.get(c["check_id"], {}).get("value") for c in criteria]
        if "all" in contract:
            expected = "failed" if False in values else "unknown" if None in values else "passed"
        else:
            expected = "passed" if True in values else "unknown" if None in values else "failed"
        if result["status"] != expected:
            errors.append("verdict_fact_conflict")
        return list(dict.fromkeys(errors))

    def recovery(self, previous, next_state, verdict=None):
        self.contracts.parse("RecoveryRecord", previous)
        self.contracts.parse("RecoveryRecord", next_state)
        if verdict is not None:
            self.contracts.parse("VerificationResult", verdict)
        errors = self._transition("recovery", previous["status"], next_state["status"])
        keys = ("recovery_id", "task_id", "original_goal_id", "goal_contract_id", "goal_contract_version", "failed_attempt_id", "decision_owner_id")
        if any(previous[key] != next_state[key] for key in keys):
            errors.append("recovery_identity_mismatch")
        if next_state["attempt_ids"][:len(previous["attempt_ids"])] != previous["attempt_ids"] or next_state["failed_attempt_id"] in next_state["attempt_ids"]:
            errors.append("recovery_lineage_mismatch")
        if next_state["status"] == "resolved_success":
            if verdict is None or verdict["status"] != "passed" or next_state["verdict_ref"] != verdict["verdict_id"] or verdict["task_scope"]["task_id"] != next_state["task_id"] or verdict["task_scope"]["goal_id"] != next_state["original_goal_id"] or verdict["task_scope"].get("recovery_id") != next_state["recovery_id"] or verdict["goal_contract_id"] != next_state["goal_contract_id"] or verdict["goal_contract_version"] != next_state["goal_contract_version"] or verdict["task_scope"]["attempt_id"] not in next_state["attempt_ids"]:
                errors.append("original_goal_not_verified")
        return errors
