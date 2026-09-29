// Architecture contract only. No runtime implementation.
import type { ExecutionStatus, SubgoalRequest, TaskScope } from '@edh/contracts';
export interface ExecutionRequest {
  readonly scope: TaskScope;
  readonly decisionOwnerId: string;
  readonly idempotencyKey: string;
  readonly subgoal: SubgoalRequest;
}
export interface ExecutionClient {
  submit(request: ExecutionRequest): Promise<{ readonly executionId: string }>;
  query(executionId: string): Promise<ExecutionStatus>;
  pause(executionId: string, requesterId: string): Promise<void>;
  resume(executionId: string, decisionOwnerId: string): Promise<void>;
  stop(executionId: string, reason: string): Promise<void>;
  events(executionId: string): AsyncIterable<ExecutionStatus>;
}
export interface ResourceLease {
  readonly id: string;
  readonly executionId: string;
  readonly resources: readonly string[];
}
export interface ResourceCoordinator {
  acquire(executionId: string, resources: readonly string[]): Promise<ResourceLease>;
  release(lease: ResourceLease, stopConfirmationRef: string): Promise<void>;
}

export type {
  EmbodiedBackend,
  SensorSample,
  BackendUpdate,
  BackendFrame,
  BackendCallOptions,
  BackendResumeOptions,
  BackendCheckOptions,
  BackendCheckResult,
} from './backend-port.js';

export {
  resolvePhysicalRuntimeProfile,
  validatePhysicalProviderBindings,
  type PhysicalProfileValidators,
  type PhysicalRuntimeProfile,
  type ResolvedPhysicalRuntimeProfile,
  type SimulationProfile,
  type EmbodimentProfile,
  type PolicyProfile,
} from './profiles.js';

export type ExecutionMode = 'policy' | 'direct' | 'hybrid';
export {
  serveGptPolicy,
  requestPolicyProposal,
  type GptPolicyServerOptions,
} from './gpt-policy-server.js';

const LITCHI_EXECUTION_MODES: Readonly<Record<string, ExecutionMode>> = {
  gpt_only: 'direct',
  pi05_plus_gpt: 'hybrid',
};

/**
 * Resolve the optional policy execution mode. Profiles remain schema-v1
 * compatible because `policy.config` is provider-owned extensible metadata.
 */
export function resolveExecutionMode(profile: {
  policy: { config: Record<string, unknown> };
}): ExecutionMode {
  const config = profile.policy.config;
  const configured = config.execution_mode;
  const legacy = config.evaluation_method;
  const value = configured ?? legacy ?? 'policy';
  const mode = typeof value === 'string' ? (LITCHI_EXECUTION_MODES[value] ?? value) : value;
  if (mode !== 'policy' && mode !== 'direct' && mode !== 'hybrid')
    throw new Error(`Unsupported policy execution mode: ${String(value)}.`);
  if (configured !== undefined && legacy !== undefined) {
    const legacyMode =
      typeof legacy === 'string' ? (LITCHI_EXECUTION_MODES[legacy] ?? legacy) : legacy;
    if (legacyMode !== mode) throw new Error('execution_mode conflicts with evaluation_method.');
  }
  return mode;
}

export {
  DshGptPolicy,
  type GptPolicyOptions,
  type GptPolicyResponse,
  type GptControlMode,
} from './gpt-policy.js';
