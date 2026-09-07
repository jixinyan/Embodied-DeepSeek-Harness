// Architecture contract only. No runtime implementation.
import type { RoleDefinition, TeamDefinition } from '@edh/contracts';
export interface TeamRunSnapshot {
  readonly teamRunId: string;
  readonly definition: Readonly<TeamDefinition>;
  readonly roles: Readonly<Record<string, RoleDefinition>>;
  readonly sourceDigest: string;
}
export interface TeamLoader {
  inspect(file: string): Promise<TeamRunSnapshot>;
}
