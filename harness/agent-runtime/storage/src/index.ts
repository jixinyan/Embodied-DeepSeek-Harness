// Runtime exports and interfaces for future deployment boundaries.
import type { MessageEnvelope } from '@edh/contracts';
export interface EventStore {
  append(event: MessageEnvelope): Promise<void>;
  read(taskId: string, afterSequence: number): AsyncIterable<MessageEnvelope>;
}
export interface AssetStore {
  put(bytes: Uint8Array, contentType: string): Promise<{ readonly assetId: string }>;
  readAuthorized(assignmentId: string, assetId: string): Promise<Uint8Array>;
}

export {
  LocalStore,
  type StoreStatistics,
  type StoreCompaction,
  type StoreRetirement,
  type StoreRevision,
  type StoreChange,
} from './local-store.js';
export {
  SessionHistory,
  defaultSessionHistory,
  sessionHistoryOptions,
  type SessionHistoryOptions,
  type SessionHistoryStatus,
} from './session-history.js';

export {
  SessionAudits,
  auditPageLimits,
  type SessionAuditIndexPage,
  type SessionAuditPage,
} from './session-audits.js';
export { LocalImageStore, type LocalImageOptions, type LosslessMaskStore } from './local-images.js';
export { inspectStoredImageReferences, type StoredImageReferences } from './image-references.js';
export {
  ImageMaintenanceConflict,
  type ImageStorageMaintenance,
  type ImageStorageInspection,
  type ImageCacheCleanup,
  type ImageObjectCleanup,
  type ImageObjectInspection,
  type ImageObjectMaintenance,
} from './image-maintenance.js';
