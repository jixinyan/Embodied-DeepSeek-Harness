import { AssignmentReports } from '@edh/communication';
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Context } from '@deepseek-ai/cordis';
import { ContractValidator } from '@edh/contracts';
import type { ResolvedPhysicalRuntimeProfile } from '@edh/execution';
import { UserSessions, SessionConflict } from './user-sessions.js';
import { validateLaunchSelection } from '../../console/public/launch-selection.js';
import { consoleContentSecurityPolicy, readConsoleAsset } from './console-assets.js';
import { admitSessionTask } from './task-admission.js';
import { RunEventStream } from './run-event-stream.js';
import { HttpError, assertLocalRequest, readJsonBody as body } from './local-http.js';
import { serveEvidenceImage } from './evidence-images.js';
import { readSessionAudit } from './session-audit-view.js';
import { readRoleReports } from './report-view.js';
import { readAssignmentDetails } from './assignment-view.js';
import { readRunList, readSessionList } from './workspace-history.js';
import {
  ClarificationConflict,
  interruptClarifications,
  readClarification,
  replayClarificationResponse,
} from './clarifications.js';
import { readWorkspaceSkills } from './skill-provenance.js';
import { ImageRetention, type ImageRetentionPolicy } from './image-retention.js';
import {
  admitStorageCompaction,
  admitImageCacheCleanup,
  admitOriginalImageMaintenance,
  maintenanceBlocker,
} from './storage-maintenance.js';
import {
  runEventCursor,
  maxEventBatch,
  maxEventBatchBytes,
} from '../../console/public/run-update.js';
import { FileTeamLoader } from '@edh/teams';
import {
  LocalStore,
  LocalImageStore,
  ImageMaintenanceConflict,
  type LocalImageOptions,
  type ImageStorageMaintenance,
} from '@edh/storage';
import { SkillLibrary } from '@edh/memory';
import { RunHistory, RecoveryHistory, type RunState } from '@edh/tasks';
import { createDshHost } from './runtime.js';
import { UpperRun, terminal } from './application.js';
import { prepareDeployment, type ServerDeployment, type DeploymentServices } from './deployment.js';
import type { DemoDeploymentOptions } from './demo-deployment.js';

export interface LocalServerOptions {
  root: string;
  dataDirectory: string;
  port?: number;
  deployment:
    | ServerDeployment
    | ((services: DeploymentServices) => ServerDeployment | Promise<ServerDeployment>);
  imageStorage?: Omit<LocalImageOptions, 'directory'>;
  imageRetention?: ImageRetentionPolicy;
  mountImages?: (
    context: Context,
    directory: string,
  ) => void | ImageStorageMaintenance | Promise<void | ImageStorageMaintenance>;
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
  const { createDemoDeployment, createDemoLaunchProfiles } = await import('./demo-deployment.js');
  const validator = await readValidator(options.root);
  return startServer({
    ...options,
    imageRetention: { version: 'journal-v1', sources: [] },
    deployment: {
      ...createDemoDeployment(options, validator),
      launchProfiles: createDemoLaunchProfiles(validator, options.tickMs),
    },
  });
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
  if (options.mountImages && options.imageStorage)
    throw new Error('Configure the local image store or a custom image provider.');
  const imageContext = new Context();
  try {
    const directory = resolve(options.dataDirectory);
    let imageMaintenance: ImageStorageMaintenance | undefined;
    if (options.mountImages) {
      const mounted = await options.mountImages(imageContext, directory);
      if (mounted !== undefined) {
        if (
          !mounted ||
          typeof mounted.inspect !== 'function' ||
          typeof mounted.clearRequestCache !== 'function'
        )
          throw new Error('Image maintenance requires inspect and clearRequestCache methods.');
        if (
          mounted.objects &&
          (typeof mounted.objects.inspectObjectRetention !== 'function' ||
            typeof mounted.objects.collectUnreferencedObjects !== 'function')
        )
          throw new Error('Original-image maintenance requires inspection and collection methods.');
        imageMaintenance = mounted;
      }
    } else {
      await imageContext.plugin(LocalImageStore, { ...options.imageStorage, directory });
      const images = imageContext.attachments as LocalImageStore;
      imageMaintenance = {
        inspect: (signal) => images.inspectStorage(signal),
        clearRequestCache: (revision, signal) => images.clearRequestCache(revision, signal),
        objects: {
          inspectObjectRetention: (ids, signal) => images.inspectObjectRetention(ids, signal),
          collectUnreferencedObjects: (revision, ids, signal) =>
            images.collectUnreferencedObjects(revision, ids, signal),
        },
      };
    }
    if (!imageContext.attachments) throw new Error('Image provider did not mount attachments.');
    const services = Object.freeze({ images: imageContext.attachments });
    const deployment =
      typeof options.deployment === 'function'
        ? await options.deployment(services)
        : options.deployment;
    return await startApplication(
      { ...options, deployment },
      imageContext,
      services,
      imageMaintenance,
    );
  } catch (error) {
    try {
      await imageContext.fiber.dispose();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Application startup and image cleanup failed.');
    }
    throw error;
  }
}

async function startApplication(
  options: LocalServerOptions & { deployment: ServerDeployment },
  imageContext: Context,
  services: DeploymentServices,
  imageMaintenance?: ImageStorageMaintenance,
) {
  const validator = await readValidator(options.root);
  const deployment = prepareDeployment(options.deployment, validator);
  const scenarios = Object.keys(deployment.tasks);
  const loadTeam = (defaultModel: string, physicalProfile?: ResolvedPhysicalRuntimeProfile) =>
    new FileTeamLoader({
      validator,
      builtinDirectory: resolve(options.root, 'harness/agent-runtime/agents/roles'),
      roleRoot: deployment.roleRoot,
      defaultModel,
      models: Object.keys(deployment.metadata.models),
      tools: deployment.metadata.tools,
      providers: deployment.metadata.providers,
      ...(physicalProfile
        ? {
            promptContext: physicalProfile.embodiment.promptContext,
            ...(physicalProfile.rolePromptAdditions
              ? { rolePromptAdditions: physicalProfile.rolePromptAdditions }
              : {}),
          }
        : {}),
    }).inspect(deployment.teamFile);
  const team = await loadTeam(deployment.metadata.defaultModel, deployment.physicalProfile);
  for (const tool of deployment.physicalProfile?.embodiment.requiredTools ?? [])
    if (!deployment.metadata.tools.includes(tool))
      throw new Error(`Physical profile requires unavailable tool: ${tool}`);
  if (team.definition.entrypoint !== team.definition.bindings.decision_owner)
    throw new Error('This application requires the entrypoint to be the decision owner.');
  const launchTeams = new Map<string, typeof team>();
  for (const [id, profile] of Object.entries(deployment.launchProfiles)) {
    for (const tool of profile.physicalProfile?.embodiment.requiredTools ?? [])
      if (!deployment.metadata.tools.includes(tool))
        throw new Error(`Launch profile requires unavailable tool: ${tool}`);
    const selected = await loadTeam(profile.defaultModel, profile.physicalProfile);
    if (selected.definition.entrypoint !== selected.definition.bindings.decision_owner)
      throw new Error('Launch team entrypoint must be decision owner.');
    launchTeams.set(id, selected);
  }
  const deploymentDigest =
    deployment.digest +
    ':' +
    team.sourceDigest +
    [...launchTeams].map(([id, t]) => `:${id}:${t.sourceDigest}`).join('');
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
    const userSessions = new UserSessions(store);
    const reports = new AssignmentReports(store, validator);
    reports.reconcileInterruptedDeliveries();
    interruptClarifications(store);
    const skills = new SkillLibrary(store, validator);
    skills.exportAll();
    const history = new RunHistory(store);
    for (const record of store.scan<RunState>('run:'))
      history.interrupt(record.value, record.version);
    if (options.imageRetention && !imageMaintenance?.objects)
      throw new Error('The configured image provider does not support original-image collection.');
    const imageRetention = options.imageRetention
      ? new ImageRetention(store, validator, imageMaintenance!.objects!, options.imageRetention)
      : undefined;
    const originalCollection = () =>
      imageRetention
        ? { available: true, sourceIds: imageRetention.sourceIds }
        : { available: false, reason: 'Original-image retention ownership is not configured.' };
    const publicConfiguration = {
      mode: deployment.metadata.source,
      deploymentId: deployment.metadata.id,
      deploymentVersion: deployment.metadata.version,
      deploymentDigest,
      description: deployment.metadata.description,
      models: deployment.metadata.models,
      imageStorage: {
        available: true,
        limits: services.images.imageLimits,
        maintenance: Boolean(imageMaintenance),
        originalCollection: originalCollection(),
      },
      launchProfiles: deployment.metadata.launchProfiles,
      launchTeams: Object.fromEntries(
        [...launchTeams].map(([id, selected]) => [
          id,
          { team: selected.definition, roles: selected.members, digest: selected.sourceDigest },
        ]),
      ),
      ...(deployment.contextManagement ? { contextManagement: deployment.contextManagement } : {}),
      sessionHistory: deployment.sessionHistory,
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
    const storageBlocker = () =>
      maintenanceBlocker({
        stopping: closing,
        admitting,
        sessionBusy: userSessions.busy,
        sessionId: userSessions.activeId,
        activeTask: Boolean(active && !terminal(active.state.state)),
      });
    const storageView = async () => {
      const images = imageMaintenance
        ? { available: true, inspection: await imageMaintenance.inspect(shutdown.signal) }
        : { available: false };
      return {
        statistics: store.statistics(),
        blockedBy: storageBlocker(),
        images,
        originalCollection: originalCollection(),
      };
    };
    const streams = new Map<ServerResponse, RunEventStream<RunState>>();
    const runRecord = (id: string) => {
      const state =
        active?.state.id === id ? active.projection() : store.get<RunState>(`run:${id}`)?.value;
      if (!state) throw new HttpError(404, 'Run not found.');
      return state;
    };
    const runView = (id: string, eventSelection: 'all' | 'none' | number = 'all') => {
      const state = runRecord(id);
      const clarification = state.clarification
        ? readClarification(store, id, state.clarification.id)
        : null;
      if (clarification === undefined) throw new Error('Run clarification record is missing.');
      const recovery = state.recoveryId ? new RecoveryHistory(store).read(state.recoveryId) : null;
      const eventCount = history.total(state);
      const events =
        eventSelection === 'all'
          ? history.restore(state).events
          : eventSelection === 'none'
            ? []
            : history.page(state, eventSelection, eventCount, maxEventBatch, maxEventBatchBytes)
                .events;
      return {
        ...state,
        clarification,
        events,
        eventCount,
        recoveryStatus: recovery
          ? { id: state.recoveryId, resolved: Boolean(recovery.result), error: recovery.error }
          : null,
        ...(typeof eventSelection === 'number' ? { eventOffset: eventSelection } : {}),
        configuration: store.get(`run-config:${id}`)?.value ?? null,
        submission: store.get(`run-submission:${id}`)?.value ?? null,
        userSessionId:
          store.get<{ sessionId: string }>(`run-user-session:${id}`)?.value.sessionId ?? null,
        readOnly: active?.state.id !== id || terminal(state.state),
        plan: store.get(`plan:${id}`)?.value ?? null,
        roleReports: Object.keys(state.assignments)
          .filter((assignmentId) => !state.assignments[assignmentId]!.detailsStored)
          .map((assignmentId) => ({ assignmentId, ...reports.status(assignmentId) }))
          .filter((row) => row.latestReport),
        skills: state.skillIds.map((skillId) => skills.load(skillId)),
      };
    };
    const changed = (state: Pick<RunState, 'id' | 'state' | 'updatedAt'>) => {
      if (active?.state.id === state.id) userSessions.changed(active);
      for (const entry of streams.values()) if (entry.runId === state.id) entry.notify();
    };
    const server = createServer((req, res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', consoleContentSecurityPolicy);
      void (async () => {
        if (closing) throw new HttpError(503, 'Server is stopping.');
        const port = (server.address() as AddressInfo).port;
        assertLocalRequest(req, port);
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const method = req.method ?? 'GET';
        if (
          await serveEvidenceImage(
            req,
            res,
            url,
            { store, validator, images: services.images },
            shutdown.signal,
          )
        )
          return;
        if (method === 'GET' && url.pathname === '/api/config')
          return json(res, 200, publicConfiguration);
        if (method === 'GET' && url.pathname === '/api/storage')
          return json(res, 200, await storageView());
        if (
          method === 'POST' &&
          [
            '/api/storage/compact',
            '/api/storage/clear-request-cache',
            '/api/storage/inspect-originals',
            '/api/storage/collect-originals',
          ].includes(url.pathname)
        ) {
          const input = await body(req);
          const clearImages = url.pathname === '/api/storage/clear-request-cache';
          const inspectOriginals = url.pathname === '/api/storage/inspect-originals';
          const collectOriginals = url.pathname === '/api/storage/collect-originals';
          let imageRevision: string | undefined;
          let collectionToken: string | undefined;
          if (inspectOriginals || collectOriginals) {
            if (!imageRetention)
              throw new HttpError(501, 'Original-image retention ownership is not configured.');
            collectionToken = admitOriginalImageMaintenance(
              input,
              collectOriginals,
              storageBlocker(),
            );
          } else if (clearImages) {
            if (!imageMaintenance)
              throw new HttpError(501, 'This image provider does not expose cache maintenance.');
            imageRevision = admitImageCacheCleanup(input, storageBlocker());
          } else admitStorageCompaction(input, store.statistics(), storageBlocker());
          admitting = true;
          let release!: () => void;
          admissionDone = new Promise<void>((done) => {
            release = done;
          });
          try {
            if (active) {
              await active.settle();
              await active.close();
              active = undefined;
            }
            shutdown.signal.throwIfAborted();
            if (inspectOriginals) {
              const preview = await imageRetention!.inspect(shutdown.signal);
              return json(res, 200, {
                statistics: store.statistics(),
                blockedBy: null,
                images: { available: true, inspection: preview.inspection },
                originalCollection: { ...originalCollection(), preview },
              });
            }
            if (collectOriginals) {
              const result = await imageRetention!.collect(collectionToken!, shutdown.signal);
              return json(res, 200, {
                statistics: store.statistics(),
                blockedBy: null,
                images: { available: true, inspection: result.after },
                originalCollection: originalCollection(),
                result: { ...result, operation: 'original_image_collection' },
              });
            }
            if (clearImages) {
              const result = await imageMaintenance!.clearRequestCache(
                imageRevision!,
                shutdown.signal,
              );
              return json(res, 200, {
                statistics: store.statistics(),
                blockedBy: null,
                images: { available: true, inspection: result.after },
                originalCollection: originalCollection(),
                result: { ...result, operation: 'request_cache_clear' },
              });
            }
            const result = store.compact();
            return json(res, 200, {
              statistics: store.statistics(),
              blockedBy: null,
              originalCollection: originalCollection(),
              result: { ...result, operation: 'journal_compaction' },
            });
          } catch (failure) {
            throw new HttpError(
              shutdown.signal.aborted
                ? 503
                : failure instanceof ImageMaintenanceConflict
                  ? 409
                  : 500,
              failure instanceof Error ? failure.message : String(failure),
            );
          } finally {
            admitting = false;
            release();
          }
        }
        if (method === 'GET' && url.pathname === '/api/skills')
          return json(res, 200, readWorkspaceSkills(store, validator));
        if (method === 'GET' && url.pathname === '/api/sessions')
          return json(res, 200, readSessionList(store, url.searchParams, userSessions.activeId));
        if (method === 'POST' && url.pathname === '/api/sessions') {
          const data = await body(req);
          if (
            Object.keys(data).some(
              (k) => !['profileId', 'requestId', 'selection', 'catalogRevision'].includes(k),
            ) ||
            typeof data.profileId !== 'string' ||
            !Object.hasOwn(deployment.launchProfiles, data.profileId) ||
            typeof data.requestId !== 'string' ||
            !/^[A-Za-z0-9-]{8,80}$/.test(data.requestId)
          )
            throw new HttpError(400, 'Choose an installed launch profile and a valid request ID.');
          if (data.selection !== undefined || data.catalogRevision !== undefined) {
            if (data.catalogRevision !== deploymentDigest)
              throw new HttpError(
                409,
                'Configuration catalog changed. Refresh before starting a session.',
              );
            validateLaunchSelection(
              deployment.metadata.launchProfiles,
              data.profileId,
              data.selection,
            );
          }
          if (admitting || (!userSessions.activeId && active && !terminal(active.state.state)))
            throw new HttpError(409, 'A task is active.');
          const profile = deployment.launchProfiles[data.profileId]!;
          const selected = launchTeams.get(data.profileId)!;
          const configuration = {
            ...publicConfiguration,
            mode: profile.source ?? deployment.metadata.source,
            physicalRuntime:
              (profile.source ?? deployment.metadata.source) === 'test_fixture'
                ? 'not_connected'
                : 'deployment_bound',
            physicalProfile: profile.physicalProfile ?? null,
            launchProfile: deployment.metadata.launchProfiles[data.profileId],
            profileId: data.profileId,
            team: selected.definition,
            roles: selected.members,
            digest: selected.sourceDigest,
            model: profile.defaultModel,
          };
          const record = await userSessions.open(
            {
              profileId: data.profileId,
              requestId: data.requestId,
              deploymentDigest,
              configuration,
            },
            async (signal) => {
              if (active) {
                await active.settle();
                await active.close();
                active = undefined;
              }
              signal.throwIfAborted();
              return profile.createEnvironment({
                signal,
                services,
                ...(profile.physicalProfile ? { profile: profile.physicalProfile } : {}),
              });
            },
          );
          return json(res, 201, record);
        }
        const userSessionRoute = /^\/api\/sessions\/([A-Za-z0-9-]+)(?:\/(tasks|close))?$/.exec(
          url.pathname,
        );
        if (userSessionRoute) {
          const id = userSessionRoute[1]!;
          const operation = userSessionRoute[2];
          const record = userSessions.get(id);
          if (method === 'GET' && !operation) return json(res, 200, record);
          if (method === 'POST' && operation === 'close') {
            const data = await body(req);
            if (Object.keys(data).length)
              throw new HttpError(400, 'Session close accepts an empty object.');
            return json(res, 200, await userSessions.end(id));
          }
          if (method === 'POST' && operation === 'tasks') {
            const data = await body(req);
            const profile = deployment.launchProfiles[record.profileId];
            if (!profile) throw new HttpError(400, 'The session launch profile is unavailable.');
            const submission = admitSessionTask(data, {
              session: record,
              allowedTasks: profile.tasks,
              tasks: deployment.tasks,
              store,
            });
            if (admitting) throw new HttpError(409, 'A task is being admitted.');
            const taskId = submission.scenario;
            const result = await userSessions.task(
              id,
              taskId,
              submission.requestId,
              (backend, session) => {
                if (backend.source !== (profile.source ?? deployment.metadata.source))
                  throw new Error('Backend source differs from launch profile.');
                const run = new UpperRun({
                  host: dsh,
                  team: launchTeams.get(record.profileId)!,
                  validator,
                  store,
                  goal: submission.goal,
                  allowedSubgoalChecks: submission.allowedSubgoalChecks,
                  predefinedGoals: submission.predefinedGoals,
                  additionalTools: deployment.additionalTools,
                  sessionHistory: deployment.sessionHistory,
                  backend,
                  instruction: submission.instruction,
                  taskContext: submission.context,
                  scenario: taskId,
                  model: (alias) => {
                    const binding = deployment.metadata.models[alias];
                    if (!binding) throw new Error(`Unknown model: ${alias}`);
                    return binding;
                  },
                  onChange: changed,
                });
                store.put(`run-config:${run.state.id}`, session.configuration, 0);
                store.put(`run-submission:${run.state.id}`, submission, 0);
                active = run;
                return run;
              },
              submission.identity,
            );
            return json(res, result.replayed ? 200 : 201, result);
          }
        }
        if (method === 'GET' && url.pathname === '/api/runs')
          return json(res, 200, readRunList(store, url.searchParams, active?.state.id ?? null));
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
          if (
            userSessions.activeId ||
            userSessions.busy ||
            admitting ||
            (active && !terminal(active.state.state))
          )
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
              services,
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
                sessionHistory: deployment.sessionHistory,
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
        const clarificationRoute =
          /^\/api\/runs\/([A-Za-z0-9-]+)\/clarifications\/([a-f0-9]{64})$/.exec(url.pathname);
        if (clarificationRoute) {
          const runId = clarificationRoute[1]!;
          const questionId = clarificationRoute[2]!;
          runRecord(runId);
          const question = readClarification(store, runId, questionId);
          if (!question) throw new HttpError(404, 'Question not found.');
          if (method === 'GET') return json(res, 200, { clarification: question });
          if (method === 'POST') {
            const input = await body(req, 96 * 1024);
            const currentQuestion = readClarification(store, runId, questionId);
            if (!currentQuestion) throw new HttpError(404, 'Question not found.');
            const replay = replayClarificationResponse(currentQuestion, input);
            if (replay) return json(res, 202, { record: replay, replay: true });
            if (active?.state.id !== runId || terminal(active.state.state))
              throw new HttpError(409, 'The task is no longer accepting responses.');
            return json(res, 202, active.answerClarification(questionId, input));
          }
        }
        const match =
          /^\/api\/runs\/([A-Za-z0-9-]+)(?:\/(events|history|pause|resume|stop|audit|reports|assignments|recovery))?$/.exec(
            url.pathname,
          );
        if (match) {
          const id = match[1]!;
          const operation = match[2];
          const record = runRecord(id);
          if (method === 'GET' && !operation) {
            const events = url.searchParams.get('events') ?? 'all';
            if (events !== 'none' && events !== 'all')
              throw new HttpError(400, 'Unsupported run history selection.');
            return json(res, 200, runView(id, events));
          }
          if (method === 'GET' && operation === 'history') {
            if (url.searchParams.has('before')) {
              if (url.searchParams.has('after') || url.searchParams.has('through'))
                throw new HttpError(400, 'Choose a forward or backward history range.');
              const before = runEventCursor(url.searchParams.get('before')!, history.total(record));
              return json(
                res,
                200,
                history.before(record, before, maxEventBatch, maxEventBatchBytes),
              );
            }
            const total = history.total(record);
            const through = runEventCursor(url.searchParams.get('through') ?? String(total), total);
            const after = runEventCursor(url.searchParams.get('after') ?? '0', through);
            return json(
              res,
              200,
              history.page(record, after, through, maxEventBatch, maxEventBatchBytes),
            );
          }
          if (method === 'GET' && operation === 'audit')
            return json(res, 200, readSessionAudit(store, id, url.searchParams));
          if (method === 'GET' && operation === 'reports')
            return json(res, 200, readRoleReports(store, validator, id, url.searchParams));
          if (method === 'GET' && operation === 'assignments')
            return json(res, 200, readAssignmentDetails(store, validator, id, url.searchParams));
          if (method === 'GET' && operation === 'recovery') {
            return json(res, 200, {
              recovery: record.recoveryId
                ? new RecoveryHistory(store).restore(record.recoveryId)
                : null,
            });
          }
          if (method === 'GET' && operation === 'events') {
            if (streams.size >= 16) throw new HttpError(429, 'Too many event streams.');
            const format = url.searchParams.get('format') ?? 'snapshot';
            if (format !== 'delta' && format !== 'snapshot')
              throw new HttpError(400, 'Unsupported run stream format.');
            const resume = req.headers['last-event-id'] ?? url.searchParams.get('after') ?? '0';
            if (typeof resume !== 'string') throw new HttpError(400, 'Invalid run event cursor.');
            const cursor = format === 'delta' ? runEventCursor(resume, history.total(record)) : 0;
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
            const entry = new RunEventStream(
              id,
              res,
              (afterSequence) => runView(id, afterSequence ?? 'all'),
              format,
              cursor,
              () => streams.delete(res),
            );
            streams.set(res, entry);
            entry.start();
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
        if (method === 'GET') {
          const asset = await readConsoleAsset(options.root, url.pathname);
          if (asset) {
            res.writeHead(200, {
              'Content-Type': asset.contentType,
              'Cache-Control': 'no-cache',
            });
            res.end(asset.bytes);
            return;
          }
        }
        throw new HttpError(404, 'Route not found.');
      })().catch((error) => {
        if (!res.headersSent)
          json(
            res,
            error instanceof HttpError
              ? error.status
              : error instanceof SessionConflict || error instanceof ClarificationConflict
                ? 409
                : 400,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
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
      for (const entry of streams.values()) entry.heartbeat();
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
          for (const entry of streams.values()) entry.close();
          streams.clear();
          const sessionClose = userSessions.close();
          // Observe rejection immediately while a legacy admission may still be unwinding.
          void sessionClose.catch(() => undefined);
          await admissionDone;
          await cleanup(() => active?.close());
          await cleanup(() => sessionClose);
          await cleanup(() => dsh.fiber.dispose());
          await cleanup(
            () =>
              new Promise<void>((done, reject) => {
                server.close((error) => (error ? reject(error) : done()));
                server.closeIdleConnections();
              }),
          );
          await cleanup(() => store.close());
          await cleanup(() => imageContext.fiber.dispose());
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
