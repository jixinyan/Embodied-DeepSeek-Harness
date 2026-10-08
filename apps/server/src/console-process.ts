export interface ConsoleService {
  readonly url: string;
  close(): Promise<void>;
}

export interface ConsoleProcessOptions<T extends ConsoleService> {
  start(): Promise<T>;
  dispose(): Promise<void>;
}

export async function runConsoleProcess<T extends ConsoleService>(
  options: ConsoleProcessOptions<T>,
): Promise<T> {
  let server: T | undefined;
  let state: 'starting' | 'running' | 'closing' = 'starting';
  let shutdownRequested = false;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      state = 'closing';
      const errors: unknown[] = [];
      try {
        await server?.close();
      } catch (error) {
        errors.push(error);
      }
      try {
        await options.dispose();
      } catch (error) {
        errors.push(error);
      } finally {
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
      }
      if (errors.length) throw new AggregateError(errors, 'Console process cleanup failed.');
    })());
  const finish = async () => {
    try {
      await close();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };
  const onSignal = () => {
    shutdownRequested = true;
    // 初始化期间保留 signal 请求，等待资源所有权完整建立后进行关闭。
    if (state === 'running') void finish();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    server = await options.start();
    state = 'running';
    if (shutdownRequested) await finish();
    process.stdout.write(`${server.url}\n`);
    return { ...server, close };
  } catch (error) {
    state = 'closing';
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Console startup and cleanup failed.');
    }
    throw error;
  }
}
