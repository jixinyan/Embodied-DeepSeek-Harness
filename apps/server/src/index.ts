import type { AgentFactory } from '@edh/agents';
import type { TeamLoader } from '@edh/teams';
import type { ExecutionClient } from '@edh/execution';
import type { VerificationCoordinator } from '@edh/verification';
import type { SkillStore } from '@edh/memory';
/** Required bindings for the future EDH host. Nothing is instantiated yet. */
export interface ServerAssembly {
  readonly agents: AgentFactory;
  readonly teams: TeamLoader;
  readonly execution: ExecutionClient;
  readonly verification: VerificationCoordinator;
  readonly skills: SkillStore;
}
