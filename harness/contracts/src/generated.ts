/* Generated from harness/contracts/schema/physical.schema.json. Do not edit. */

/**
 * EDH v1 wire schemas and lifecycle topology. Schema validation is not sender authentication, provider compatibility or a running physical system.
 */
export type PhysicalContract =
  | TaskScope
  | EvidenceRef
  | Observation
  | RoleDefinition
  | TeamDefinition
  | ToolDefinition
  | ToolResult
  | SuccessCheck
  | SuccessContract
  | Budget
  | SubgoalRequest
  | InvocationBrief
  | MessageEnvelope
  | AgentReport
  | ExecutionStatus
  | VerificationResult
  | PlanDocument
  | RecoveryRecord
  | SkillMetadata
  | SegmentationRequest
  | SegmentationResult
  | ExecutionScope
  | CheckResult
  | ActionChannel
  | ActionSpec
  | ToolCall
  | ToolOperation
  | MessageTypeDefinition;
export type SuccessContract =
  | {
      id: string;
      version: string;
      /**
       * @minItems 1
       */
      all: [SuccessCheck, ...SuccessCheck[]];
      source: {
        kind: "user" | "benchmark";
        reference: string;
      };
    }
  | {
      id: string;
      version: string;
      /**
       * @minItems 1
       */
      any: [SuccessCheck, ...SuccessCheck[]];
      source: {
        kind: "user" | "benchmark";
        reference: string;
      };
    };

export interface TaskScope {
  task_id: string;
  goal_id?: string;
  attempt_id?: string;
  recovery_id?: string;
}
export interface EvidenceRef {
  id: string;
  kind: "image" | "mask" | "depth" | "video" | "event" | "report" | "stream";
  source: string;
  created_at: string;
  visibility: "agent" | "debug_only";
  task_scope: TaskScope;
  observed_at: string;
  clock_id: string;
}
export interface Observation {
  observation_id: string;
  task_scope: TaskScope;
  sensor_id: string;
  captured_at: string;
  frame_id: string;
  /**
   * @minItems 1
   */
  media: [EvidenceRef, ...EvidenceRef[]];
  coordinate_frame: string;
  calibration_ref?: string;
  schema_version: "physical.observation.v1";
  device_id: string;
  stream_id: string;
  source_sequence: number;
  clock_id: string;
  source_kind: "simulation" | "hardware" | "replay" | "test_fixture";
}
export interface RoleDefinition {
  role_id: string;
  description: string;
  tools: string[];
  model?: string;
  output_schema?: string;
  schema_version?: "physical.role.v1";
}
export interface TeamDefinition {
  schema_version: "physical.team.v1";
  team_id: string;
  entrypoint: string;
  members: {
    [k: string]: string;
  };
  bindings: {
    decision_owner: string;
    final_verifier: string;
    recovery_evolver?: string;
  };
  tool_bindings: {
    [k: string]: string;
  };
  learning_enabled?: boolean;
}
export interface ToolDefinition {
  schema_version: "physical.tool.v1";
  tool_id: string;
  version: string;
  description: string;
  input_schema: string;
  output_schema: string;
  executor: {
    kind: "native" | "python_rpc" | "mcp";
    provider: string;
    operation: string;
  };
  effect: "read_observation" | "read_state" | "write_state" | "physical_motion";
  required_capabilities: string[];
  resource_policy: "none" | "provider_serialized" | "exclusive_device";
  result_media: string[];
  execution_mode: "sync" | "async";
  timeout_s: number;
}
export interface ToolResult {
  call_id: string;
  tool_id: string;
  status: "completed" | "running" | "failed" | "cancelled" | "unsupported" | "unknown";
  data?: {
    [k: string]: unknown;
  };
  evidence_refs: string[];
  error?: {
    code: string;
    message: string;
  };
  schema_version: "physical.tool_result.v1";
  tool_version: string;
  agent_id: string;
  assignment_id: string;
  task_scope: TaskScope;
  effect: "read_observation" | "read_state" | "write_state" | "physical_motion";
  resources: string[];
  operation_id?: string;
  team_run_id: string;
  provider_id: string;
  recorded_at: string;
}
export interface SuccessCheck {
  check: string;
  args: string[];
  check_id: string;
}
export interface Budget {
  max_control_steps: number;
  max_wall_time_s: number;
}
export interface SubgoalRequest {
  goal_id: string;
  attempt_id: string;
  instruction: string;
  entities: {
    [k: string]: string;
  };
  required_capabilities: string[];
  success_contract: SuccessContract;
  budget: Budget;
  context_refs: string[];
  schema_version: "physical.subgoal.v1";
  task_id: string;
  team_run_id: string;
  decision_owner_id: string;
  owner_assignment_id: string;
  idempotency_key: string;
  recovery_id?: string;
}
export interface InvocationBrief {
  objective: string;
  task_scope: TaskScope;
  expected_output: {
    schema: string;
    recipient: string;
  };
  entities: {
    [k: string]: string;
  };
  success_contract: SuccessContract;
  known_facts: {
    statement: string;
    observed_at: string;
    evidence_refs: string[];
  }[];
  history_summary: string;
  changes: string[];
  evidence_refs: string[];
  tools_and_limits: {
    allowed_tools: string[];
    allowed_actions: string[];
    budget?: Budget;
  };
  schema_version: "physical.invocation.v1";
  assignment_id: string;
  caller_agent_id: string;
  caller_assignment_id: string;
  team_run_id: string;
}
export interface MessageEnvelope {
  schema_version: "physical.message.v1";
  message_id: string;
  kind: "command" | "event" | "request" | "response" | "artifact";
  type: string;
  sender:
    | {
        agent_id: string;
        assignment_id: string;
      }
    | {
        service_id: string;
      };
  destination:
    | {
        agent_id: string;
        assignment_id: string;
      }
    | {
        service_id: string;
      }
    | {
        topic: string;
      };
  scope: TaskScope;
  correlation_id: string;
  causation_id: string | null;
  sequence: number;
  created_at: string;
  payload: {
    [k: string]: unknown;
  };
  evidence_refs: string[];
  team_run_id: string;
  type_version: string;
}
export interface AgentReport {
  agent_id: string;
  assignment_id: string;
  task_scope: TaskScope;
  status: "completed" | "failed" | "insufficient_context" | "cancelled";
  summary: string;
  evidence_refs: string[];
  requested_context?: string[];
  schema_version: "physical.agent_report.v1";
  team_run_id: string;
  result?: {
    [k: string]: unknown;
  };
}
export interface ExecutionStatus {
  execution_id: string;
  task_scope: ExecutionScope;
  state: "accepted" | "running" | "pausing" | "paused" | "ended";
  control_steps: number;
  policy_calls: number;
  raw_sim_steps?: number;
  stop_reason?:
    "policy_stop" | "budget_exhausted" | "verifier_pause" | "user_stop" | "backend_error" | "episode_terminated";
  device_confirmed: boolean;
  observation_refs: string[];
  schema_version: "physical.execution.v1";
  state_version: number;
  elapsed_wall_time_s: number;
  clock_id: string;
  recorded_at: string;
  boundary_event_id?: string;
  boundary_at?: string;
}
export interface ExecutionScope {
  task_id: string;
  goal_id: string;
  attempt_id: string;
  recovery_id?: string;
}
export interface VerificationResult {
  task_scope: ExecutionScope;
  verifier_id: string;
  status: "pending" | "running" | "passed" | "failed" | "unknown";
  goal_contract_version: string;
  boundary_event_id: string;
  checks: CheckResult[];
  evidence_refs: string[];
  explanation: string;
  schema_version: "physical.verification.v1";
  verdict_id: string;
  verification_request_id: string;
  execution_id: string;
  verifier_assignment_id: string;
  goal_contract_id: string;
  observed_at: string;
  clock_id: string;
}
export interface CheckResult {
  check_id: string;
  value: boolean | null;
  evidence_refs: string[];
  reason?: string;
}
export interface PlanDocument {
  task_id: string;
  version: number;
  items: {
    goal_id: string;
    description: string;
    status: "planned" | "active" | "waiting" | "done" | "abandoned";
    dependencies: string[];
    success_contract: SuccessContract;
    last_verdict_ref?: string;
  }[];
  schema_version: "physical.plan.v1";
  owner_agent_id: string;
  owner_assignment_id: string;
}
export interface RecoveryRecord {
  recovery_id: string;
  task_id: string;
  original_goal_id: string;
  goal_contract_version: string;
  failed_attempt_id: string;
  /**
   * @minItems 1
   */
  attempt_ids: [string, ...string[]];
  changes: string[];
  evidence_refs: string[];
  status: "recording" | "resolved_success" | "abandoned";
  verdict_ref?: string;
  schema_version: "physical.recovery.v1";
  decision_owner_id: string;
  goal_contract_id: string;
}
export interface SkillMetadata {
  skill_id: string;
  version: string;
  task_semantics: string[];
  required_capabilities: string[];
  source_configurations: string[];
  evidence_refs: string[];
  recovery_id: string;
  verdict_ref: string;
  origin: "test_fixture" | "simulation" | "hardware";
  limitations: string[];
  schema_version: "physical.skill_metadata.v1";
  validation_status: "source_validated" | "transfer_validated" | "test_fixture";
  validated_configurations: string[];
}
export interface SegmentationRequest {
  observation_ref: string;
  text_prompt: string;
  schema_version: "physical.segmentation_request.v1";
}
export interface SegmentationResult {
  observation_ref: string;
  instances: {
    entity_id: string | null;
    mask_ref: string;
    confidence: number;
    detection_id: string;
    label: string;
    /**
     * @minItems 4
     * @maxItems 4
     */
    bbox_xyxy: [number, number, number, number];
  }[];
  overlay_ref: string;
  schema_version: "physical.segmentation_result.v1";
  provider_id: string;
  provider_version: string;
  bbox_space: "normalized_image";
}
export interface ActionChannel {
  name: string;
  quantity: "angular" | "linear" | "normalized";
  unit: "radian" | "meter" | "dimensionless" | "radian_per_second" | "meter_per_second";
  minimum: number;
  maximum: number;
}
export interface ActionSpec {
  schema_version: "physical.action_spec.v1";
  embodiment_id: string;
  version: string;
  coordinate_frame: string;
  control_mode: "joint_position" | "joint_velocity" | "end_effector_delta";
  frequency_hz: number;
  /**
   * @minItems 1
   */
  channels: [ActionChannel, ...ActionChannel[]];
}
export interface ToolCall {
  schema_version: "physical.tool_call.v1";
  call_id: string;
  tool_id: string;
  tool_version: string;
  team_run_id: string;
  agent_id: string;
  assignment_id: string;
  task_scope: TaskScope;
  idempotency_key: string;
  requested_at: string;
  deadline_at: string;
  input: {
    [k: string]: unknown;
  };
}
export interface ToolOperation {
  schema_version: "physical.tool_operation.v1";
  operation_id: string;
  call_id: string;
  tool_id: string;
  tool_version: string;
  provider_id: string;
  team_run_id: string;
  agent_id: string;
  assignment_id: string;
  task_scope: TaskScope;
  idempotency_key: string;
  state: "accepted" | "running" | "cancelling" | "completed" | "failed" | "cancelled" | "unknown";
  state_version: number;
  recorded_at: string;
  effect: "read_observation" | "read_state" | "write_state" | "physical_motion";
  resources: string[];
  result?: ToolResult;
}
export interface MessageTypeDefinition {
  type: string;
  version: string;
  kind: "command" | "event" | "request" | "response" | "artifact";
  payload_schema: string;
  bindings: {
    envelope_pointer: string;
    payload_pointer: string;
    optional: boolean;
  }[];
  payload_constraints?: {
    [k: string]: unknown;
  };
}

export interface ContractTypes {
  TaskScope: TaskScope;
  EvidenceRef: EvidenceRef;
  Observation: Observation;
  RoleDefinition: RoleDefinition;
  TeamDefinition: TeamDefinition;
  ToolDefinition: ToolDefinition;
  ToolResult: ToolResult;
  SuccessCheck: SuccessCheck;
  SuccessContract: SuccessContract;
  Budget: Budget;
  SubgoalRequest: SubgoalRequest;
  InvocationBrief: InvocationBrief;
  MessageEnvelope: MessageEnvelope;
  AgentReport: AgentReport;
  ExecutionStatus: ExecutionStatus;
  VerificationResult: VerificationResult;
  PlanDocument: PlanDocument;
  RecoveryRecord: RecoveryRecord;
  SkillMetadata: SkillMetadata;
  SegmentationRequest: SegmentationRequest;
  SegmentationResult: SegmentationResult;
  ExecutionScope: ExecutionScope;
  CheckResult: CheckResult;
  ActionChannel: ActionChannel;
  ActionSpec: ActionSpec;
  ToolCall: ToolCall;
  ToolOperation: ToolOperation;
  MessageTypeDefinition: MessageTypeDefinition;
}
