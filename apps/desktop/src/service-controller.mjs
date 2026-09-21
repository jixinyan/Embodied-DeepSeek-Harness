import { fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

export class ServiceController extends EventEmitter {
  #child;
  #exit;
  #state = { status: 'idle', url: null, error: null, log: '' };

  get state() {
    return { ...this.#state, owned: Boolean(this.#child) };
  }

  #update(fields) {
    Object.assign(this.#state, fields);
    this.emit('change', this.state);
  }

  start(configFile) {
    if (this.#child) throw new Error('Stop the current service before starting another.');
    if (typeof configFile !== 'string' || !configFile.trim())
      throw new Error('Select a launch configuration.');
    this.#update({ status: 'starting', url: null, error: null, log: '' });
    const child = fork(fileURLToPath(new URL('./service.mjs', import.meta.url)), [configFile], {
      execArgv: [],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    this.#child = child;
    let closed = false;
    this.#exit = new Promise((done) => {
      child.once('close', (code, signal) => {
        this.#child = undefined;
        const clean = closed && code === 0 && !signal && !this.#state.error;
        this.#update({
          status: clean ? 'stopped' : 'failed',
          url: null,
          error: clean
            ? null
            : (this.#state.error ??
              `Service exited without confirmed cleanup (${signal ?? code}). Resources require inspection.`),
        });
        done();
      });
    });
    child.on('error', (error) => this.#update({ status: 'failed', error: error.message }));
    for (const output of [child.stdout, child.stderr])
      output.on('data', (chunk) => {
        this.#update({ log: (this.#state.log + chunk.toString('utf8')).slice(-65536) });
      });
    child.on('message', (message) => {
      if (message?.type === 'ready') {
        const url = new URL(message.url);
        if (
          url.protocol !== 'http:' ||
          url.hostname !== '127.0.0.1' ||
          !url.port ||
          url.pathname !== '/' ||
          url.search ||
          url.hash ||
          url.username ||
          url.password
        )
          throw new Error('Service reported an invalid console URL.');
        if (this.#state.status === 'starting') this.#update({ status: 'running', url: url.href });
      } else if (message?.type === 'stopping') {
        this.#update({ status: 'stopping', url: null });
      } else if (message?.type === 'closed') {
        closed = true;
      } else if (message?.type === 'failure') {
        this.#update({ status: 'failed', url: null, error: String(message.message) });
      } else {
        throw new Error('Service reported an unknown launcher event.');
      }
    });
    this.emit('change', this.state);
    return this.state;
  }

  async stop() {
    if (!this.#child) return;
    if (this.#state.status !== 'stopping') {
      this.#update({ status: 'stopping', url: null });
      if (this.#child.connected)
        this.#child.send({ type: 'stop' }, (error) => {
          if (error) this.#update({ status: 'failed', error: error.message });
        });
    }
    await this.#exit;
  }
}
