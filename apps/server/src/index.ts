/** Public application assembly; agent turns and native tool dispatch remain DSH-owned. */
export { createDshHost, type ModelBinding } from './runtime.js';
export {
  startServer,
  startDemoServer,
  type LocalServerOptions,
  type DemoServerOptions,
} from './http-server.js';
export type {
  ServerDeployment,
  TaskPreset,
  LaunchProfile,
  SessionEnvironment,
  DeploymentServices,
} from './deployment.js';
export { UpperRun, type ApplicationOptions } from './application.js';
export { nativeWorkspaceRetention } from './native-workspace-retention.js';
export {
  ManagedServices,
  managedServiceConfigurations,
  type ManagedServiceConfiguration,
  type ManagedServiceLifecycle,
  type ManagedServiceStatus,
  type ManagedServiceLease,
} from './managed-services.js';
export type {
  DeploymentRetentionFactory,
  DeploymentRetentionContext,
  DeploymentRetentionBinding,
} from './deployment-retention.js';
export {
  DomainRetention,
  DomainRetentionConflict,
  type DomainRecordOwner,
  type DomainReferenceLease,
  type DomainReferenceSource,
  type DomainRetentionPolicy,
  type DomainRetirementPreview,
} from './domain-retention.js';
export type { TaskDefinition, TaskCatalogDefinition } from '@edh/tasks';
export { createNativeWorkerEnvironment, type NativeWorkerConfiguration } from './native-worker.js';
export { sessionRecordOwners } from './session-record-owners.js';
export { evidenceRecordOwners } from './evidence-record-owners.js';
export { reportRecordOwners } from './report-record-owners.js';
export { taskRecordOwners } from './task-record-owners.js';
export { runRecordOwners, type RunRecordOwnerOptions } from './run-record-owners.js';
export { RunEventReferences, type EventReferenceExtension } from './event-record-owners.js';
export {
  applicationRecordOwners,
  type ApplicationReferenceExtension,
} from './application-record-owners.js';
export { nativeAuditRecordOwners } from './native-audit-record-owners.js';
export {
  RequestIdentityArchives,
  RequestArchiveConflict,
  archivedRequestKey,
} from './request-identity-archives.js';
export {
  workspaceRecordOwners,
  type WorkspaceReferenceExtension,
} from './workspace-record-owners.js';
