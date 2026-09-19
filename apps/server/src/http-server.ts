import { AssignmentReports } from '@edh/communication';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { LocalStore, SessionAudits } from '@edh/storage';
import { SkillLibrary } from '@edh/memory';
import { RunHistory, type RunState } from '@edh/tasks';
import { createDshHost } from './runtime.js';
import { UpperRun, terminal } from './application.js';
import { prepareDeployment, type ServerDeployment } from './deployment.js';
import type { DemoDeploymentOptions } from './demo-deployment.js';

export interface LocalServerOptions {
  root: string;
  dataDirectory: string;
  port?: number;
  deployment: ServerDeployment;
}
export interface DemoServerOptions extends DemoDeploymentOptions {
  dataDirectory: string;
  port?: number;
}
async function readValidator(root: string): Promise<ContractValidator> {
  return new ContractValidator(
    JSON.parse(
      await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
    ),
  );
}
export async function startDemoServer(options: DemoServerOptions) {
  const { createDemoDeployment } = await import('./demo-deployment.js');
  return startServer({
    ...options,
    deployment: createDemoDeployment(options, await readValidator(options.root)),
  });
}
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new HttpError(415, 'Expected application/json.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 16384) throw new HttpError(413, 'Request exceeds 16 KiB.');
    chunks.push(buffer);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Expected a JSON object.');
  }
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}
/** Local single-user console service assembled from explicit trusted deployment bindings. */
export async function startServer(options: LocalServerOptions) {
  const validator = await readValidator(options.root);
  const deployment = prepareDeployment(options.deployment, validator);
  const scenarios = Object.keys(deployment.tasks);
  const team = await new FileTeamLoader({
    validator,
    builtinDirectory: resolve(options.root, 'harness/agent-runtime/agents/roles'),
    roleRoot: deployment.roleRoot,
    defaultModel: deployment.metadata.defaultModel,
    models: Object.keys(deployment.metadata.models),
    tools: deployment.metadata.tools,
    providers: deployment.metadata.providers,
    ...(deployment.physicalProfile
      ? {
          promptContext: deployment.physicalProfile.embodiment.promptContext,
          ...(deployment.physicalProfile.rolePromptAdditions
            ? { rolePromptAdditions: deployment.physicalProfile.rolePromptAdditions }
            : {}),
        }
      : {}),
  }).inspect(deployment.teamFile);
  for (const tool of deployment.physicalProfile?.embodiment.requiredTools ?? [])
    if (!deployment.metadata.tools.includes(tool))
      throw new Error(`Physical profile requires unavailable tool: ${tool}`);
  if (team.definition.entrypoint !== team.definition.bindings.decision_owner)
    throw new Error('This application requires the entrypoint to be the decision owner.');
  const deploymentDigest = deployment.digest + ':' + team.sourceDigest;
  let ownedStore: LocalStore | undefined;
  let host: Context | undefined;
  try {
    host = await createDshHost(deployment.adapters, deployment.contextManagement);
    if (deployment.contextManagement && deployment.contextManagement.compaction?.auto !== false) {
      for (const route of Object.values(deployment.metadata.models)) {
        const model = await host.llm.resolveModelInfo(route.provider, route.model);
        if (!model.context?.contextWindow)
          throw new Error(
            `Automatic compaction requires contextWindow for ${route.provider}/${route.model}.`,
          );
      }
    }
    const store = (ownedStore = new LocalStore(options.dataDirectory));
    const reports = new AssignmentReports(store, validator);
    reports.reconcileInterruptedDeliveries();
    const skills = new SkillLibrary(store, validator);
    skills.exportAll();
    const history = new RunHistory(store);
    for (const record of store.list<RunState>('run:'))
      history.interrupt(record.value, record.version);
    const publicConfiguration = {
      mode: deployment.metadata.source,
      deploymentId: deployment.metadata.id,
      deploymentVersion: deployment.metadata.version,
      deploymentDigest,
      description: deployment.metadata.description,
      models: deployment.metadata.models,
      ...(deployment.contextManagement ? { contextManagement: deployment.contextManagement } : {}),
      ...(deployment.metadata.physicalProfile
        ? { physicalProfile: deployment.metadata.physicalProfile }
        : {}),
      taskPresets: Object.fromEntries(
        scenarios.map((id) => [
          id,
          {
            label: deployment.tasks[id]!.label,
            instruction: deployment.tasks[id]!.instruction,
          },
        ]),
      ),
      team: team.definition,
      roles: team.members,
      digest: team.sourceDigest,
      tools: deployment.metadata.tools,
      scenarios,
      goal: deployment.tasks[scenarios[0]!]!.goal,
      scenarioGoals: Object.fromEntries(scenarios.map((id) => [id, deployment.tasks[id]!.goal])),
      physicalRuntime:
        deployment.metadata.source === 'test_fixture' ? 'not_connected' : 'deployment_bound',
      model: deployment.metadata.defaultModel,
    };
    const dsh = host;
    let active: UpperRun | undefined;
    let admitting = false;
    let closing = false;
    let admissionDone: Promise<void> | undefined;
    let closePromise: Promise<void> | undefined;
    const shutdown = new AbortController();
    const streams = new Map<
      ServerResponse,
      {
        runId: string;
        timer: ReturnType<typeof setTimeout> | null;
        blocked: boolean;
        dirty: boolean;
      }
    >();
    const runView = (id: string) => {
      const state =
        active?.state.id === id
          ? active.snapshot()
          : (() => {
              const record = store.get<RunState>(`run:${id}`);
              return record ? history.restore(record.value) : undefined;
            })();
      if (!state) throw new HttpError(404, 'Run not found.');
      return {
        ...state,
        configuration: store.get(`run-config:${id}`)?.value ?? null,
        readOnly: active?.state.id !== id || terminal(state.state),
        plan: store.get(`plan:${id}`)?.value ?? null,
        roleReports: Object.keys(state.assignments)
          .map((assignmentId) => ({ assignmentId, ...reports.status(assignmentId) }))
          .filter((row) => row.latestReport),
        skills: state.skillIds.map((skillId) => skills.load(skillId)),
      };
    };
    const send = (res: ServerResponse, id: string) => {
      if (res.destroyed) return;
      const entry = streams.get(res);
      if (!entry) return;
      if (entry.blocked) {
        entry.dirty = true;
        return;
      }
      const state = runView(id);
      const bytes = `id: ${state.events.length}\nevent: snapshot\ndata: ${JSON.stringify(state)}\n\n`;
      if (!res.write(bytes)) {
        entry.blocked = true;
        res.once('drain', () => {
          entry.blocked = false;
          if (entry.dirty) {
            entry.dirty = false;
            send(res, id);
          }
        });
      }
    };
    const changed = (state: RunState) => {
      for (const [res, entry] of streams)
        if (entry.runId === state.id && !entry.timer) {
          entry.timer = setTimeout(() => {
            entry.timer = null;
            send(res, entry.runId);
          }, 60);
        }
    };
    const server = createServer((req, res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
      );
      void (async () => {
        if (closing) throw new HttpError(503, 'Server is stopping.');
        const port = (server.address() as AddressInfo).port;
        if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? ''))
          throw new HttpError(403, 'Unrecognized local host.');
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
          throw new HttpError(403, 'Cross-origin access is disabled.');
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const method = req.method ?? 'GET';
        if (method === 'GET' && url.pathname === '/api/config')
          return json(res, 200, publicConfiguration);
        if (method === 'GET' && url.pathname === '/api/runs')
          return json(res, 200, {
            runs: store
              .list<RunState>('run:')
              .map((r) => ({
                id: r.value.id,
                state: r.value.state,
                scenario: r.value.scenario,
                createdAt: r.value.createdAt,
                instruction: r.value.instruction,
              }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 100),
            activeId: active?.state.id ?? null,
          });
        if (method === 'POST' && url.pathname === '/api/runs') {
          const data = await body(req);
          if (Object.keys(data).some((k) => !['scenario', 'requestId'].includes(k)))
            throw new HttpError(
              400,
              'Only scenario and requestId are accepted; choose a deployment task preset.',
            );
          if (
            !scenarios.includes(data.scenario as string) ||
            typeof data.requestId !== 'string' ||
            !/^[A-Za-z0-9-]{8,80}$/.test(data.requestId)
          )
            throw new HttpError(400, 'Invalid scenario or requestId.');
          const requestKey = `request:${data.requestId}`;
          const previous = store.get<{
            scenario: string;
            runId: string | null;
            deploymentDigest?: string;
          }>(requestKey);
          if (previous) {
            if (previous.value.deploymentDigest !== deploymentDigest)
              throw new HttpError(
                409,
                'Request belongs to another deployment configuration; inspect its history.',
              );
            if (previous.value.scenario !== data.scenario)
              throw new HttpError(409, 'Idempotency key reused with different input.');
            if (!previous.value.runId)
              throw new HttpError(
                409,
                'Run admission was interrupted; inspect history before using a new requestId.',
              );
            return json(res, 200, { runId: previous.value.runId, replayed: true });
          }
          if (closing) throw new HttpError(503, 'Server is stopping.');
          if (admitting || (active && !terminal(active.state.state)))
            throw new HttpError(409, 'A run is already active.');
          admitting = true;
          let completeAdmission!: () => void;
          admissionDone = new Promise<void>((done) => {
            completeAdmission = done;
          });
          try {
            store.put(requestKey, { scenario: data.scenario, runId: null, deploymentDigest }, 0);
            const task = deployment.tasks[data.scenario as string]!;
            if (active) {
              await active.settle();
              await active.close();
            }
            const backend = await task.createBackend({
              signal: shutdown.signal,
              ...(deployment.physicalProfile ? { profile: deployment.physicalProfile } : {}),
            });
            try {
              if (closing) throw new HttpError(503, 'Server stopped during backend creation.');
              if (backend.source !== deployment.metadata.source)
                throw new Error('Backend source differs from the deployment.');
              active = new UpperRun({
                host: dsh,
                team,
                validator,
                store,
                goal: task.goal,
                allowedSubgoalChecks: task.allowedSubgoalChecks ?? [],
                predefinedGoals: task.predefinedGoals ?? [],
                additionalTools: deployment.additionalTools,
                backend,
                instruction: task.instruction,
                scenario: data.scenario as string,
                model: (id) => {
                  const binding = deployment.metadata.models[id];
                  if (!binding) throw new Error(`Unknown model binding: ${id}`);
                  return binding;
                },
                onChange: changed,
              });
            } catch (error) {
              await backend.close();
              throw error;
            }
            store.put(`run-config:${active.state.id}`, publicConfiguration, 0);
            await active.start();
            store.put(
              requestKey,
              { scenario: data.scenario, runId: active.state.id, deploymentDigest },
              1,
            );
            return json(res, 201, { runId: active.state.id });
          } finally {
            admitting = false;
            completeAdmission();
          }
        }
        const match =
          /^\/api\/runs\/([A-Za-z0-9-]+)(?:\/(events|pause|resume|stop|audit|recovery))?$/.exec(
            url.pathname,
          );
        if (match) {
          const id = match[1]!;
          const operation = match[2];
          runView(id);
          if (method === 'GET' && !operation) return json(res, 200, runView(id));
          if (method === 'GET' && operation === 'audit')
            return json(res, 200, { sessions: new SessionAudits(store).read(id) });
          if (method === 'GET' && operation === 'recovery') {
            const state = runView(id);
            return json(res, 200, {
              recovery: state.recoveryId
                ? (store.get(`recovery:${state.recoveryId}`)?.value ?? null)
                : null,
            });
          }
          if (method === 'GET' && operation === 'events') {
            if (streams.size >= 16) throw new HttpError(429, 'Too many event streams.');
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
            streams.set(res, { runId: id, timer: null, blocked: false, dirty: false });
            send(res, id);
            req.on('close', () => {
              const entry = streams.get(res);
              if (entry?.timer) clearTimeout(entry.timer);
              streams.delete(res);
            });
            return;
          }
          if (method === 'POST' && ['pause', 'resume', 'stop'].includes(operation ?? '')) {
            await body(req);
            if (active?.state.id !== id || terminal(active.state.state))
              throw new HttpError(409, 'History is read-only.');
            if (operation === 'pause') await active.pause();
            if (operation === 'resume') await active.requestResume();
            if (operation === 'stop') await active.stop();
            return json(res, 202, { accepted: true, state: active.state.state });
          }
        }
        if (
          method === 'GET' &&
          ['/', '/index.html', '/style.css', '/app.js'].includes(url.pathname)
        ) {
          const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
          const bytes = await readFile(resolve(options.root, 'apps/console/public', file));
          res.writeHead(200, {
            'Content-Type': file.endsWith('.html')
              ? 'text/html; charset=utf-8'
              : file.endsWith('.css')
                ? 'text/css; charset=utf-8'
                : 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(bytes);
          return;
        }
        throw new HttpError(404, 'Route not found.');
      })().catch((error) => {
        if (!res.headersSent)
          json(res, error instanceof HttpError ? error.status : 400, {
            error: error instanceof Error ? error.message : String(error),
          });
        else res.end();
      });
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    await new Promise<void>((accept, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 4317, '127.0.0.1', () => {
        server.removeListener('error', reject);
        accept();
      });
    });
    const heartbeat = setInterval(() => {
      for (const [res, entry] of streams)
        if (!entry.blocked && !res.destroyed) res.write(': heartbeat\n\n');
    }, 15_000);
    heartbeat.unref();
    return {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      store,
      close(): Promise<void> {
        if (closePromise) return closePromise;
        closing = true;
        closePromise = Promise.resolve().then(async () => {
          const errors: unknown[] = [];
          const cleanup = async (action: () => unknown) => {
            try {
              await action();
            } catch (error) {
              errors.push(error);
            }
          };
          clearInterval(heartbeat);
          for (const [res, entry] of streams) {
            if (entry.timer) clearTimeout(entry.timer);
            res.end();
          }
          streams.clear();
          await admissionDone;
          await cleanup(() => active?.close());
          await cleanup(() => dsh.fiber.dispose());
          await cleanup(
            () =>
              new Promise<void>((done, reject) => {
                server.close((error) => (error ? reject(error) : done()));
                server.closeIdleConnections();
              }),
          );
          await cleanup(() => store.close());
          if (errors.length)
            throw new AggregateError(
              errors,
              'Server shutdown failed; all cleanup stages were attempted.',
            );
        });
        shutdown.abort(new Error('Server is stopping.'));
        return closePromise;
      },
    };
  } catch (error) {
    const errors: unknown[] = [error];
    try {
      await host?.fiber.dispose();
    } catch (failure) {
      errors.push(failure);
    }
    try {
      ownedStore?.close();
    } catch (failure) {
      errors.push(failure);
    }
    if (errors.length > 1) throw new AggregateError(errors, 'Server startup and cleanup failed.');
    throw error;
  }
}
