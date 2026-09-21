import { z } from 'zod';
import {
  SessionLogOffset,
  SessionSeq,
  type Session,
  type SessionEventArchive,
} from '@deepseek-ai/dsh-session';
import { SessionAudits } from './session-audits.js';
import type { LocalStore } from './local-store.js';

export interface SessionHistoryOptions {
  maxResidentEvents: number;
  maxResidentBytes: number;
}
export const defaultSessionHistory = Object.freeze({
  maxResidentEvents: 256,
  maxResidentBytes: 8 * 1024 * 1024,
});
const policySchema = z
  .object({
    maxResidentEvents: z.number().int().positive().safe(),
    maxResidentBytes: z.number().int().positive().safe(),
  })
  .strict();
export function sessionHistoryOptions(input: unknown): SessionHistoryOptions {
  return policySchema.parse(input);
}
export interface SessionHistoryStatus {
  eventCount: number;
  archivedBefore: number;
  releasedEvents: number;
  residentEvents: number;
  residentBytes: number;
}
export class SessionHistory {
  readonly policy: Readonly<SessionHistoryOptions>;
  private readonly audits: SessionAudits;
  private readonly archives = new WeakMap<
    Session,
    { runId: string; assignmentId: string; reader: SessionEventArchive }
  >();
  constructor(store: LocalStore, input: SessionHistoryOptions = defaultSessionHistory) {
    this.audits = new SessionAudits(store);
    this.policy = Object.freeze(sessionHistoryOptions(input));
  }
  retain(runId: string, assignmentId: string, session: Session): SessionHistoryStatus {
    let archive = this.archives.get(session);
    if (archive && (archive.runId !== runId || archive.assignmentId !== assignmentId))
      throw new Error('Native session history ownership cannot change.');
    this.audits.appendNative(runId, assignmentId, session);
    if (!archive) {
      archive = {
        runId,
        assignmentId,
        reader: this.audits.archive(runId, assignmentId, session.id),
      };
      this.archives.set(session, archive);
    }
    const start = session.residentStartSeq;
    let boundary = session.seq;
    let residentBytes = 0;
    while (boundary > start && session.seq - boundary < this.policy.maxResidentEvents) {
      const event = session.eventAt(SessionSeq(boundary - 1));
      if (!event) throw new Error('Native resident event is missing.');
      const size = Buffer.byteLength(JSON.stringify(event));
      if (residentBytes + size > this.policy.maxResidentBytes) break;
      residentBytes += size;
      boundary = SessionLogOffset(boundary - 1);
    }
    if (boundary > start) {
      session.releaseEvents(boundary, archive.reader);
    }
    return {
      eventCount: session.seq,
      archivedBefore: session.residentStartSeq,
      releasedEvents: session.residentStartSeq - start,
      residentEvents: session.seq - session.residentStartSeq,
      residentBytes,
    };
  }
}
