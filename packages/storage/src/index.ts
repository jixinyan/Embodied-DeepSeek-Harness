// Architecture contract only. No runtime implementation.
import type { MessageEnvelope } from '@edh/contracts';
export interface EventStore {
  append(event: MessageEnvelope): Promise<void>;
  read(taskId: string, afterSequence: number): AsyncIterable<MessageEnvelope>;
}
export interface AssetStore {
  put(bytes: Uint8Array, contentType: string): Promise<{ readonly assetId: string }>;
  readAuthorized(assignmentId: string, assetId: string): Promise<Uint8Array>;
}
