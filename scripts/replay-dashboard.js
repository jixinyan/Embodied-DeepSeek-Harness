const record = JSON.parse(document.getElementById('record').textContent);
const { run, events, manifest } = record;
const eventTimes = events.map((event) => Date.parse(event.at));
const start = eventTimes[0];
const end = eventTimes.at(-1);
const byType = new Map();
for (const event of events) {
  if (!byType.has(event.type)) byType.set(event.type, []);
  byType.get(event.type).push(event);
}
const $ = (id) => document.getElementById(id);
const text = (parent, tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = String(value);
  if (className) node.className = className;
  parent.append(node);
  return node;
};
const clear = (id) => { $(id).replaceChildren(); return $(id); };
const upperBound = (values, target) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
};
const visible = (type, wall) => (byType.get(type) ?? []).filter((event) => Date.parse(event.at) <= wall);
const last = (type, wall) => visible(type, wall).at(-1);
const seconds = (value) => `${value.toFixed(3)} s`;
const clearEventLink = () => {
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
};
const at = (event) => `#${event.sequence} · ${new Date(event.at).toLocaleTimeString()}`;
const addDetails = (parent, value) => {
  const details = document.createElement('details');
  text(details, 'summary', 'Original record');
  text(details, 'pre', JSON.stringify(value, null, 2));
  parent.append(details);
};
const addEntry = (parent, title, subtitle, body, raw) => {
  const entry = text(parent, 'div', '', 'entry');
  text(entry, 'strong', title);
  if (subtitle) text(entry, 'small', ` · ${subtitle}`);
  if (body) text(entry, 'p', body);
  if (raw) addDetails(entry, raw);
  return entry;
};
const valueText = (value) => typeof value === 'string' ? value : JSON.stringify(value);
const roleName = (identity) => roles.get(identity) ?? identity ?? 'unknown';
const roles = new Map([['user', 'user'], ['execution-monitor', 'execution monitor']]);
for (const event of byType.get('agent.created') ?? []) {
  const assignment = event.detail.assignment;
  roles.set(assignment.id, assignment.member);
  roles.set(assignment.sessionId, assignment.member);
}

function renderAgents(wall) {
  const container = clear('agents');
  const created = visible('agent.created', wall);
  const pills = text(container, 'div', '', 'role-row');
  for (const event of created) {
    const assignment = event.detail.assignment;
    const statuses = visible('agent.status', wall).filter((row) => row.detail.assignmentId === assignment.id);
    const retired = visible('agent.retired', wall).find((row) => row.detail.assignmentId === assignment.id);
    const state = retired ? `retired: ${retired.detail.reason}` : statuses.at(-1)?.detail.status ?? 'created';
    text(pills, 'span', `${assignment.member} · ${state}`, 'pill');
  }
  if (!created.length) text(container, 'p', 'No agent has started at this time.', 'empty');
  const output = clear('model-output');
  text(output, 'h3', 'Recorded model output');
  const rows = events.filter((event) => ['agent.output', 'policy.output'].includes(event.type)
    && Date.parse(event.at) <= wall).slice(-8).reverse();
  if (!rows.length) text(output, 'p', 'No model output at this time.', 'empty');
  for (const event of rows) {
    const detail = event.detail;
    const message = event.type === 'policy.output' ? detail.data.message : detail.message;
    const member = event.type === 'policy.output' ? 'execution policy' : detail.member;
    const source = message?.source;
    const row = addEntry(output, `${member} · ${message?.role ?? 'assistant'}`, `${at(event)} · ${source?.provider ?? 'provider unavailable'}/${source?.model ?? 'model unavailable'}`, null, null);
    for (const block of message?.content ?? []) {
      if (block.type === 'text') text(row, 'p', block.text);
      else if (block.type === 'reasoning') text(row, 'p', `Recorded reasoning: ${valueText(block.text ?? block.content ?? '')}`);
      else if (block.type === 'tool-call') {
        const argumentsText = valueText(block.arguments ?? '');
        text(row, 'p', `Tool call: ${block.name} ${argumentsText.length > 180 ? `${argumentsText.slice(0, 180)}…` : argumentsText}`);
      }
      else text(row, 'p', `Recorded ${block.type} content: ${valueText(block)}`);
    }
    if (!(message?.content ?? []).some((block) => block.type === 'reasoning'))
      text(row, 'small', `Reasoning text not recorded${detail.usage?.reasoningTokens != null ? `; usage reports ${detail.usage.reasoningTokens} reasoning tokens` : ''}.`);
    addDetails(row, detail);
  }
}

function renderPlan(wall) {
  const plan = clear('plan');
  text(plan, 'h3', 'Plan');
  const update = last('plan.updated', wall);
  if (!update) text(plan, 'p', 'No plan update at this time.', 'empty');
  else {
    for (const item of update.detail.plan?.items ?? [])
      addEntry(plan, `${item.goal_id} · ${item.status}`, at(update), item.description, item);
  }
  const todos = clear('todos');
  text(todos, 'h3', 'TODO');
  const snapshots = new Map();
  for (const updateTodos of visible('agent.todos', wall)) snapshots.set(updateTodos.detail.assignmentId, updateTodos);
  if (!snapshots.size) text(todos, 'p', 'No TODO update at this time.', 'empty');
  for (const updateTodos of snapshots.values()) {
    text(todos, 'strong', `${updateTodos.detail.member} · ${at(updateTodos)}`);
    for (const item of updateTodos.detail.todos ?? [])
      addEntry(todos, item.status, null, item.content, null);
  }
  const policyPlan = last('policy.plan', wall);
  if (policyPlan) {
    text(todos, 'strong', `Execution policy · ${at(policyPlan)}`);
    for (const item of policyPlan.detail.data.subtasks)
      addEntry(todos, `${item.id} · ${item.status}`, null, `${item.src} → ${item.dst}: ${item.next_action}`, item);
  }
}

function renderToolsAndMessages(wall) {
  const tools = clear('tools');
  text(tools, 'h3', 'Tool activity');
  const toolEvents = events.filter((event) => (event.type.startsWith('tool.')
    || ['policy.tool-call', 'policy.tool-result'].includes(event.type))
    && Date.parse(event.at) <= wall).slice(-7).reverse();
  if (!toolEvents.length) text(tools, 'p', 'No tool activity at this time.', 'empty');
  for (const event of toolEvents)
    addEntry(tools, `${event.detail.tool ?? event.detail.data?.name ?? 'execution policy'} · ${event.type}`, at(event), null, event.detail);
  const messages = clear('messages');
  text(messages, 'h3', 'Role communication');
  const rows = visible('message.delivered', wall).slice(-6).reverse();
  if (!rows.length) text(messages, 'p', 'No delivered message at this time.', 'empty');
  for (const event of rows) {
    const detail = event.detail;
    const payload = detail.payload;
    const body = payload?.brief?.objective ?? payload?.result?.explanation ?? payload?.text ?? payload?.message ?? null;
    addEntry(messages, `${roleName(detail.sender)} → ${roleName(detail.recipient)}`, `${at(event)} · ${payload?.kind ?? 'message'}`, body, detail);
  }
}

function renderExecution(wall) {
  const execution = clear('execution');
  const update = last('execution.updated', wall);
  if (!update) text(execution, 'p', 'Execution has not started at this time.', 'empty');
  else {
    const state = update.detail.execution;
    addEntry(execution, `State: ${state.state}`, at(update), `Control commands: ${state.control_steps} · Policy calls: ${state.policy_calls} · Physics steps: ${state.raw_sim_steps}`, state);
  }
  const verification = clear('verification');
  text(verification, 'h3', 'Formal verification');
  const check = last('verification.checked', wall);
  const completed = last('verification.completed', wall);
  if (!check && !completed) text(verification, 'p', 'Formal check has not occurred at this time.', 'empty');
  if (check) addEntry(verification, 'Native check', at(check), JSON.stringify(check.detail.facts ?? check.detail), check.detail);
  if (completed) {
    const result = completed.detail.result;
    addEntry(verification, `Verdict: ${result.status}`, at(completed),
      `${result.checks.map((item) => `${item.check_id}=${item.value}`).join(', ')} · ${result.explanation}`, result);
  }
  if (wall >= end) addEntry(verification, `Final run: ${run.state}`, null, run.error ?? null, run.verdicts);
}

const cameraNodes = manifest.videos.map((item) => {
  const card = text($('cameras'), 'div', '', 'camera');
  const video = document.createElement('video');
  video.src = item.file;
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  card.append(video);
  const caption = text(card, 'div', '', 'caption');
  const cameraName = text(caption, 'strong', item.camera);
  cameraName.title = item.camera;
  const status = text(caption, 'small', 'Awaiting first recorded frame');
  const node = { item, video, status, requested: -1, displayed: -1 };
  video.addEventListener('seeked', () => {
    node.displayed = node.requested;
    const index = node.displayed;
    if (index >= 0) status.textContent = `Frame #${item.frameEventSequences[index]} · simulator ${seconds(item.frameSimulationTimesS[index])}`;
    syncCamera(node, currentWall);
  });
  video.addEventListener('loadeddata', () => syncCamera(node, currentWall));
  return node;
});
function syncCamera(node, wall) {
  const { item, video, status } = node;
  const times = item.frameWallTimes.map((value) => Date.parse(value));
  const index = upperBound(times, wall) - 1;
  if (index < 0) {
    video.style.visibility = 'hidden';
    status.textContent = 'Awaiting first recorded frame';
    node.requested = -1;
    return;
  }
  video.style.visibility = 'visible';
  if (video.readyState < 1 || video.seeking || index === node.requested) return;
  node.requested = index;
  video.currentTime = item.recordedFrameVideoPtsS[index];
  if (index === 0 && video.currentTime === 0) {
    node.displayed = 0;
    status.textContent = `Frame #${item.frameEventSequences[0]} · simulator ${seconds(item.frameSimulationTimesS[0])}`;
  }
}

const milestone = (event) => !['simulation.frame', 'execution.updated', 'agent.context-usage', 'agent.context-capacity'].includes(event.type);
function eventCategory(event) {
  if (['policy.tool-call', 'policy.tool-result'].includes(event.type)) return 'tool';
  if (event.type.startsWith('policy.')) return 'agent';
  if (event.type.startsWith('agent.') || event.type === 'message.delivered' || event.type === 'plan.updated') return 'agent';
  if (event.type.startsWith('tool.') || event.type.startsWith('dsh.tool-')) return 'tool';
  if (event.type.startsWith('execution.')) return 'execution';
  if (event.type.startsWith('verification.')) return 'verification';
  if (event.type === 'simulation.frame') return 'frame';
  return 'other';
}
function renderEvents(wall) {
  const category = $('event-filter').value;
  const query = $('event-search').value.trim().toLowerCase();
  const matches = events.filter((event) => (category === 'all' || category === 'milestones' && milestone(event) || eventCategory(event) === category)
    && (!query || `${event.type} ${event.detail.member ?? ''} ${event.detail.tool ?? ''}`.toLowerCase().includes(query)));
  const times = matches.map((event) => Date.parse(event.at));
  const linked = /^#event-(\d+)$/.exec(location.hash);
  const linkedIndex = linked ? matches.findIndex((event) => event.sequence === Number(linked[1])) : -1;
  const position = linkedIndex >= 0 ? linkedIndex + 1 : upperBound(times, wall);
  const rows = matches.slice(Math.max(0, position - 20), Math.min(matches.length, position + 11));
  const container = clear('events');
  $('event-count').textContent = `${matches.length} matching records · ${rows.length} near cursor`;
  if (!rows.length) text(container, 'p', 'No matching event near this time.', 'empty');
  for (const event of rows) {
    const row = text(container, 'div', '', `event${Date.parse(event.at) <= wall ? ' current' : ''}`);
    row.id = `event-${event.sequence}`;
    text(row, 'span', `#${event.sequence} ${event.type}`, 'event-title');
    text(row, 'small', ` · ${new Date(event.at).toLocaleTimeString()}`);
    const jump = text(row, 'button', 'Jump');
    jump.type = 'button';
    jump.addEventListener('click', () => { pause(); clearEventLink(); setWall(Date.parse(event.at)); });
    addDetails(row, event.detail);
  }
}

let currentWall = start;
let playing = false;
let clockAnchor = 0;
let wallAnchor = 0;
let previousEventIndex = -1;
let previousEventFilter = '';
function pause() { playing = false; $('play').textContent = 'Play'; }
function setWall(value) {
  currentWall = Math.max(start, Math.min(end, value));
  $('cursor').value = String(Math.round(currentWall - start));
  $('wall-clock').textContent = new Date(currentWall).toLocaleString();
  $('elapsed').textContent = `Wall elapsed ${seconds((currentWall - start) / 1000)} / ${seconds((end - start) / 1000)}`;
  const index = upperBound(eventTimes, currentWall) - 1;
  const currentFrame = last('simulation.frame', currentWall);
  $('sim-clock').textContent = currentFrame ? `Simulator ${seconds(currentFrame.detail.simulationTimeS)} · source frame #${currentFrame.sequence}` : 'Simulator: no frame yet';
  $('frame-summary').textContent = currentFrame ? `Event #${currentFrame.sequence} · ${currentFrame.detail.policyRequestId ?? 'request unavailable'}` : 'No source frame yet';
  for (const node of cameraNodes) syncCamera(node, currentWall);
  const filter = `${$('event-filter').value}:${$('event-search').value}`;
  if (index !== previousEventIndex || filter !== previousEventFilter) {
    renderAgents(currentWall);
    renderPlan(currentWall);
    renderToolsAndMessages(currentWall);
    renderExecution(currentWall);
    renderEvents(currentWall);
    previousEventIndex = index;
    previousEventFilter = filter;
  }
}
function animate(now) {
  if (playing) {
    setWall(wallAnchor + (now - clockAnchor) * Number($('speed').value));
    if (currentWall >= end) pause();
  }
  requestAnimationFrame(animate);
}
$('play').addEventListener('click', () => {
  if (playing) { pause(); return; }
  clearEventLink();
  if (currentWall >= end) setWall(start);
  playing = true;
  $('play').textContent = 'Pause';
  clockAnchor = performance.now();
  wallAnchor = currentWall;
});
$('cursor').addEventListener('input', () => { pause(); clearEventLink(); setWall(start + Number($('cursor').value)); });
$('speed').addEventListener('change', () => { clockAnchor = performance.now(); wallAnchor = currentWall; });
$('event-filter').addEventListener('change', () => setWall(currentWall));
$('event-search').addEventListener('input', () => setWall(currentWall));
$('title').textContent = run.scenario;
$('run-summary').textContent = `${run.instruction} · recorded outcome ${run.state} · ${events.length} original events · ${run.id}`;
$('availability').textContent = manifest.missing.length ? manifest.missing.join(' · ') : 'All referenced records are available.';
$('cursor').max = String(end - start);
const firstFrame = byType.get('simulation.frame')?.[0];
const firstTextOutput = (byType.get('agent.output') ?? []).find((event) =>
  event.detail.message?.content?.some((block) => block.type === 'text' && block.text.trim())
    && (!firstFrame || Date.parse(event.at) >= Date.parse(firstFrame.at)));
setWall(firstTextOutput ? Date.parse(firstTextOutput.at) : firstFrame ? Date.parse(firstFrame.at) : start);
function followEventLink() {
  const match = /^#event-(\d+)$/.exec(location.hash);
  if (!match) return;
  const sequence = Number(match[1]);
  const event = events[sequence - 1];
  if (event?.sequence !== sequence) return;
  pause();
  $('event-filter').value = 'all';
  setWall(Date.parse(event.at));
  document.getElementById(`event-${sequence}`)?.scrollIntoView();
}
window.addEventListener('hashchange', followEventLink);
followEventLink();
requestAnimationFrame(animate);
