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
