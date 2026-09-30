import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import type { Context } from '@deepseek-ai/cordis';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { ContractValidator, PolicyRequest, ActionChunk } from '@edh/contracts';
import { DshGptPolicy, type GptPolicyOptions } from './gpt-policy.js';

const jsonObject = z.record(z.string(), z.json());
const toolResult = z
  .object({
    type: z.literal('policy_tool_result'),
    id: z.string().min(1),
    request_id: z.string().min(1),
    result: jsonObject,
  })
  .strict();

export interface GptPolicyServerOptions {
  host?: string;
  port: number;
  apiKey?: string;
  images: AttachmentStore;
  policy: Omit<GptPolicyOptions, 'mode' | 'observation' | 'providerTool' | 'requirePlan' | 'event'>;
  modes: readonly ('direct' | 'hybrid')[];
  onError(error: unknown): void;
}

export async function serveGptPolicy(
  host: Context,
  validator: ContractValidator,
  options: GptPolicyServerOptions,
) {
  if (
    !Number.isSafeInteger(options.port) ||
    options.port < 0 ||
    options.port > 65535 ||
    !options.modes.length ||
    new Set(options.modes).size !== options.modes.length ||
    options.modes.some((mode) => mode !== 'direct' && mode !== 'hybrid')
  )
    throw new Error('Invalid policy gateway port or execution modes.');
  const address = options.host ?? '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(address) && !options.apiKey)
    throw new Error('A network-exposed policy gateway requires authentication.');
  const server = new WebSocketServer({
    host: address,
    port: options.port,
    maxPayload: 32 * 1024 * 1024,
    perMessageDeflate: false,
    verifyClient: ({ req }: { req: IncomingMessage }) => {
      if (!options.apiKey) return true;
      const supplied = Buffer.from(req.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${options.apiKey}`);
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    },
  });
  const tasks = new Set<Promise<unknown>>();
  server.on('connection', (socket) => {
    let policy: DshGptPolicy | undefined;
    let mode: 'direct' | 'hybrid' | undefined;
    let active: PolicyRequest | undefined;
    let controller: AbortController | undefined;
    const pending = new Map<
      string,
      { resolve(value: z.infer<typeof jsonObject>): void; reject(error: Error): void }
    >();
    const send = (value: unknown) => {
      if (socket.readyState !== WebSocket.OPEN) throw new Error('Policy socket is closed.');
      socket.send(JSON.stringify(value));
    };
    const providerTool: GptPolicyOptions['providerTool'] = async (
      request,
      operation,
      inputs,
      signal,
    ) => {
      signal.throwIfAborted();
      if (!active || active.request_id !== request.request_id || pending.size >= 32)
        throw new Error('Policy tool has no current inference scope.');
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const abort = () => {
          pending.delete(id);
          reject(signal.reason);
        };
        signal.addEventListener('abort', abort, { once: true });
        pending.set(id, {
          resolve(value) {
            signal.removeEventListener('abort', abort);
            resolve(value);
          },
          reject(error) {
            signal.removeEventListener('abort', abort);
            reject(error);
          },
        });
        try {
          send({
            type: 'policy_tool',
            id,
            request_id: request.request_id,
            operation,
            arguments: inputs,
          });
        } catch (error) {
          pending.delete(id);
          signal.removeEventListener('abort', abort);
          reject(error);
        }
      });
    };
    const terminate = (error: unknown) => {
      controller?.abort(error);
      for (const promise of pending.values())
        promise.reject(new Error('Policy connection terminated.'));
      pending.clear();
      options.onError(error);
      if (socket.readyState === WebSocket.OPEN) {
        send({ error: 'policy_inference_failed' });
        socket.close(1011, 'Policy request failed');
      }
    };
    socket.on('error', terminate);
    socket.on('close', () => {
      controller?.abort(new Error('Policy client disconnected.'));
      for (const promise of pending.values())
        promise.reject(new Error('Policy client disconnected.'));
      pending.clear();
      if (policy) {
        const closing = policy.close();
        tasks.add(closing);
        void closing.finally(() => tasks.delete(closing)).catch(options.onError);
      }
    });
    socket.on('message', (bytes, binary) => {
      try {
        if (binary) throw new Error('EDH GPT gateway requires JSON text messages.');
        const input = jsonObject.parse(JSON.parse(bytes.toString()));
        if (input.type === 'policy_tool_result') {
          const result = toolResult.parse(input);
          const promise = pending.get(result.id);
          if (!active || result.request_id !== active.request_id || !promise)
            throw new Error('Unexpected or stale policy tool response.');
          pending.delete(result.id);
          promise.resolve(result.result);
          return;
        }
        if (active) throw new Error('Only one policy inference is admitted per connection.');
        const request = structuredClone(validator.parse('PolicyRequest', input));
        const observation = jsonObject.parse(request.observation);
        const selected = z.enum(['direct', 'hybrid']).parse(observation.execution_mode);
        if (!options.modes.includes(selected) || (mode && mode !== selected))
          throw new Error('Execution mode is unavailable or changed within this connection.');
        if (observation.control_mode !== (options.policy.controlMode ?? '0-shot'))
          throw new Error('Demonstration configuration differs from the admitted worker.');
        if (!policy) {
          mode = selected;
          policy = new DshGptPolicy(host, validator, {
            ...options.policy,
            mode,
            requirePlan: true,
            providerTool,
            event: (data) => {
              if (socket.readyState === WebSocket.OPEN && !controller?.signal.aborted)
                send({ type: 'policy_event', data });
            },
            observation: async (ticket, signal) => {
              const value = jsonObject.parse(ticket.observation);
              const cameras = z
                .record(
                  z.string(),
                  z
                    .object({
                      mime_type: z.literal('image/png'),
                      width: z.number().int().positive().max(1024),
                      height: z.number().int().positive().max(1024),
                      data_base64: z.string().min(1).max(1_400_000),
                    })
                    .strict(),
                )
                .parse(value.cameras);
              if (
                Object.keys(cameras).length !== 3 ||
                ['cam_high', 'cam_left_wrist', 'cam_right_wrist'].some(
                  (name) => !Object.hasOwn(cameras, name),
                )
              )
                throw new Error('RoboDojo requires the three declared camera frames.');
              signal.throwIfAborted();
              const images = await options.images.saveImages(
                Object.entries(cameras).map(([name, camera]) => ({
                  name,
                  mediaType: camera.mime_type,
                  data: Buffer.from(camera.data_base64, 'base64'),
                })),
              );
              signal.throwIfAborted();
              if (
                Object.values(cameras).some(
                  (camera, index) =>
                    images[index]!.width !== camera.width ||
                    images[index]!.height !== camera.height,
                )
              )
                throw new Error('Camera pixel metadata differs from the stored image.');
              const { cameras: _cameras, ...context } = value;
              return {
                images,
                context: {
                  ...context,
                  cameras: Object.entries(cameras).map(([name, camera]) => ({
                    name,
                    width: camera.width,
                    height: camera.height,
                  })),
                },
              };
            },
          });
        }
        active = request;
        controller = new AbortController();
        const operation = policy
          .infer(request, controller.signal)
          .then(send)
          .catch(terminate)
          .finally(() => {
            active = undefined;
          });
        tasks.add(operation);
        void operation.finally(() => tasks.delete(operation));
      } catch (error) {
        terminate(error);
      }
    });
  });
  await once(server, 'listening');
  const bound = server.address();
  if (!bound || typeof bound === 'string') throw new Error('Policy gateway has no TCP address.');
  return {
    port: bound.port,
    async close() {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      const results = await Promise.allSettled([...tasks]);
      const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => (result as PromiseRejectedResult).reason);
      if (failures.length) throw new AggregateError(failures, 'Policy gateway shutdown failed.');
    },
  };
}

export async function requestPolicyProposal(
  uri: string,
  request: PolicyRequest,
  validator: ContractValidator,
  signal: AbortSignal,
): Promise<ActionChunk> {
  const endpoint = new URL(uri);
  if (
    !['ws:', 'wss:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  )
    throw new Error('Invalid lower-policy WebSocket endpoint.');
  signal.throwIfAborted();
  const socket = new WebSocket(uri, {
    perMessageDeflate: false,
    maxPayload: 32 * 1024 * 1024,
    handshakeTimeout: 30_000,
  });
  let rejectResponse: ((error: unknown) => void) | undefined;
  const abort = () => {
    rejectResponse?.(signal.reason);
    socket.terminate();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await once(socket, 'open', { signal });
    const response = new Promise<unknown>((resolve, reject) => {
      rejectResponse = reject;
      socket.once('error', reject);
      socket.once('close', () => reject(new Error('Lower policy closed without a result.')));
      socket.once('message', (bytes, binary) => {
        try {
          if (binary) throw new Error('Lower policy must implement the EDH JSON codec.');
          resolve(JSON.parse(bytes.toString()));
        } catch (error) {
          reject(error);
        }
      });
    });
    const observation = jsonObject.parse(request.observation);
    socket.send(
      JSON.stringify({ ...request, observation: { ...observation, execution_mode: 'policy' } }),
    );
    return validator.parse('ActionChunk', await response);
  } finally {
    signal.removeEventListener('abort', abort);
    socket.terminate();
  }
}
