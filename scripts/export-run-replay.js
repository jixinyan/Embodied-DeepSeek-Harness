import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { buildConsoleVendor } from './build-console-vendor.mjs';
import { replayDocument } from './replay-dashboard-document.js';

const execute = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const terminalStates = new Set(['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown']);

function argumentsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || !value) throw new Error('Expected --name value arguments.');
    options[name.slice(2)] = value;
  }
  if (options['from-export']) {
    if (!options.output || options['base-url'] || options['run-id'])
      throw new Error('Required: --from-export DIRECTORY --output DIRECTORY');
    return options;
  }
  if (!options['base-url'] || !options['run-id'] || !options.output)
    throw new Error('Required: --base-url URL --run-id ID --output DIRECTORY');
  if (!/^[A-Za-z0-9-]+$/.test(options['run-id'])) throw new Error('Invalid run identity.');
  if (options.camera && !/^[A-Za-z0-9_.-]+$/.test(options.camera))
    throw new Error('Invalid camera name.');
  const origin = new URL(options['base-url']);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Expected an HTTP server.');
  return { ...options, origin: origin.href.replace(/\/$/, '') };
}

async function responseAt(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

async function jsonAt(url) {
  return (await responseAt(url)).json();
}

function encoded(value) {
  return encodeURIComponent(value);
}

async function history(origin, runId, count) {
  const events = [];
  while (events.length < count) {
    const page = await jsonAt(
      `${origin}/api/runs/${runId}/history?after=${events.length}&through=${count}`,
    );
    if (page.runId !== runId || page.afterSequence !== events.length ||
        page.eventTotal !== count || !Array.isArray(page.events) || !page.events.length)
      throw new Error('Run history pagination changed during export.');
    for (const event of page.events) {
      if (event.sequence !== events.length + 1 || !Number.isFinite(Date.parse(event.at)))
        throw new Error('Run history has an invalid sequence or timestamp.');
      events.push(event);
    }
    if (page.throughSequence !== events.length) throw new Error('Run history page is inconsistent.');
  }
  return events;
}

function imageSources(run, events) {
  const rows = [];
  const known = new Set();
  const add = (sample, event, kind) => {
    if (!sample?.evidence?.id || !Array.isArray(sample.images)) return;
    for (const image of sample.images) {
      if (!image?.attachmentId || !image.name) throw new Error('Invalid recorded image reference.');
      const identity = `${sample.evidence.id}:${image.attachmentId}`;
      if (known.has(identity)) continue;
      known.add(identity);
      rows.push({
        kind,
        eventSequence: event?.sequence ?? null,
        eventAt: event?.at ?? null,
        evidenceId: sample.evidence.id,
        observedAt: sample.evidence.observed_at ?? null,
        sampleSequence: sample.sequence ?? null,
        image,
        executionId: event?.detail?.executionId ?? null,
        policyRequestId: event?.detail?.policyRequestId ?? null,
        segmentId: event?.detail?.segmentId ?? null,
        nativeStepIndex: event?.detail?.nativeStepIndex ?? null,
        simulationTimeS: event?.detail?.simulationTimeS ?? null,
      });
    }
  };
  for (const event of events) {
    if (event.type === 'simulation.frame') add(event.detail.sample, event, 'simulation.frame');
    if (event.type === 'tool.completed' && event.detail.tool === 'perception.capture')
      add(event.detail.result, event, 'agent.observation');
  }
  if (run.latestSensor) add(run.latestSensor, null, 'agent.observation');
  return rows;
}

async function saveImages(origin, runId, output, images) {
  for (const row of images) {
    const imageId = row.image.attachmentId;
    const route = row.kind === 'simulation.frame'
      ? `replay/frames/${row.eventSequence}/images/${encoded(imageId)}`
      : `evidence/${encoded(row.evidenceId)}/images/${encoded(imageId)}`;
    const response = await fetch(`${origin}/api/runs/${runId}/${route}`);
    if (response.status === 404 || response.status === 410) {
      row.availability = `${response.status}`;
      row.file = null;
      continue;
    }
    if (!response.ok) throw new Error(`Image read failed: ${response.status} ${route}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== row.image.bytes) throw new Error('Recorded image length changed.');
    if (imageId.startsWith('sha256:') &&
        createHash('sha256').update(bytes).digest('hex') !== imageId.slice(7))
      throw new Error('Recorded image digest changed.');
    const folder = row.kind === 'simulation.frame' ? 'frames' : 'observations';
    const file = `${folder}/${row.eventSequence ?? 'latest'}-${row.evidenceId}-${path.basename(row.image.name)}`;
    await mkdir(path.join(output, folder), { recursive: true });
    await writeFile(path.join(output, file), bytes);
    row.file = file;
    row.availability = 'available';
  }
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', (chunk) => { stderr += chunk; });
    process.on('error', reject);
    process.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-2000)}`)));
  });
}

async function encodedFramePts(file) {
  const { stdout } = await execute('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', file],
  { maxBuffer: 16 * 1024 * 1024 });
  const frames = JSON.parse(stdout).frames;
  if (!Array.isArray(frames) || !frames.length) throw new Error('Encoded video has no frames.');
  const timestamps = frames.map((frame) => Number(frame.best_effort_timestamp_time));
  if (timestamps.some((value, index) => !Number.isFinite(value)
      || (index && value <= timestamps[index - 1])))
    throw new Error('Encoded video timestamps are invalid.');
  return timestamps;
}

function ffconcatPath(file) {
  return file.replaceAll('\\', '\\\\').replaceAll("'", "'\\''");
}

async function makeVideos(output, images, selectedCamera) {
  const inputTimebaseHz = 10000;
  const maxAllowedPtsErrorS = 5 / inputTimebaseHz;
  const frames = images.filter((row) => row.kind === 'simulation.frame');
  if (!frames.length) return { videos: [], missing: ['simulation.frame events and rollout video'] };
  const groups = new Map();
  for (const row of frames) {
    const camera = row.image.name;
    if (selectedCamera && camera !== selectedCamera) continue;
    const key = `${row.executionId ?? 'unknown'}:${camera}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  if (!groups.size) throw new Error('Requested camera has no recorded simulation frames.');
  const videos = [];
  const missing = [];
  await mkdir(path.join(output, 'videos'), { recursive: true });
  for (const [key, rows] of groups) {
    if (rows.some((row) => !row.file || !Number.isFinite(row.simulationTimeS))) {
      missing.push(`video ${key}: unavailable image or simulator timestamp`);
      continue;
    }
    const ordered = rows.toSorted((left, right) => left.eventSequence - right.eventSequence);
    const intervals = ordered.slice(1).map((row, index) => row.simulationTimeS - ordered[index].simulationTimeS);
    if (intervals.some((interval) => interval <= 0)) {
      missing.push(`video ${key}: simulator timestamps are not increasing`);
      continue;
    }
    const tailDurationS = intervals.at(-1) ?? 0.05;
    const safeKey = createHash('sha256').update(key).digest('hex').slice(0, 16);
    const video = `videos/${safeKey}.mp4`;
    const concat = `videos/${safeKey}.ffconcat`;
    const lines = ['ffconcat version 1.0'];
    ordered.forEach((row, index) => {
      lines.push(`file '${ffconcatPath(path.resolve(output, row.file))}'`);
      lines.push(`option framerate ${inputTimebaseHz}`);
      lines.push(`duration ${intervals[index] ?? tailDurationS}`);
    });
    lines.push(`file '${ffconcatPath(path.resolve(output, ordered.at(-1).file))}'`);
    lines.push(`option framerate ${inputTimebaseHz}`);
    await writeFile(path.join(output, concat), `${lines.join('\n')}\n`);
    await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat',
      '-i', path.join(output, concat), '-fps_mode', 'vfr', '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, video)]);
    const encodedFramePtsS = await encodedFramePts(path.join(output, video));
    if (encodedFramePtsS.length !== ordered.length + 1)
      throw new Error('Encoded frame count does not preserve the recorded sequence.');
    let maxPtsErrorS = 0;
    for (const [index, row] of ordered.entries()) {
      const expectedPtsS = row.simulationTimeS - ordered[0].simulationTimeS;
      const errorS = Math.abs(encodedFramePtsS[index] - expectedPtsS);
      maxPtsErrorS = Math.max(maxPtsErrorS, errorS);
      if (errorS > maxAllowedPtsErrorS)
        throw new Error(`Encoded frame ${index} timestamp ${encodedFramePtsS[index]} differs from recorded simulator time ${expectedPtsS}.`);
    }
    videos.push({
      file: video,
      concat,
      camera: ordered[0].image.name,
      executionId: ordered[0].executionId,
      firstSimulationTimeS: ordered[0].simulationTimeS,
      tailDurationS,
      tailDurationSource: intervals.length ? 'last recorded frame interval' : 'single-frame playback duration',
      recordedFrameCount: ordered.length,
      encodedFrameCount: encodedFramePtsS.length,
      encodedFramePtsS,
      recordedFrameVideoPtsS: encodedFramePtsS.slice(0, ordered.length),
      inputTimebaseHz,
      maxPtsErrorS,
      maxAllowedPtsErrorS,
      finalEncodedFrameRepeatsLastRecordedFrame: true,
      frameEventSequences: ordered.map((row) => row.eventSequence),
      frameSimulationTimesS: ordered.map((row) => row.simulationTimeS),
      frameWallTimes: ordered.map((row) => row.eventAt),
      framePolicyRequestIds: ordered.map((row) => row.policyRequestId),
      frameSegmentIds: ordered.map((row) => row.segmentId),
      frameNativeStepIndices: ordered.map((row) => row.nativeStepIndex),
    });
  }
  return { videos, missing };
}

function flowSource(events) {
  let executionState;
  const selected = events.filter((event) => {
    if (event.type === 'execution.updated') {
      const state = `${event.detail.execution.execution_id}:${event.detail.execution.state}`;
      if (state === executionState) return false;
      executionState = state;
      return true;
    }
    return /^(run\.|agent\.created|agent\.output|tool\.|execution\.requested|policy\.(output|plan|decision|failure)$|verification\.)/.test(event.type);
  });
  const lines = ['flowchart TD'];
  for (const event of selected) {
    const type = event.type.replaceAll(/[^A-Za-z0-9._-]/g, '');
    const participant = String(event.detail.member ?? event.detail.tool ?? '').replaceAll(/[^A-Za-z0-9._-]/g, '').slice(0, 32);
    lines.push(`  N${event.sequence}["#${event.sequence} ${type}${participant ? ` ${participant}` : ''}"]`);
    lines.push(`  click N${event.sequence} "timeline.html#event-${event.sequence}" "Open recorded event"`);
  }
  for (let index = 1; index < selected.length; index++)
    lines.push(`  N${selected[index - 1].sequence} --> N${selected[index].sequence}`);
  return `${lines.join('\n')}\n`;
}

async function renderFlow(output, source) {
  const vendor = await buildConsoleVendor(projectRoot);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: vendor.bundle, type: 'module' });
    await page.waitForFunction(() => Boolean(window.__edhMermaid));
    const svg = await page.evaluate(async (diagram) => {
      window.__edhMermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
      const rendered = (await window.__edhMermaid.render('recorded-flow', diagram)).svg;
      const container = document.createElement('div');
      container.innerHTML = rendered;
      const root = container.querySelector('svg');
      if (!root) throw new Error('Mermaid returned no SVG element.');
      root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      return new XMLSerializer().serializeToString(root);
    }, source);
    await writeFile(path.join(output, 'flow.svg'), svg);
  } finally {
    await browser.close();
  }
}

async function writeDashboard(output, run, events, manifest) {
  const payload = JSON.stringify({ run, events, manifest }).replaceAll('<', '\\u003c');
  await writeFile(path.join(output, 'timeline.html'), replayDocument(run.id, payload));
  for (const name of ['replay-dashboard.js', 'replay-dashboard.css'])
    await copyFile(path.join(projectRoot, 'scripts', name), path.join(output, name));
}

async function nativeVideoEvidence(directory, run, output) {
  if (!directory) return [];
  const recordings = [];
  for (const execution of run.executions) {
    const id = execution.execution_id;
    if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error('Invalid native execution identity.');
    const source = path.join(directory, id);
    const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
    const journal = (await readFile(path.join(source, 'frames.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
    if (!journal.length || journal.length !== manifest.frames || !manifest.cameras.length ||
        journal.some((row) => row.execution_id !== id ||
          ['task_id', 'goal_id', 'attempt_id'].some((key) => row.task_scope[key] !== execution.task_scope[key])))
      throw new Error('Native recording differs from its actual execution.');
    const folder = path.join('native-videos', id);
    await mkdir(path.join(output, folder), { recursive: true });
    const files = [];
    for (const name of ['manifest.json', 'frames.jsonl', ...manifest.cameras.map((camera) => {
      if (path.basename(camera) !== camera || camera === '.' || camera === '..')
        throw new Error('Invalid native camera name.');
      return `${camera}.mp4`;
    })]) {
      const bytes = await readFile(path.join(source, name));
      const file = path.join(folder, name);
      await writeFile(path.join(output, file), bytes);
      files.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    recordings.push({ executionId: id, frames: journal.length, cameras: manifest.cameras, files,
      policyRequestIds: [...new Set(journal.map((row) => row.policy_request_id))] });
  }
  return recordings;
}

async function policyLogEvidence(file, run, images, output, nativeRecordings = []) {
  if (!file) return null;
  const bytes = await readFile(file);
  const records = bytes.toString('utf8').split(/\r?\n/)
    .filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
  const requestIds = new Set(images.filter((row) => row.kind === 'simulation.frame')
    .map((row) => row.policyRequestId).filter(Boolean));
  for (const recording of nativeRecordings)
    for (const id of recording.policyRequestIds) requestIds.add(id);
  const inference = records.filter((record) => record.event === 'policy_inference_completed'
    && requestIds.has(record.request_id) && record.task_scope?.task_id === run.id);
  if (!inference.length) throw new Error('Policy log has no inference for this recorded run.');
  const matchedIds = new Set(inference.map((record) => record.request_id));
  if (matchedIds.size !== requestIds.size || [...requestIds].some((id) => !matchedIds.has(id)))
    throw new Error('Policy log does not cover every recorded frame request.');
  const startup = records.find((record) => record.service && record.checkpoint_digest === inference[0].checkpoint_digest);
  if (!startup) throw new Error('Policy log lacks the matching checkpoint startup record.');
  if (inference.some((record) => record.checkpoint_digest !== startup.checkpoint_digest
      || record.checkpoint_revision !== startup.checkpoint_revision))
    throw new Error('Policy checkpoint identity changed within the recorded run.');
  const source = startup.policy_source ?? startup.source;
  if (typeof source !== 'string' || !source)
    throw new Error('Policy startup lacks its identified implementation source.');
  const saved = 'source/policy-service.log';
  await writeFile(path.join(output, saved), bytes);
  return {
    file: saved,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    source,
    checkpointRevision: startup.checkpoint_revision,
    checkpointDigest: startup.checkpoint_digest,
    checkpointWeightSha256: startup.checkpoint_weight_sha256,
    matchedInferenceRequestIds: inference.map((record) => record.request_id),
    recordedFrameRequestIds: [...requestIds],
  };
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const output = path.resolve(options.output);
  if (options['from-export']) {
    const source = path.resolve(options['from-export']);
    if (source !== output) throw new Error('Recorded-source dashboard regeneration requires the same output directory.');
    const [run, events, manifest] = await Promise.all([
      readFile(path.join(source, 'source/run.json'), 'utf8').then(JSON.parse),
      readFile(path.join(source, 'source/events.json'), 'utf8').then(JSON.parse),
      readFile(path.join(source, 'manifest.json'), 'utf8').then(JSON.parse),
    ]);
    if (!Array.isArray(events) || !events.length || run.id !== manifest.runId ||
        manifest.eventCount !== events.length || !Array.isArray(manifest.videos) ||
        !terminalStates.has(run.state))
      throw new Error('Recorded export identity, event count, or terminal state is invalid.');
    for (const [index, event] of events.entries()) {
      if (event.sequence !== index + 1 || !Number.isFinite(Date.parse(event.at)) ||
          index && Date.parse(event.at) < Date.parse(events[index - 1].at))
        throw new Error('Recorded event order or timestamp is invalid.');
    }
    await mkdir(output, { recursive: true });
    await renderFlow(output, await readFile(path.join(output, 'flow.mmd'), 'utf8'));
    await writeDashboard(output, run, events, manifest);
    console.log(JSON.stringify({ output, runId: run.id, events: events.length,
      videos: manifest.videos.length, mode: 'recorded-source' }));
    return;
  }
  await mkdir(path.join(output, 'source'), { recursive: true });
  const runUrl = `${options.origin}/api/runs/${options['run-id']}?events=none`;
  const run = await jsonAt(runUrl);
  if (run.id !== options['run-id'] || !terminalStates.has(run.state))
    throw new Error('Export requires a terminal run with the requested identity.');
  const events = await history(options.origin, run.id, run.eventCount);
  const finalRun = await jsonAt(runUrl);
  if (finalRun.updatedAt !== run.updatedAt || finalRun.eventCount !== run.eventCount || finalRun.state !== run.state)
    throw new Error('Run changed during export.');
  const images = imageSources(run, events);
  await saveImages(options.origin, run.id, output, images);
  const { videos, missing } = await makeVideos(output, images, options.camera);
  const nativeRecordings = await nativeVideoEvidence(options['simulation-videos'], run, output);
  const policyLog = await policyLogEvidence(options['policy-log'], run, images, output, nativeRecordings);
  const unavailable = [
    ...(nativeRecordings.length ? [] : missing),
    ...images.filter((row) => !row.file).map((row) => `image ${row.evidenceId}/${row.image.name}`),
  ];
  if (!events.some((event) => event.type.startsWith('verification.')))
    unavailable.push('formal verification events');
  if (!policyLog && !events.some((event) => event.type.startsWith('policy.')))
    unavailable.push('policy request and action chunk events');
  const flow = flowSource(events);
  await writeFile(path.join(output, 'flow.mmd'), flow);
  await renderFlow(output, flow);
  await writeFile(path.join(output, 'source/run.json'), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(path.join(output, 'source/events.json'), `${JSON.stringify(events, null, 2)}\n`);
  await writeFile(path.join(output, 'frames.json'), `${JSON.stringify(images, null, 2)}\n`);
  const { stdout: revision } = await execute('git', ['rev-parse', 'HEAD'], { cwd: projectRoot });
  const recordedConfiguration = run.submission?.goal?.configuration ?? null;
  const sceneConfiguration = typeof recordedConfiguration === 'string' &&
    recordedConfiguration.trim().startsWith('{') ? JSON.parse(recordedConfiguration) : recordedConfiguration;
  const manifest = {
    schemaVersion: 'edh.run_replay.v1', runId: run.id, runState: run.state,
    source: run.source, task: run.scenario, instruction: run.instruction,
    sceneConfiguration,
    seed: sceneConfiguration?.seed ?? null,
    environment: run.configuration?.launchProfile?.environment ?? null,
    embodiment: run.configuration?.launchProfile?.embodiment ?? null,
    policy: run.configuration?.launchProfile?.policy ?? null,
    checkpointLabel: run.configuration?.launchProfile?.checkpoint ?? null,
    checkpointRevision: policyLog?.checkpointRevision ?? null,
    checkpointDigest: policyLog?.checkpointDigest ?? null,
    checkpointWeightSha256: policyLog?.checkpointWeightSha256 ?? null,
    policySource: policyLog?.source ?? null,
    deploymentDigest: run.configuration?.deploymentDigest ?? null,
    modelConfigurationDigest: run.configuration?.modelConfigurationDigest ?? null,
    runRevision: run.configuration?.sourceCode?.revision ?? null,
    runSourceCode: run.configuration?.sourceCode ?? null,
    modelBindings: run.configuration?.models ?? null,
    exporterRevision: revision.trim(),
    verdicts: run.verdicts, runError: run.error,
    eventCount: events.length, imageCount: images.length, videos, nativeRecordings,
    originalRecords: ['source/run.json', 'source/events.json', 'frames.json',
      ...(policyLog ? [policyLog.file] : []), ...nativeRecordings.flatMap((row) => row.files.map((item) => item.file))],
    policyLog,
    missing: [...(run.configuration?.sourceCode?.revision ? [] : ['run source revision']),
      ...(sceneConfiguration?.seed == null ? ['seed'] : []),
      ...(policyLog ? [] : ['checkpoint revision', 'policy service raw log']), ...unavailable],
  };
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeDashboard(output, run, events, manifest);
  console.log(JSON.stringify({ output, runId: run.id, events: events.length, images: images.length,
    videos: videos.length, missing: manifest.missing }));
}

await main();
