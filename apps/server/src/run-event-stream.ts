import type { ServerResponse } from 'node:http';
import { createRunUpdate, type EventState } from '../../console/public/run-update.js';

export class RunEventStream<T extends EventState> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private blocked = false;
  private dirty = false;
  private closed = false;
  private cursor: number;

  constructor(
    readonly runId: string,
    private readonly response: ServerResponse,
    private readonly read: () => T,
    private readonly format: 'delta' | 'snapshot',
    afterSequence: number,
    onClose: () => void,
  ) {
    this.cursor = afterSequence;
    response.on('drain', () => {
      this.blocked = false;
      if (this.dirty) this.schedule(0);
    });
    response.once('close', () => {
      this.closed = true;
      if (this.timer) clearTimeout(this.timer);
      onClose();
    });
  }

  start(): void {
    this.send();
  }

  notify(): void {
    this.dirty = true;
    this.schedule(60);
  }

  heartbeat(): void {
    if (!this.closed && !this.blocked && !this.response.destroyed) this.write(': heartbeat\n\n');
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.response.end();
  }

  private schedule(delay: number): void {
    if (this.closed || this.blocked || this.timer || this.response.destroyed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.send();
    }, delay);
  }

  private write(bytes: string): void {
    if (!this.response.write(bytes)) this.blocked = true;
  }

  private send(): void {
    if (this.closed || this.response.destroyed) return;
    if (this.blocked) {
      this.dirty = true;
      return;
    }
    const state = this.read();
    if (state.id !== this.runId) throw new Error('Run stream identity changed.');
    this.dirty = false;
    if (this.format === 'snapshot') {
      this.write(`id: ${state.events.length}\nevent: snapshot\ndata: ${JSON.stringify(state)}\n\n`);
      return;
    }
    const update = createRunUpdate(state, this.cursor);
    this.write(
      `id: ${update.throughSequence}\nevent: run-update\ndata: ${JSON.stringify(update)}\n\n`,
    );
    this.cursor = update.throughSequence;
    if (update.projection === null) {
      this.dirty = true;
      this.schedule(0);
    }
  }
}
