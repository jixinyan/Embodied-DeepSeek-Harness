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

export { LocalStore } from './local-store.js';

export { SessionAudits } from './session-audits.js';
export { LocalImageStore, type LocalImageOptions } from './local-images.js';
