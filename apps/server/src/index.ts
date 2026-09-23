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
