import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';

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
      lines.push('option framerate 10000');
      lines.push(`duration ${intervals[index] ?? tailDurationS}`);
    });
    lines.push(`file '${ffconcatPath(path.resolve(output, ordered.at(-1).file))}'`);
    lines.push('option framerate 10000');
    await writeFile(path.join(output, concat), `${lines.join('\n')}\n`);
    await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat',
      '-i', path.join(output, concat), '-fps_mode', 'vfr', '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, video)]);
    const encodedFramePtsS = await encodedFramePts(path.join(output, video));
    if (encodedFramePtsS.length !== ordered.length + 1)
      throw new Error('Encoded frame count does not preserve the recorded sequence.');
    for (const [index, row] of ordered.entries())
      if (Math.abs(encodedFramePtsS[index] - (row.simulationTimeS - ordered[0].simulationTimeS)) > 0.00015)
        throw new Error('Encoded frame timestamp differs from the recorded simulator time.');
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
      inputTimebaseHz: 10000,
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
  const selected = events.filter((event) =>
    /^(run\.|agent\.created|agent\.output|tool\.|execution\.|policy\.|action\.|simulation\.frame|verification\.)/.test(event.type));
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
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: path.join(projectRoot, 'apps/console/node_modules/mermaid/dist/mermaid.min.js') });
    const svg = await page.evaluate(async (diagram) => {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
      const rendered = (await window.mermaid.render('recorded-flow', diagram)).svg;
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

function htmlDocument(run, events, images, videos, missing) {
  const payload = JSON.stringify({
    run: { id: run.id, scenario: run.scenario, state: run.state }, events, images, videos, missing,
  }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recorded run ${run.id}</title><style>
body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px;background:#f4f6f7;color:#18262c}
header,article,aside{background:#fff;border:1px solid #d9e1e5;border-radius:10px;padding:18px;margin-bottom:18px}
h1{margin:0 0 8px}small,summary{color:#52636d}a{color:#075d90}#events{display:grid;gap:9px}
.event{padding:12px;border:1px solid #d9e1e5;border-radius:8px;background:#fff;scroll-margin-top:18px}
.event:target{border:2px solid #007a87}pre{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f7;padding:10px}
img{max-width:100%;height:auto}video{max-width:100%;width:100%}.images{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
</style></head><body><header><h1>Recorded run</h1><div id="summary"></div><p><a href="flow.svg">Event flow SVG</a> · <a href="source/events.json">Original event JSON</a> · <a href="frames.json">Frame metadata</a> · <a href="manifest.json">Manifest</a></p></header>
<aside id="availability"></aside><section id="videos"></section><section id="events"></section>
<script type="application/json" id="record">${payload}</script><script>
const data=JSON.parse(document.getElementById('record').textContent);
const summary=document.getElementById('summary');
summary.textContent=data.run.scenario+' · '+data.run.state+' · '+data.run.id+' · '+data.events.length+' recorded events';
const availability=document.getElementById('availability');
availability.textContent=data.missing.length?'Unavailable records: '+data.missing.join('; '):'All referenced replay records are available.';
const videoSection=document.getElementById('videos');
for(const item of data.videos){const box=document.createElement('article');const title=document.createElement('h2');title.textContent=item.camera+' · execution '+item.executionId;box.append(title);const video=document.createElement('video');video.controls=true;video.src=item.file;box.append(video);const caption=document.createElement('p');const link=document.createElement('a');link.href='#event-'+item.frameEventSequences[0];caption.append(link);box.append(caption);videoSection.append(box);video.addEventListener('timeupdate',()=>{let index=0;for(let next=1;next<item.recordedFrameVideoPtsS.length;next++){if(item.recordedFrameVideoPtsS[next]>video.currentTime)break;index=next;}const sequence=item.frameEventSequences[index];const event=data.events[sequence-1];link.href='#event-'+sequence;link.textContent='Frame event #'+sequence+' · simulator '+item.frameSimulationTimesS[index].toFixed(3)+' s · wall '+(event?.at??'unavailable');});}
const eventSection=document.getElementById('events');
for(const event of data.events){const box=document.createElement('article');box.className='event';box.id='event-'+event.sequence;const title=document.createElement('h3');title.textContent='#'+event.sequence+' '+event.type;box.append(title);const time=document.createElement('small');time.textContent=event.at;box.append(time);
const refs=data.images.filter(row=>row.eventSequence===event.sequence&&row.file);if(refs.length){const gallery=document.createElement('div');gallery.className='images';for(const row of refs){const figure=document.createElement('figure');const img=document.createElement('img');img.src=row.file;img.alt=row.image.name;figure.append(img);const label=document.createElement('figcaption');label.textContent=row.image.name+' · observed '+(row.observedAt??'unavailable');figure.append(label);gallery.append(figure);}box.append(gallery);}
const details=document.createElement('details');const label=document.createElement('summary');label.textContent='Recorded detail';details.append(label);const json=document.createElement('pre');json.textContent=JSON.stringify(event.detail,null,2);details.append(json);box.append(details);eventSection.append(box);}
</script></body></html>`;
}

async function policyLogEvidence(file, run, images, output) {
  if (!file) return null;
  const bytes = await readFile(file);
  const records = bytes.toString('utf8').split(/\r?\n/)
    .filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
  const requestIds = new Set(images.filter((row) => row.kind === 'simulation.frame')
    .map((row) => row.policyRequestId).filter(Boolean));
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
  const saved = 'source/policy-service.log';
  await writeFile(path.join(output, saved), bytes);
  return {
    file: saved,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    source: startup.source,
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
  const policyLog = await policyLogEvidence(options['policy-log'], run, images, output);
  const unavailable = [
    ...missing,
    ...images.filter((row) => !row.file).map((row) => `image ${row.evidenceId}/${row.image.name}`),
  ];
  if (!events.some((event) => event.type.startsWith('verification.')))
    unavailable.push('formal verification events');
  if (!events.some((event) => event.type.includes('policy.')))
    unavailable.push('policy request and action chunk events');
  const flow = flowSource(events);
  await writeFile(path.join(output, 'flow.mmd'), flow);
  await renderFlow(output, flow);
  await writeFile(path.join(output, 'source/run.json'), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(path.join(output, 'source/events.json'), `${JSON.stringify(events, null, 2)}\n`);
  await writeFile(path.join(output, 'frames.json'), `${JSON.stringify(images, null, 2)}\n`);
  const { stdout: revision } = await execute('git', ['rev-parse', 'HEAD'], { cwd: projectRoot });
  const manifest = {
    schemaVersion: 'edh.run_replay.v1', runId: run.id, runState: run.state,
    source: run.source, task: run.scenario, instruction: run.instruction,
    sceneConfiguration: run.submission?.goal?.configuration ?? null,
    seed: null,
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
    runRevision: null, exporterRevision: revision.trim(),
    verdicts: run.verdicts, runError: run.error,
    eventCount: events.length, imageCount: images.length, videos,
    originalRecords: ['source/run.json', 'source/events.json', 'frames.json',
      ...(policyLog ? [policyLog.file] : [])],
    policyLog,
    missing: ['run source revision', 'seed',
      ...(policyLog ? [] : ['checkpoint revision', 'policy service raw log']), ...unavailable],
  };
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(output, 'timeline.html'), htmlDocument(run, events, images, videos, manifest.missing));
  console.log(JSON.stringify({ output, runId: run.id, events: events.length, images: images.length,
    videos: videos.length, missing: manifest.missing }));
}

await main();
