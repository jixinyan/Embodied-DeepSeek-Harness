/* Generated from harness/contracts/schema/physical.schema.json. Do not edit. */

/**
 * EDH scaffold wire contracts. Structural validation only; no runtime authorization or semantic verification.
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
  | SegmentationResult;
export type SuccessContract =
  | {
      id: string;
      version: string;
      /**
       * @minItems 1
       */
      all: [SuccessCheck, ...SuccessCheck[]];
    }
  | {
      id: string;
      version: string;
      /**
       * @minItems 1
       */
      any: [SuccessCheck, ...SuccessCheck[]];
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
}
export interface Observation {
  observation_id: string;
  task_scope: TaskScope;
  sensor_id: string;
  captured_at: string;
  frame_id: string;
  media: EvidenceRef[];
  coordinate_frame?: string;
  calibration_ref?: string;
}
export interface RoleDefinition {
  role_id: string;
  description: string;
  tools: string[];
  model?: string;
  output_schema?: string;
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
    recovery_evolver: string;
  };
  tool_bindings: {
    [k: string]: string;
  };
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
}
export interface ToolResult {
  call_id: string;
  tool_id: string;
  status: "completed" | "failed" | "cancelled" | "unsupported";
  data?: {
    [k: string]: unknown;
  };
  evidence_refs: string[];
  error?: {
    code: string;
    message: string;
  };
}
export interface SuccessCheck {
  check: string;
  args: string[];
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
}
export interface MessageEnvelope {
  schema_version: "physical.message.v1";
  message_id: string;
  kind: "command" | "event" | "request" | "response" | "artifact";
  type: string;
  sender:
    | {
        agent_id: string;
      }
    | {
        service_id: string;
      };
  destination:
    | {
        agent_id: string;
      }
    | {
        service_id: string;
      }
    | {
        topic: string;
      };
  scope: TaskScope;
  correlation_id?: string;
  causation_id?: string;
  sequence: number;
  created_at: string;
  payload: {
    [k: string]: unknown;
  };
  evidence_refs: string[];
}
export interface AgentReport {
  agent_id: string;
  assignment_id: string;
  task_scope: TaskScope;
  status: "completed" | "failed" | "insufficient_context" | "cancelled";
  summary: string;
  evidence_refs: string[];
  requested_context?: string[];
}
export interface ExecutionStatus {
  execution_id: string;
  task_scope: TaskScope;
  state: "accepted" | "running" | "pausing" | "paused" | "ended";
  control_steps: number;
  policy_calls: number;
  raw_sim_steps?: number;
  stop_reason?:
    "policy_stop" | "budget_exhausted" | "verifier_pause" | "user_stop" | "backend_error" | "episode_terminated";
  device_confirmed: boolean;
  observation_refs: string[];
}
export interface VerificationResult {
  task_scope: TaskScope;
  verifier_id: string;
  status: "pending" | "running" | "passed" | "failed" | "unknown";
  goal_contract_version: string;
  boundary_event_id: string;
  checks: {
    check_id: string;
    value: boolean | null;
    evidence_refs: string[];
  }[];
  evidence_refs: string[];
  explanation: string;
}
export interface PlanDocument {
  task_id: string;
  version: number;
  items: {
    goal_id: string;
    description: string;
    status: "planned" | "active" | "waiting" | "done" | "abandoned";
  }[];
}
export interface RecoveryRecord {
  recovery_id: string;
  task_id: string;
  original_goal_id: string;
  goal_contract_version: string;
  failed_attempt_id: string;
  attempt_ids: string[];
  changes: string[];
  evidence_refs: string[];
  status: "recording" | "resolved_success" | "abandoned";
  verdict_ref?: string;
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
}
export interface SegmentationRequest {
  observation_ref: string;
  text_prompt: string;
}
export interface SegmentationResult {
  observation_ref: string;
  instances: {
    entity_id: string;
    mask_ref: string;
    confidence: number;
  }[];
  overlay_ref: string;
}
