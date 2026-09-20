import { Context, Service } from '@deepseek-ai/cordis';
import { freezeMessage, type ContentBlock, type Message } from '@deepseek-ai/dsh-llm';
import { deriveEventMessage, type Session, type SessionEvent } from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-token-meter';
import type {} from '@deepseek-ai/dsh-compaction';

export interface VisualHistoryOptions {
  /** Image blocks, including repeated references. Keep complete message groups. */
  maxImages: number;
}
export function visualHistoryOptions(input: VisualHistoryOptions): VisualHistoryOptions {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== 'maxImages') ||
    !Number.isSafeInteger(input.maxImages) ||
    input.maxImages < 1 ||
    input.maxImages > 1024
  )
    throw new Error('visualHistory.maxImages must be an integer from 1 to 1024.');
  return { maxImages: input.maxImages };
}

export function imageReferences(blocks: readonly ContentBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === 'image'
      ? [block.attachment.attachmentId]
      : block.type === 'tool-result'
        ? imageReferences(block.content)
        : [],
  );
}
function omitImages(blocks: readonly ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === 'image')
      return {
        type: 'text' as const,
        text: `[Historical image omitted from model context: ${JSON.stringify(block.attachment.attachmentId)}. Original evidence remains in the session audit; use an authorized evidence tool to view it again.]`,
      };
    if (block.type === 'tool-result') return { ...block, content: omitImages(block.content) };
    return block;
  });
}

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'edh/visual-history': {
      maxImages: number;
      incomingImages: number;
      retainedImages: number;
      omitted: { originalSeq: number; replacementSeq: number; attachmentIds: string[] }[];
    };
  }
}
interface Candidate {
  event: SessionEvent<'user/message'> | SessionEvent<'tool/result'>;
  message: Message;
  ids: string[];
}

/** Embodied image retention through native logged surface replacement, never a second loop. */
export class VisualHistory extends Service {
  static inject = ['tokenMeter'];
  readonly policy: VisualHistoryOptions;
  constructor(ctx: Context, config: VisualHistoryOptions) {
    super(ctx, 'edhVisualHistory');
    this.policy = Object.freeze(visualHistoryOptions(config));
    ctx.on(
      'agent/pre-step',
      async ({ agent, messages, signal }, next) => {
        signal.throwIfAborted();
        // Prune before native pressure summarization, reserving space for claimed input.
        this.prune(agent.session, messages);
        const decision = await next();
        signal.throwIfAborted();
        // Contributors can add explicit input. Check the actual entered batch as well.
        if (decision.kind === 'enter') this.prune(agent.session, decision.messages);
        return decision;
      },
      { prepend: true },
    );
  }

  private prune(session: Session, incoming: readonly Message[]): void {
    const incomingImages = incoming.reduce((n, m) => n + imageReferences(m.content).length, 0);
    const candidates: Candidate[] = [];
    let unseen = true;
    const protectedSeqs = new Set<number>();
    // A tool result after the last assistant response has not reached a model yet.
    // Scan surface order, not event seq order: replacement seqs are newer audit entries.
    for (const seq of [...session.surface.nodes].reverse()) {
      const event = session.eventAt(seq)!;
      if (event.type === 'assistant/message') unseen = false;
      if (event.type !== 'user/message' && event.type !== 'tool/result') continue;
      const message = deriveEventMessage(event)!;
      const ids = imageReferences(message.content);
      if (!ids.length) continue;
      candidates.push({ event, message, ids });
      if (unseen) protectedSeqs.add(seq);
    }
    if (!incomingImages && !protectedSeqs.size && candidates[0])
      protectedSeqs.add(candidates[0].event.seq);
    let kept =
      incomingImages +
      candidates.reduce((n, c) => n + (protectedSeqs.has(c.event.seq) ? c.ids.length : 0), 0);
    if (kept > this.policy.maxImages)
      throw new Error(
        `Fresh observation batch requires ${kept} image blocks; visualHistory.maxImages is ${this.policy.maxImages}. Increase the budget or request fewer views; no fresh images were omitted.`,
      );
    const remove: Candidate[] = [];
    let full = false;
    for (const c of candidates) {
      if (protectedSeqs.has(c.event.seq)) continue;
      if (!full && kept + c.ids.length <= this.policy.maxImages) kept += c.ids.length;
      else {
        full = true;
        remove.push(c);
      }
    }
    if (!remove.length) return;
    const omitted: { originalSeq: number; replacementSeq: number; attachmentIds: string[] }[] = [];
    for (const { event, message, ids } of remove) {
      const replacement = freezeMessage({ ...message, content: omitImages(message.content) });
      // Keep the native shadow-price event adjacent to its replacement for replay metering.
      session.append('compaction/prune', {
        shadowedRange: { start: event.seq, end: event.seq },
        shadowedSeqs: [event.seq],
        shadowedTokenCount: this.ctx.tokenMeter.estimateMessage(message),
      });
      const options = {
        surfaceOp: { op: 'replace' as const, start: event.seq, end: event.seq },
        sourceEventSeqs: [event.seq],
      };
      const landed =
        event.type === 'user/message'
          ? session.append('user/message', replacement as typeof event.data, options)
          : session.append(
              'tool/result',
              { ...event.data, message: replacement as typeof event.data.message },
              options,
            );
      omitted.push({ originalSeq: event.seq, replacementSeq: landed.seq, attachmentIds: ids });
    }
    session.append('edh/visual-history', {
      maxImages: this.policy.maxImages,
      incomingImages,
      retainedImages: kept,
      omitted,
    });
  }
}
