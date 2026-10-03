import type {
  CheckResult,
  EvidenceRef,
  ExecutionStatus,
  RecoveryRecord,
  SubgoalRequest,
  TaskScope,
  VerificationResult,
} from './generated.js';
import { ContractValidator } from './validation.js';

export interface VerificationContext {
  readonly request: SubgoalRequest;
  readonly execution: ExecutionStatus;
  readonly verifierId: string;
  readonly verifierAssignmentId: string;
  readonly verificationRequestId: string;
  readonly evidence: readonly EvidenceRef[];
  readonly checkFacts: readonly CheckResult[];
}

function sameScope(a: TaskScope, b: TaskScope): boolean {
  return (
    a.task_id === b.task_id &&
    a.goal_id === b.goal_id &&
    a.attempt_id === b.attempt_id &&
    a.recovery_id === b.recovery_id
  );
}
function requestScope(request: SubgoalRequest): TaskScope {
  return {
    task_id: request.task_id,
    goal_id: request.goal_id,
    attempt_id: request.attempt_id,
    ...(request.recovery_id === undefined ? {} : { recovery_id: request.recovery_id }),
  };
}

/** Pure contract gates. Callers own authenticated identities, persistence and I/O. */
export class LifecycleValidator {
  constructor(private readonly contracts: ContractValidator) {}
  private transition(kind: string, previous: string, next: string): string[] {
    return this.contracts.lifecycle[kind]?.[previous]?.includes(next) ? [] : ['invalid_transition'];
  }
  requiresVerification(status: ExecutionStatus): boolean {
    this.contracts.parse('ExecutionStatus', status);
    return (
      status.state === 'ended' &&
      ['policy_stop', 'planner_stop', 'episode_terminated', 'budget_exhausted'].includes(
        status.stop_reason ?? '',
      )
    );
  }
  execution(
    request: SubgoalRequest,
    previous: ExecutionStatus,
    next: ExecutionStatus,
    actorAgentId?: string,
  ): string[] {
    this.contracts.parse('SubgoalRequest', request);
    this.contracts.parse('ExecutionStatus', previous);
    this.contracts.parse('ExecutionStatus', next);
    const errors = this.transition('execution', previous.state, next.state);
    if (
      previous.execution_id !== next.execution_id ||
      !sameScope(previous.task_scope, next.task_scope) ||
      !sameScope(next.task_scope, requestScope(request))
    )
      errors.push('execution_identity_mismatch');
    if (next.state_version <= previous.state_version) errors.push('stale_state_version');
    if (next.clock_id !== previous.clock_id) errors.push('clock_mismatch');
    if (
      next.control_steps < previous.control_steps ||
      next.policy_calls < previous.policy_calls ||
      next.elapsed_wall_time_s < previous.elapsed_wall_time_s ||
      (previous.raw_sim_steps !== undefined &&
        (next.raw_sim_steps === undefined || next.raw_sim_steps < previous.raw_sim_steps))
    )
      errors.push('counter_regression');
    if (next.control_steps > request.budget.max_control_steps) errors.push('step_budget_exceeded');
    const exhausted =
      next.control_steps >= request.budget.max_control_steps ||
      next.elapsed_wall_time_s >= request.budget.max_wall_time_s;
    if (exhausted && next.state !== 'ended') errors.push('budget_requires_end');
    if (!exhausted && next.stop_reason === 'budget_exhausted') errors.push('budget_not_exhausted');
    if (
      previous.state === 'paused' &&
      next.state === 'running' &&
      actorAgentId !== request.decision_owner_id
    )
      errors.push('resume_requires_owner');
    if (
      previous.state === 'paused' &&
      next.state !== 'running' &&
      next.control_steps !== previous.control_steps
    )
      errors.push('motion_while_paused');
    return errors;
  }
  verification(previous: VerificationResult, next: VerificationResult): string[] {
    this.contracts.parse('VerificationResult', previous);
    this.contracts.parse('VerificationResult', next);
    const errors = this.transition('verification', previous.status, next.status);
    if (
      !sameScope(previous.task_scope, next.task_scope) ||
      previous.verdict_id !== next.verdict_id ||
      previous.verification_request_id !== next.verification_request_id ||
      previous.execution_id !== next.execution_id ||
      previous.boundary_event_id !== next.boundary_event_id ||
      previous.goal_contract_id !== next.goal_contract_id ||
      previous.goal_contract_version !== next.goal_contract_version ||
      previous.verifier_id !== next.verifier_id ||
      previous.verifier_assignment_id !== next.verifier_assignment_id
    )
      errors.push('verification_identity_mismatch');
    return errors;
  }
  /** Check a designated verifier's formal outcome against its immutable request and facts. */
  verdict(result: VerificationResult, context: VerificationContext): string[] {
    const { request, execution, evidence, checkFacts } = context;
    this.contracts.parse('VerificationResult', result);
    this.contracts.parse('SubgoalRequest', request);
    this.contracts.parse('ExecutionStatus', execution);
    for (const record of evidence) this.contracts.parse('EvidenceRef', record);
    for (const fact of checkFacts) this.contracts.parse('CheckResult', fact);
    const errors: string[] = [];
    if (
      !sameScope(result.task_scope, requestScope(request)) ||
      !sameScope(result.task_scope, execution.task_scope) ||
      result.execution_id !== execution.execution_id ||
      result.boundary_event_id !== execution.boundary_event_id ||
      result.verification_request_id !== context.verificationRequestId
    )
      errors.push('verdict_identity_mismatch');
    if (
      result.verifier_id !== context.verifierId ||
      result.verifier_assignment_id !== context.verifierAssignmentId
    )
      errors.push('wrong_verifier');
    if (
      result.goal_contract_id !== request.success_contract.id ||
      result.goal_contract_version !== request.success_contract.version
    )
      errors.push('criterion_version_mismatch');
    if (!this.requiresVerification(execution)) errors.push('missing_execution_boundary');
    if (result.status === 'pending' || result.status === 'running')
      errors.push('not_a_final_verdict');
    // Unknown preserves uncertainty, including unconfirmed stop or missing evidence.
    if (result.status !== 'passed' && result.status !== 'failed') return errors;
    if (!execution.device_confirmed) errors.push('unconfirmed_stop');
    if (result.clock_id !== execution.clock_id) errors.push('clock_mismatch');
    if (
      execution.boundary_at === undefined ||
      Date.parse(result.observed_at) < Date.parse(execution.boundary_at)
    )
      errors.push('stale_verdict');
    const records = new Map(evidence.map((record) => [record.id, record]));
    const facts = new Map(checkFacts.map((fact) => [fact.check_id, fact]));
    if (records.size !== evidence.length || facts.size !== checkFacts.length)
      errors.push('ambiguous_evidence');
    const criteria =
      'all' in request.success_contract
        ? request.success_contract.all
        : request.success_contract.any;
    const ids = new Set(criteria.map((criterion) => criterion.check_id));
    if (
      result.checks.length !== ids.size ||
      result.checks.some((check) => !ids.has(check.check_id))
    )
      errors.push('check_coverage_mismatch');
    for (const id of result.evidence_refs) {
      const record = records.get(id);
      if (record === undefined) {
        errors.push('missing_evidence');
        continue;
      }
      if (record.visibility !== 'agent' || !sameScope(record.task_scope, result.task_scope))
        errors.push('evidence_scope_mismatch');
      if (
        record.clock_id !== execution.clock_id ||
        execution.boundary_at === undefined ||
        Date.parse(record.observed_at) < Date.parse(execution.boundary_at) ||
        Date.parse(record.observed_at) > Date.parse(result.observed_at)
      )
        errors.push('stale_or_unaligned_evidence');
    }
    for (const check of result.checks) {
      const fact = facts.get(check.check_id);
      if (fact === undefined || fact.value !== check.value) errors.push('fact_mismatch');
      if (
        check.evidence_refs.some((id) => !result.evidence_refs.includes(id)) ||
        fact?.evidence_refs.some((id) => !check.evidence_refs.includes(id))
      )
        errors.push('check_evidence_mismatch');
    }
    const values = criteria.map((criterion) => facts.get(criterion.check_id)?.value ?? null);
    const expected =
      'all' in request.success_contract
        ? values.includes(false)
          ? 'failed'
          : values.includes(null)
            ? 'unknown'
            : 'passed'
        : values.includes(true)
          ? 'passed'
          : values.includes(null)
            ? 'unknown'
            : 'failed';
    if (result.status !== expected) errors.push('verdict_fact_conflict');
    return [...new Set(errors)];
  }
  /** Identity/lineage gate; the supplied verdict must already pass verdict(). */
  recovery(previous: RecoveryRecord, next: RecoveryRecord, verdict?: VerificationResult): string[] {
    this.contracts.parse('RecoveryRecord', previous);
    this.contracts.parse('RecoveryRecord', next);
    if (verdict !== undefined) this.contracts.parse('VerificationResult', verdict);
    const errors = this.transition('recovery', previous.status, next.status);
    if (
      previous.recovery_id !== next.recovery_id ||
      previous.task_id !== next.task_id ||
      previous.original_goal_id !== next.original_goal_id ||
      previous.goal_contract_id !== next.goal_contract_id ||
      previous.goal_contract_version !== next.goal_contract_version ||
      previous.failed_attempt_id !== next.failed_attempt_id ||
      previous.decision_owner_id !== next.decision_owner_id
    )
      errors.push('recovery_identity_mismatch');
    if (
      previous.attempt_ids.some((id, index) => next.attempt_ids[index] !== id) ||
      next.attempt_ids.includes(next.failed_attempt_id)
    )
      errors.push('recovery_lineage_mismatch');
    if (next.status === 'resolved_success') {
      if (
        verdict === undefined ||
        verdict.status !== 'passed' ||
        next.verdict_ref !== verdict.verdict_id ||
        verdict.task_scope.task_id !== next.task_id ||
        verdict.task_scope.goal_id !== next.original_goal_id ||
        verdict.task_scope.recovery_id !== next.recovery_id ||
        verdict.goal_contract_id !== next.goal_contract_id ||
        verdict.goal_contract_version !== next.goal_contract_version ||
        !next.attempt_ids.includes(verdict.task_scope.attempt_id)
      )
        errors.push('original_goal_not_verified');
    }
    return errors;
  }
}
