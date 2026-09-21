import { z } from 'zod';
import type { LocalStore } from './local-store.js';

const attachmentId = z
  .string()
  .length(71)
  .regex(/^sha256:[a-f0-9]{64}$/);

export interface StoredImageReferences {
  storeSequence: number;
  recordsScanned: number;
  references: {
    attachmentId: string;
    recordCount: number;
    exampleKeys: string[];
  }[];
}

export function inspectStoredImageReferences(store: LocalStore): StoredImageReferences {
  const storeSequence = store.statistics().sequence;
  const references = new Map<string, StoredImageReferences['references'][number]>();
  let recordsScanned = 0;
  for (const record of store.scan<unknown>('')) {
    recordsScanned++;
    const ids = new Set<string>();
    const pending = [record.value];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object') continue;
      if (Object.hasOwn(value, 'attachmentId'))
        ids.add(attachmentId.parse((value as Record<string, unknown>).attachmentId));
      for (const child of Object.values(value))
        if (child && typeof child === 'object') pending.push(child);
    }
    for (const id of ids) {
      const existing = references.get(id);
      if (existing) {
        existing.recordCount++;
        if (existing.exampleKeys.length < 4) existing.exampleKeys.push(record.key);
      } else references.set(id, { attachmentId: id, recordCount: 1, exampleKeys: [record.key] });
    }
  }
  return { storeSequence, recordsScanned, references: [...references.values()] };
}
