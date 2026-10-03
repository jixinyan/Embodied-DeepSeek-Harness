import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { DomainReferenceSource } from './domain-retention.js';
import type { ImageRetentionPolicy } from './image-retention.js';
import type { WorkspaceReferenceExtension } from './workspace-record-owners.js';

export interface DeploymentRetentionContext {
  readonly store: LocalStore;
  readonly validator: ContractValidator;
  readonly providers: readonly string[];
  readonly additionalTools: readonly string[];
  readonly imageDirectory?: string;
}

export interface DeploymentRetentionBinding {
  readonly imageRetention?: ImageRetentionPolicy;
  readonly domainRetention?: {
    version: string;
    references: WorkspaceReferenceExtension;
    sources: readonly DomainReferenceSource[];
  };
}

export type DeploymentRetentionFactory = (
  context: DeploymentRetentionContext,
) => DeploymentRetentionBinding;
