import {
  launchFields,
  matchingProfiles,
  profileSelection,
  validateLaunchSelection,
} from './launch-selection.js';
import { renderLaunchControls } from './launch-controls.js';
import { renderCoordination } from './coordination.js';
import { renderTaskComposer } from './task-composer.js';
import { createTaskCatalogSelection } from './task-catalog.js';
import { bindClarification } from './clarification.js';
import { api } from './api.js';
import { taskRequest, completeTaskRequest } from './task-request.js';
import { renderSensorImages } from './sensor-images.js';
import { bindStorageMaintenance } from './storage-maintenance.js';
import { bindSessionAudit } from './session-audit.js';
import { bindReportHistory } from './report-history.js';
import { bindAssignmentDetails, createAssignmentSelection } from './assignment-details.js';
import { bindVerdictDetails } from './verdict-details.js';
import { bindWorkspaceHistory, bindTaskContextHistory } from './workspace-history.js';
import {
  appendRunHistory,
  mergeRunUpdate,
  receivedRunSequence,
  retainRunEvents,
} from './run-update.js';

const $ = (id) => document.getElementById(id);
let selection = {};
let config, current, stream, displayedFrame;
let busy = false;
let loadRevision = 0;
let activeRunId = null;
let activeRunRecord = null;
let activeSessionRecord = null;
let activeUserSessionId = null;
let historyTimer;
let inspectedHistory = null;
let eventPageRevision = 0;
let eventPageLoading = false;
const activeUserSession = () => activeSessionRecord;
const hasLauncher = () => Object.keys(config?.launchProfiles ?? {}).length > 0;
const ended = (state) =>
  ['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown'].includes(state);
const text = (id, value) => {
  $(id).textContent = value;
};
const shorten = (id) => (id ? id.slice(0, 8) : '—');
function error(message) {
  $('error').hidden = !message;
  text('error', message || '');
}
const taskCatalog = createTaskCatalogSelection(api, () => updateControls(), error);
function taskDefinitions() {
  const session = activeUserSession();
  if (!session?.taskCatalog) return { presets: config.taskPresets, goals: config.scenarioGoals };
  const presets = taskCatalog.ready(session) ? taskCatalog.catalog.tasks : {};
  return {
    presets,
    goals: Object.fromEntries(Object.entries(presets).map(([id, task]) => [id, task.goal])),
  };
}
function inspect(title, value) {
  auditBrowser.close();
  reportBrowser.close();
  assignmentBrowser.close();
  verdictBrowser.close();
  text('inspector-title', title);
  text('inspector-body', typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  if (!$('inspector').open) $('inspector').showModal();
}
function connected(value) {
  text('connection', value ? 'Event stream connected' : 'Reconnecting to server');
  $('connection-dot').classList.toggle('offline', !value);
}
function renderLauncher() {
  const session = activeUserSession();
  const catalog = config.launchProfiles ?? {};
  if (session) selection = profileSelection(session.configuration.launchProfile);
  renderLaunchControls(catalog, selection, {
    locked: Boolean(session),
    busy,
    onChange: renderLauncher,
  });
  const matches = matchingProfiles(catalog, selection);
  const profileSelector = $('launch-profile');
  const ids = matches.map(([id]) => id);
  if (profileSelector.dataset.choices !== JSON.stringify(ids)) {
    const prior = profileSelector.value;
    profileSelector.replaceChildren(...matches.map(([id, p]) => new Option(p.label, id)));
    if (ids.includes(prior)) profileSelector.value = prior;
    profileSelector.dataset.choices = JSON.stringify(ids);
  }
  if (session) profileSelector.value = session.profileId;
  const complete = launchFields.every((field) => selection[field]);
  const profile =
    session?.configuration.launchProfile ?? config.launchProfiles?.[$('launch-profile').value];
  text(
    'user-session-state',
    session ? `${session.state} / ${session.resources}`.toUpperCase() : 'NO ACTIVE SESSION',
  );
  $('launch-details').replaceChildren();
  const model =
    session?.configuration.models?.[profile?.defaultModel] ??
    config.models?.[profile?.defaultModel];
  for (const [label, value] of Object.entries({
    Environment: profile?.environment,
    Embodiment: profile?.embodiment,
    Policy: profile?.policy,
    Checkpoint: profile?.checkpoint,
    'Upper model': model ? `${model.provider} / ${model.model}` : undefined,
  })) {
    const item = document.createElement('div');
    const name = document.createElement('span');
    name.textContent = label;
    const content = document.createElement('strong');
    content.textContent = value ?? 'Not configured';
    item.append(name, content);
    $('launch-details').append(item);
  }
  text(
    'session-target',
    session
      ? `Tasks target session ${shorten(session.id)}. Configuration is fixed until End session; the environment is retained between tasks.${session.error ? ' ' + session.error : ''}`
      : hasLauncher()
        ? complete && profile
          ? `${matches.length} compatible configuration${matches.length === 1 ? '' : 's'} · Matches installed configuration bindings.`
          : 'Choose components to resolve a compatible configuration.'
        : 'This deployment has no session launcher. The task button uses the legacy single-run API.',
  );
  const definitions = taskDefinitions();
  const choices = Object.entries(definitions.presets ?? {}).filter(
    ([id]) => session?.taskCatalog || !profile || profile.tasks.includes(id),
  );
  const choiceSignature = JSON.stringify(choices.map(([id, task]) => [id, task.label]));
  if ($('scenario').dataset.choices !== choiceSignature) {
    const prior = $('scenario').value || $('scenario').dataset.previous;
    $('scenario').replaceChildren(...choices.map(([id, task]) => new Option(task.label, id)));
    if (choices.some(([id]) => id === prior)) $('scenario').value = prior;
    $('scenario').dataset.choices = choiceSignature;
  }
  if ($('scenario').value) $('scenario').dataset.previous = $('scenario').value;
  if (!current)
    $('instruction').value = definitions.presets?.[$('scenario').value]?.instruction ?? '';
  $('create-session').disabled =
    busy ||
    Boolean(activeUserSessionId) ||
    Boolean(activeRunId && !ended(activeRunRecord?.state)) ||
    !hasLauncher() ||
    !complete ||
    !profile;
  $('end-session').disabled = busy || !session || ['opening', 'closing'].includes(session.state);
  $('launch-profile').disabled = busy || Boolean(activeUserSessionId);
  const view = current
    ? current.configuration
    : (session?.configuration ?? config.launchTeams?.[profileSelector.value] ?? config);
  renderCoordination(view, current);
}
const taskHistory = bindTaskContextHistory(
  $('task-context-navigation'),
  api,
  () => updateTaskComposer(),
  error,
);
const workspaceHistory = bindWorkspaceHistory($('history'), api, {
  openRun: (id) => loadRun(id).catch((failure) => error(failure.message)),
  inspectSession: (id) =>
    action(async () => {
      inspect(
        'User session · Environment, tasks and resource ownership',
        await api(`/api/sessions/${id}`),
      );
    }),
  selectedRun: () => current?.id,
  changed: ({ tasks, sessions }) => {
    activeRunId = tasks.activeId;
    activeRunRecord = tasks.activeRun;
    activeUserSessionId = sessions.activeId;
    activeSessionRecord = sessions.activeSession;
    updateControls();
  },
  failed: error,
});
async function refreshHistory() {
  const data = await workspaceHistory.refresh();
  if (!data) return undefined;
  await taskHistory.refresh(activeUserSessionId);
  return data.tasks;
}
function updateControls() {
  const active = activeRunRecord;
  taskCatalog.select(activeUserSession());
  $('start').disabled =
    busy ||
    Boolean(active && !ended(active.state)) ||
    (hasLauncher() &&
      (activeUserSession()?.state !== 'ready' || !taskCatalog.ready(activeUserSession())));
  $('scenario').disabled = $('start').disabled;
  renderLauncher();
  updateTaskComposer();
  const writable = current && !current.readOnly && !ended(current.state) && !busy;
  const execution = current?.executions.at(-1);
  $('pause').disabled = !writable || execution?.state !== 'running';
  $('resume').disabled =
    !writable || execution?.state !== 'paused' || current?.clarification?.state === 'pending';
  $('stop').disabled = !writable;
}
function updateTaskComposer() {
  const definitions = taskDefinitions();
  const session = activeUserSession();
  renderTaskComposer({
    enabled: hasLauncher(),
    session: activeUserSession(),
    scenario: $('scenario').value,
    presets: definitions.presets,
    goals: definitions.goals,
    runs: taskHistory.runs,
    busy: busy || !taskCatalog.ready(session),
    current,
  });
  $('reload-task-catalog').disabled =
    busy || !session?.taskCatalog || taskCatalog.status === 'loading';
  const revision = session?.taskCatalog?.revision ?? '';
  $('task-catalog-status').title = revision;
  text(
    'task-catalog-status',
    session?.taskCatalog
      ? taskCatalog.status === 'ready'
        ? `${Object.keys(definitions.presets).length} tasks · ${session.taskCatalog.source} · ${revision.length > 28 ? revision.slice(0, 12) + '…' : revision}`
        : taskCatalog.status === 'error'
          ? 'Task catalog unavailable. Reload to retry.'
          : 'Loading session tasks…'
      : 'Deployment task criteria',
  );
}
const archivedSensor = createAssignmentSelection(api, () => showSensor(), error);
const archivedTodo = createAssignmentSelection(api, () => renderTodos(), error);
function showSensor() {
  const selection = $('sensor-view').value;
  const archived = archivedSensor.select(current?.id, current?.assignments[selection]);
  displayedFrame =
    selection === 'latest'
      ? current?.latestSensor
      : (archived?.observation ?? current?.agentSeen[selection]);
  const frame = displayedFrame;
  const fixture = (frame?.source ?? current?.source ?? config.mode) === 'test_fixture';
  const imageCount = renderSensorImages($('sensor-images'), current?.id, frame);
  $('sensor-svg').toggleAttribute(
    'hidden',
    !fixture || imageCount > 0 || archivedSensor.loading || Boolean(archivedSensor.error),
  );
  text(
    'scene-source',
    imageCount
      ? fixture
        ? 'TEST IMAGE'
        : 'SENSOR IMAGE'
      : fixture
        ? 'FIXTURE'
        : 'PROVIDER METADATA',
  );
  text(
    'sensor-subtitle',
    archivedSensor.loading
      ? 'Loading archived observation…'
      : archivedSensor.error
        ? 'Archived observation unavailable'
        : imageCount
          ? `${imageCount} ${imageCount === 1 ? 'view' : 'views'} · ${fixture ? 'Test evidence' : 'Recorded sensor evidence'}`
          : fixture
            ? 'CPU illustration · Not real camera imagery'
            : frame?.evidence.visibility === 'debug_only'
              ? 'Restricted evidence · image access unavailable'
              : 'Provider metadata · No image attached',
  );
  text(
    'frame-source',
    selection === 'latest'
      ? 'Latest sensor'
      : `${current?.assignments[selection]?.member ?? 'Agent'} received`,
  );
  text('frame-number', frame ? `FRAME ${String(frame.sequence).padStart(4, '0')}` : 'NO FRAME');
  text(
    'latest-frame',
    current?.latestSensor
      ? `Frame ${current.latestSensor.sequence} · ${new Date(current.latestSensor.evidence.observed_at).toLocaleTimeString()}`
      : '—',
  );
  text('sensor-description', frame?.description ?? 'Awaiting provider observation.');
  text('sensor-age', frame ? new Date(frame.evidence.observed_at).toLocaleTimeString() : '—');
  $('inspect-frame').disabled = !frame;
  const closed = frame?.visualization.cabinetOpen === false;
  for (const id of ['open-door', 'open-handle']) $(id).style.display = closed ? 'none' : '';
  $('closed-door').toggleAttribute('hidden', !closed);
  const inside = frame?.visualization.cupInside === true;
  $('cup').setAttribute('transform', inside ? 'translate(580 194)' : 'translate(338 262)');
  const step = Number(frame?.visualization.step ?? 0);
  $('robot-arm').setAttribute(
    'points',
    step % 2 ? '567,289 551,239 465,198 427,219' : '567,289 551,239 465,198 404,231',
  );
}
function renderDeployment() {
  const view = current ? current.configuration : config;
  const source = current?.source ?? config.mode;
  text('deployment-source', source.replaceAll('_', ' ').toUpperCase());
  $('deployment-source').classList.toggle('fixture', source === 'test_fixture');
  text('deployment-runtime', `DSH runtime · ${view?.deploymentId ?? 'legacy run'}`);
  text('deployment-description', view?.description ?? 'Historical configuration unavailable');
  text('deployment-footer', view?.description ?? 'Historical configuration unavailable');
  text('team-name', view?.team.team_id ?? current?.teamId ?? 'Historical team');
}
function renderAgents() {
  const assignments = Object.values(current?.assignments ?? {});
  text('session-count', `${assignments.length} ASSIGNMENTS`);
  $('agents').replaceChildren();
  const team = (current ? current.configuration : config)?.team;
  const members = [
    ...new Set([...Object.keys(team?.members ?? {}), ...assignments.map((a) => a.member)]),
  ];
  const filter = $('agent-filter');
  if (filter.dataset.members !== JSON.stringify(members)) {
    const selected = filter.value;
    filter.replaceChildren(
      ...['all', ...members].map((member) => {
        const option = document.createElement('option');
        option.value = member;
        option.textContent = member === 'all' ? 'All agents' : member;
        return option;
      }),
    );
    filter.value = members.includes(selected) ? selected : 'all';
    filter.dataset.members = JSON.stringify(members);
  }
  for (const member of members) {
    const membersAssignments = assignments.filter((a) => a.member === member);
    const latest = membersAssignments.at(-1);
    const running = membersAssignments.find((a) => a.status === 'running');
    const card = document.createElement('button');
    card.className = 'agent-card';
    card.disabled = !latest;
    const icon = document.createElement('span');
    icon.className = 'agent-icon';
    icon.textContent =
      member === team?.bindings.decision_owner
        ? '◈'
        : member === team?.bindings.final_verifier
          ? '◎'
          : '↗';
    const info = document.createElement('span');
    info.className = 'agent-info';
    const name = document.createElement('strong');
    name.textContent = `${member[0].toUpperCase()}${member.slice(1)}`;
    const sub = document.createElement('small');
    sub.textContent = latest
      ? `${membersAssignments.length} assignment${membersAssignments.length === 1 ? '' : 's'} · ${shorten((running || latest).sessionId)}`
      : 'Waiting for an explicit assignment';
    info.append(name, sub);
    const status = document.createElement('span');
    const state = running ? 'running' : (latest?.status ?? 'standby');
    status.className = `tag ${state}`;
    status.textContent = state.toUpperCase();
    card.append(icon, info, status);
    card.onclick = () =>
      action(async () => {
        inspect(`${member} · Independent assignments`, '');
        await assignmentBrowser.open(current.id, membersAssignments);
      });
    $('agents').append(card);
  }
  const old = $('sensor-view').value;
  const options = [
    { value: 'latest', label: 'Latest sensor' },
    ...assignments
      .filter((a) => current.agentSeen[a.id] || a.lastObservationId)
      .map((a) => ({ value: a.id, label: `${a.member} · ${shorten(a.id)}` })),
  ];
  $('sensor-view').replaceChildren(
    ...options.map((o) => {
      const option = document.createElement('option');
      option.value = o.value;
      option.textContent = o.label;
      return option;
    }),
  );
  if (options.some((o) => o.value === old)) $('sensor-view').value = old;
}
function summarize(event) {
  const d = event.detail;
  if (event.type === 'recovery.resolved')
    return `Original subgoal ${d.goalId} verified; experience publication authorized.`;
  if (d.acknowledgement) return `${d.acknowledgement.disposition} · ${d.acknowledgement.summary}`;
  if (d.tool) return `${d.tool} · ${shorten(d.assignmentId)}${d.error ? ` · ${d.error}` : ''}`;
  if (d.execution)
    return `${d.execution.state} · ${d.execution.control_steps} steps · ${d.execution.stop_reason || 'in progress'}`;
  if (d.result?.status) return `${d.result.status} · ${d.result.explanation}`;
  if (d.payload?.kind) return `${d.payload.kind} · ${shorten(d.sender)} → ${shorten(d.recipient)}`;
  if (d.member) return `${d.member} · ${d.status || ''}`;
  if (d.assignment) return `${d.assignment.member} · Fresh context and scoped tools`;
  if (d.changes) return d.changes.join(' ');
  if (d.metadata) return `SKILL.md · ${d.metadata.validation_status}`;
  return d.reason || d.error || d.context?.attemptSummary || '';
}
function renderTimeline() {
  const filter = $('event-filter').value;
  const view = inspectedHistory ?? current;
  const events = (view?.events ?? [])
    .filter(
      (e) =>
        filter === 'all' ||
        (filter === 'recovery'
          ? /^(recovery|retry|skill)/.test(e.type)
          : e.type.startsWith(filter)),
    )
    .reverse();
  text('event-count', `${current?.eventCount ?? current?.events.length ?? 0} events`);
  const first = view?.events[0]?.sequence ?? 0;
  const last = view?.events.at(-1)?.sequence ?? 0;
  text(
    'event-range',
    eventPageLoading
      ? 'Loading event history'
      : `${inspectedHistory ? 'History' : 'Recent'} · ${first}–${last} / ${current?.eventCount ?? 0} · Filters apply to this range`,
  );
  $('events-older').disabled = eventPageLoading || first <= 1;
  $('events-newer').disabled = eventPageLoading || !inspectedHistory || last >= current.eventCount;
  $('events-live').disabled = !inspectedHistory && !eventPageLoading;
  $('timeline').replaceChildren();
  for (const event of events) {
    const row = document.createElement('button');
    row.className = 'event-row';
    const values = [
      `#${event.sequence}`,
      new Date(event.at).toLocaleTimeString([], { hour12: false }),
      event.type,
      summarize(event),
      '↗',
    ];
    const classes = ['mono muted', 'mono muted', 'event-type', 'event-summary', 'muted'];
    values.forEach((value, i) => {
      const span = document.createElement('span');
      span.className = classes[i];
      span.textContent = value;
      row.append(span);
    });
    row.onclick = () => inspect(`Event #${event.sequence} · ${event.type}`, event);
    $('timeline').append(row);
  }
  if (!events.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No events in this view.';
    $('timeline').append(p);
  }
}
async function browseEvents(direction) {
  if (!current || eventPageLoading) return;
  const id = current.id;
  const revision = ++eventPageRevision;
  const selectedRun = loadRevision;
  const view = inspectedHistory ?? current;
  const through = direction === 'older' ? (view.events[0]?.sequence ?? 1) - 1 : current.eventCount;
  const after = view.events.at(-1)?.sequence ?? 0;
  eventPageLoading = true;
  renderTimeline();
  try {
    const range = direction === 'older' ? `before=${through}` : `after=${after}&through=${through}`;
    const page = await api(`/api/runs/${id}/history?${range}`);
    if (revision !== eventPageRevision || selectedRun !== loadRevision) return;
    if (direction === 'older' && page.throughSequence !== through)
      throw new Error('Backward history did not reach the selected boundary.');
    const base = {
      id,
      events: [],
      eventOffset: direction === 'older' ? page.afterSequence : after,
      eventCount: through,
    };
    const loaded = retainRunEvents(appendRunHistory(base, page));
    inspectedHistory = loaded;
  } finally {
    if (revision === eventPageRevision && selectedRun === loadRevision) {
      eventPageLoading = false;
      renderTimeline();
    }
  }
}
let feedSignature = '';
function actor(event) {
  const d = event.detail;
  const id = d.assignmentId || d.recipient || d.sender;
  return current?.assignments[id];
}
function renderTodos() {
  if (!current) return;
  const filter = $('agent-filter').value;
  const assignments = Object.values(current.assignments);
  const owner = assignments.find((a) => a.id === current.decisionAssignmentId);
  const selected =
    filter === 'all'
      ? owner
      : assignments.filter((a) => a.member === filter && (a.todos || a.todoCount)).at(-1);
  const details = archivedTodo.select(current.id, selected);
  const row = selected?.detailsStored ? details?.assignment : selected;
  text(
    'todo-source',
    archivedTodo.loading
      ? 'Loading archived checklist…'
      : archivedTodo.error
        ? 'Archived checklist unavailable'
        : row?.todos
          ? `${row.member} · session event ${row.todoSequence} · turn ${row.todoTurn}${row.todoTurn !== row.turn ? ' · previous turn' : ''}`
          : 'No checklist for the selected role.',
  );
  $('todos').replaceChildren();
  for (const item of row?.todos ?? []) {
    const div = document.createElement('div');
    div.className = `todo ${item.status}`;
    const badge = document.createElement('span');
    badge.className = 'todo-icon';
    badge.textContent =
      item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '◉' : '○';
    const button = document.createElement('button');
    button.textContent = item.content;
    button.onclick = () =>
      inspect(
        'Recent TODO history · Browse Event log for earlier snapshots',
        current.events.filter((e) => e.type === 'agent.todos' && e.detail.assignmentId === row.id),
      );
    const small = document.createElement('small');
    small.textContent = item.status.replaceAll('_', ' ');
    button.append(small);
    div.append(badge, button);
    $('todos').append(div);
  }
  $('inspect-todos').disabled = !assignments.some((a) => a.todos || a.todoCount);
}
function renderFeed() {
  if (!current) return;
  const filter = $('agent-filter').value;
  const query = $('debug-search').value.toLowerCase();
  const signature = `${current.id}:${receivedRunSequence(current)}:${filter}:${query}`;
  if (signature !== feedSignature) {
    feedSignature = signature;
    const nativeResults = new Map(
      current.events
        .filter((e) => e.type === 'dsh.tool-result')
        .map((e) => [e.detail.data.message.source.callId, e]),
    );
    const entries = current.events
      .filter((event) => {
        const member = actor(event)?.member;
        if (filter !== 'all' && member !== filter) return false;
        if (query && !JSON.stringify(event).replaceAll('__', '.').toLowerCase().includes(query))
          return false;
        if (event.type === 'agent.output')
          return event.detail.message.content.some(
            (b) => b.type === 'text' || b.type === 'reasoning',
          );
        return [
          'dsh.tool-call',
          'message.delivered',
          'agent.todos',
          'verification.completed',
          'run.failed',
          'run.succeeded',
          'run.cancelled',
          'recovery.opened',
          'recovery.resolved',
          'agent.report-acknowledged',
          'agent.context',
          'agent.context-usage',
          'skill.saved',
          'recovery.failed',
        ].includes(event.type);
      })
      .slice(-200);
    const feed = $('agent-feed');
    const scroll = feed.scrollTop;
    const expanded = new Set(
      [...feed.querySelectorAll('details[open]')].map((node) => node.dataset.event),
    );
    feed.replaceChildren();
    for (const event of entries) {
      const row = actor(event);
      const d = event.detail;
      const card = document.createElement('article');
      card.className = 'feed-card';
      const meta = document.createElement('div');
      meta.className = 'feed-meta';
      const who = document.createElement('strong');
      who.textContent = row?.member ?? 'harness';
      const identity = document.createElement('span');
      identity.className = 'mono';
      identity.textContent = `${shorten(d.assignmentId || d.recipient)}${d.turn ? ` · t${d.turn}${d.step ? `/s${d.step}` : ''}` : ''}`;
      const button = document.createElement('button');
      button.textContent = `#${event.sequence} ↗`;
      button.onclick = () =>
        inspect(`${event.type} · Correlation details`, { event, assignment: row ?? null });
      meta.append(who, identity, button);
      card.append(meta);
      if (event.type === 'agent.output') {
        for (const block of d.message.content) {
          if (block.type === 'text') {
            const p = document.createElement('p');
            p.className = 'feed-text';
            p.textContent = block.text;
            card.append(p);
          }
          if (block.type === 'reasoning') {
            const details = document.createElement('details');
            details.dataset.event = String(event.sequence);
            details.open = expanded.has(String(event.sequence));
            const title = document.createElement('summary');
            title.textContent = 'Reasoning returned by provider';
            const p = document.createElement('p');
            p.className = 'feed-text';
            p.textContent = block.text;
            details.append(title, p);
            card.append(details);
          }
        }
      } else if (event.type === 'dsh.tool-call') {
        const result = nativeResults.get(d.data.callId);
        const errored = result?.detail.data.message.content.some(
          (b) => b.type === 'tool-result' && b.isError,
        );
        const tool = document.createElement('button');
        tool.className = 'feed-tool';
        const heading = document.createElement('span');
        heading.className = 'feed-tool-title';
        const name = document.createElement('span');
        name.textContent = d.data.name.replaceAll('__', '.');
        const state = document.createElement('span');
        state.className = errored ? 'bad' : 'ok';
        state.textContent = result
          ? errored
            ? 'error'
            : 'completed'
          : ended(current.state)
            ? 'no result'
            : 'running';
        heading.append(name, state);
        const preview = document.createElement('span');
        preview.className = 'feed-tool-preview';
        preview.textContent =
          d.data.arguments.length > 190 ? d.data.arguments.slice(0, 190) + '…' : d.data.arguments;
        tool.append(heading, preview);
        tool.onclick = () =>
          inspect(`Tool call · ${d.data.name}`, {
            callId: d.data.callId,
            assignmentId: d.assignmentId,
            sessionId: d.sessionId,
            turn: d.turn,
            step: d.data.step,
            durationMs: result ? Date.parse(result.at) - Date.parse(event.at) : null,
            call: event,
            result: result ?? 'Pending',
            assignment: row,
          });
        card.append(tool);
      } else {
        const notice = document.createElement('div');
        notice.className = 'feed-notice';
        notice.textContent =
          event.type === 'agent.context' && d.type === 'edh/visual-history'
            ? `Visual context: ${d.data.retainedImages}/${d.data.maxImages} image blocks retained · ${d.data.omitted.length} historical groups omitted`
            : event.type === 'message.delivered'
              ? `Context received: ${d.payload?.kind ?? 'message'} · from ${shorten(d.sender)}`
              : event.type === 'agent.todos'
                ? `Checklist updated · ${d.todos.filter((t) => t.status === 'completed').length}/${d.todos.length} complete`
                : event.type === 'verification.completed'
                  ? `Formal verification: ${d.result.status} · ${d.result.task_scope.attempt_id}`
                  : event.type === 'recovery.opened'
                    ? 'Planner opened recovery; Evolver is joining with an explicit failed-attempt brief.'
                    : event.type === 'skill.saved'
                      ? 'SKILL.md saved with failed and successful evidence.'
                      : `${event.type}: ${summarize(event)}`;
        card.append(notice);
      }
      feed.append(card);
    }
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'feed-empty';
      empty.textContent =
        query || filter !== 'all'
          ? 'No matching activity. Clear the search or choose All agents.'
          : 'Waiting for agent output and tool calls…';
      feed.append(empty);
    }
    text('feed-count', `${entries.length} recent entries · Earlier records in Event log`);
    if ($('follow-output').checked) feed.scrollTop = feed.scrollHeight;
    else feed.scrollTop = scroll;
  }
  const live = Object.entries(current.agentStreams ?? {}).filter(
    ([id, s]) =>
      s.status === 'streaming' && (filter === 'all' || current.assignments[id]?.member === filter),
  );
  $('live-output').hidden = !live.length;
  text(
    'live-output',
    live
      .map(
        ([id, s]) =>
          `${current.assignments[id]?.member ?? id} · streaming\n${s.text || s.reasoning || 'Waiting for provider output…'}`,
      )
      .join('\n'),
  );
  renderTodos();
}
function render() {
  if (!current) return;
  renderClarification(current);
  text('run-state', `${current.state}${current.readOnly ? ' · read-only' : ''}`);
  text('run-id', `RUN ${shorten(current.id)}`);
  $('run-id').title = current.id;
  $('run-dot').dataset.state = current.state;
  $('instruction').value = current.instruction;
  text('team-name', current.teamId);
  renderDeployment();
  const execution = current.executions.at(-1);
  text('device-state', execution?.state.toUpperCase() ?? 'IDLE');
  const request = current.requests.findLast(
    (request) =>
      request.attempt_id === execution?.task_scope.attempt_id &&
      request.goal_id === execution?.task_scope.goal_id,
  );
  const maxSteps = request?.budget.max_control_steps;
  text('steps', `${execution?.control_steps ?? 0} / ${maxSteps ?? '—'}`);
  $('budget').max = maxSteps ?? 1;
  text('policy-calls', execution?.policy_calls ?? 0);
  text(
    'stop-confirmed',
    execution
      ? execution.device_confirmed
        ? current.source === 'test_fixture'
          ? 'Yes · fixture'
          : 'Yes · provider'
        : 'No'
      : '—',
  );
  text(
    'stop-reason',
    execution?.stop_reason?.replaceAll('_', ' ') ??
      'Action gate integration is planned for physical providers.',
  );
  $('budget').value = execution?.control_steps ?? 0;
  text('attempt', `ATTEMPT ${current.attempt}`);
  text(
    'plan-version',
    current.plan ? `Version ${current.plan.version} · Decision-owner writes` : 'Awaiting planner',
  );
  $('plan').replaceChildren();
  for (const [index, item] of (current.plan?.items ?? []).entries()) {
    const div = document.createElement('button');
    div.dataset.active = String(item.goal_id === current.activeGoalId && !ended(current.state));
    div.onclick = () =>
      inspect(`Goal · ${item.goal_id}`, {
        item,
        selected: item.goal_id === current.activeGoalId,
        verdicts: current.verdicts.filter((verdict) => verdict.task_scope.goal_id === item.goal_id),
      });
    div.className = 'plan-item';
    const badge = document.createElement('span');
    badge.className = 'check';
    badge.textContent = item.status === 'done' ? '✓' : String(index + 1);
    const info = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = item.description;
    const small = document.createElement('small');
    small.textContent = `${item.status} · ${item.goal_id}`;
    info.append(p, small);
    div.append(badge, info);
    $('plan').append(div);
  }
  const verdict = current.verdicts.at(-1);
  document.querySelector('.verification-box').dataset.status = verdict?.status ?? 'pending';
  text(
    'verification-status',
    verdict
      ? `${verdict.status.toUpperCase()} · ${verdict.task_scope.goal_id} · ${verdict.task_scope.attempt_id}`
      : 'Awaiting execution boundary',
  );
  text(
    'verification-explanation',
    verdict
      ? (verdict.explanation ?? verdict.explanationPreview) +
          (verdict.explanationTruncated ? '…' : '')
      : 'A completed policy call does not establish task success.',
  );
  $('inspect-verdict').disabled = !verdict;
  const recoverySaved = current.skillIds.includes(current.recoveryId);
  const recoveryState = recoverySaved
    ? 'SAVED'
    : current.activeRecoveryId && !ended(current.state)
      ? 'RECORDING'
      : current.recoveryId
        ? 'PENDING'
        : 'STANDBY';
  text('skill-count', `${recoveryState} · ${current.skillIds.length}`);
  $('phase-replan').classList.toggle('active', Boolean(current.recoveryId));
  $('phase-record').classList.toggle(
    'active',
    Object.values(current.assignments).some(
      (a) => a.member === (current?.configuration ?? config).team.bindings.recovery_evolver,
    ),
  );
  $('phase-skill').classList.toggle('active', recoverySaved);
  const recovery = current.recoveryStatus;
  if (recovery?.error) text('skill-count', 'LEARNING FAILED');
  text(
    'recovery-copy',
    recovery?.error
      ? `Experience recording failed: ${recovery.error}`
      : recoverySaved
        ? 'SKILL saved with failure signals, recovery guidance and verification evidence.'
        : recovery?.resolved
          ? 'Original subgoal verified. Awaiting experience publication.'
          : current.activeRecoveryId && !ended(current.state)
            ? 'Recording planner and execution progress until the original subgoal is verified.'
            : current.recoveryId
              ? 'Run ended before experience publication. Inspect the recovery trace.'
              : 'Waiting for a formal failure and a Planner recovery decision.',
  );
  $('inspect-recovery').disabled = !current.recoveryId;
  $('inspect-skill').disabled = !current.skills?.length;
  $('inspect-audit').disabled = false;
  $('inspect-reports').disabled = false;
  $('inspect-assignments').disabled = false;
  if (current.error) error(current.error);
  renderAgents();
  showSensor();
  renderTimeline();
  renderFeed();
  updateControls();
}
async function loadRun(id) {
  const revision = ++loadRevision;
  eventPageRevision++;
  inspectedHistory = null;
  eventPageLoading = false;
  stream?.close();
  error('');
  let loaded = await api(`/api/runs/${id}?events=none`);
  if (revision !== loadRevision) return;
  if (
    loaded.id !== id ||
    !Array.isArray(loaded.events) ||
    loaded.events.length !== 0 ||
    !Number.isSafeInteger(loaded.eventCount) ||
    loaded.eventCount < 0
  )
    throw new Error('Invalid run history projection.');
  text('connection', 'Loading recent history');
  const page = await api(`/api/runs/${id}/history?before=${loaded.eventCount}`);
  if (revision !== loadRevision) return;
  if (page.throughSequence !== loaded.eventCount)
    throw new Error('Recent history did not reach the selected boundary.');
  loaded.eventOffset = page.afterSequence;
  loaded = retainRunEvents(appendRunHistory(loaded, page));
  eventPageRevision++;
  inspectedHistory = null;
  eventPageLoading = false;
  current = loaded;
  feedSignature = '';
  $('follow-output').checked = true;
  render();
  await refreshHistory();
  if (revision !== loadRevision) return;
  stream = new EventSource(
    `/api/runs/${id}/events?format=delta&after=${receivedRunSequence(current)}`,
  );
  stream.onopen = () => connected(true);
  stream.onerror = () => connected(false);
  stream.addEventListener('run-update', (event) => {
    if (revision !== loadRevision) return;
    let update;
    let next;
    try {
      update = JSON.parse(event.data);
      next = retainRunEvents(mergeRunUpdate(current, update));
      if (event.lastEventId !== String(receivedRunSequence(next)))
        throw new Error('Run stream cursor does not match the received events.');
    } catch (failure) {
      stream.close();
      connected(false);
      error(failure.message);
      throw failure;
    }
    const oldState = current.state;
    current = next;
    if (update.projection === null) return;
    render();
    if (oldState !== next.state) refreshHistory().catch((e) => error(e.message));
  });
}
async function action(callback) {
  if (busy) return;
  busy = true;
  error('');
  updateControls();
  try {
    await callback();
  } catch (e) {
    error(e.message);
  } finally {
    busy = false;
    updateControls();
  }
}
$('agent-filter').onchange = renderFeed;
$('agent-feed').addEventListener(
  'wheel',
  (event) => {
    if (event.deltaY < 0) $('follow-output').checked = false;
  },
  { passive: true },
);
$('debug-search').oninput = renderFeed;
$('follow-output').onchange = () => {
  if ($('follow-output').checked) $('agent-feed').scrollTop = $('agent-feed').scrollHeight;
};
$('inspect-todos').onclick = () =>
  inspect(
    'Recent TODO history · Browse Event log for earlier snapshots',
    current?.events.filter((e) => e.type === 'agent.todos') ?? [],
  );
$('events-older').onclick = () => browseEvents('older').catch((e) => error(e.message));
$('events-newer').onclick = () => browseEvents('newer').catch((e) => error(e.message));
$('events-live').onclick = () => {
  eventPageRevision++;
  eventPageLoading = false;
  inspectedHistory = null;
  renderTimeline();
};
$('start').onclick = () => {
  if (
    hasLauncher() &&
    (!$('task-instruction').reportValidity() || !$('task-context').reportValidity())
  )
    return;
  return action(async () => {
    if (!taskCatalog.ready(activeUserSession()))
      throw new Error('Load the session task catalog before submitting a task.');
    const target = hasLauncher() ? `/api/sessions/${activeUserSessionId}/tasks` : '/api/runs';
    const input = {
      scenario: $('scenario').value,
      ...(hasLauncher()
        ? {
            instruction: $('task-instruction').value,
            contextRunIds: [...$('task-context').selectedOptions].map((option) => option.value),
            ...(activeUserSession()?.taskCatalog
              ? { catalogRevision: activeUserSession().taskCatalog.digest }
              : {}),
          }
        : {}),
    };
    const request = taskRequest(target, input, config.deploymentDigest);
    const result = await api(target, request);
    await loadRun(result.runId);
    completeTaskRequest(request.requestId);
  });
};
$('launch-profile').onchange = () => {
  selection = profileSelection(config.launchProfiles[$('launch-profile').value]);
  renderLauncher();
  updateControls();
};
$('create-session').onclick = () =>
  action(async () => {
    validateLaunchSelection(config.launchProfiles, $('launch-profile').value, selection);
    await api('/api/sessions', {
      profileId: $('launch-profile').value,
      selection,
      catalogRevision: config.deploymentDigest,
      requestId: crypto.randomUUID(),
    });
    await refreshHistory();
  });
$('end-session').onclick = () =>
  action(async () => {
    await api(`/api/sessions/${activeUserSessionId}/close`, {});
    await refreshHistory();
  });
$('workspace-skills').onclick = () =>
  action(async () => {
    const library = await api('/api/skills');
    inspect(
      'Workspace experience · Cross-session SKILL library',
      library.skills.length
        ? library
        : 'No experience yet. A formally failed subgoal followed by Planner recovery and verified success can publish a SKILL. Skills retain source, applicability and validation limits.',
    );
  });
bindStorageMaintenance($('storage-maintenance'), api, action);
const renderClarification = bindClarification($('user-clarification'), api, action);
for (const command of ['pause', 'resume', 'stop'])
  $(command).onclick = () =>
    action(async () => {
      await api(`/api/runs/${current.id}/${command}`, {});
      current = await api(`/api/runs/${current.id}`);
      render();
      await refreshHistory();
    });
$('refresh-history').onclick = () => refreshHistory().catch((e) => error(e.message));
$('sensor-view').onchange = showSensor;
$('scenario').onchange = () => {
  if (!current)
    $('instruction').value = taskDefinitions().presets?.[$('scenario').value]?.instruction ?? '';
  updateTaskComposer();
};
$('inspect-next-criteria').onclick = () =>
  inspect('Next task · Required success criteria', taskDefinitions().goals[$('scenario').value]);
$('reload-task-catalog').onclick = () => {
  taskCatalog.select(activeUserSession(), true);
  updateControls();
};
$('inspect-submission').onclick = () =>
  inspect('Submitted task · User instruction, criteria and explicit context', current.submission);
$('event-filter').onchange = renderTimeline;
$('inspect-team').onclick = () =>
  inspect(
    'Team definition & resolved bindings',
    current
      ? (current.configuration ?? {
          note: 'Historical configuration unavailable',
          assignments: current.assignments,
        })
      : config,
  );
$('inspect-frame').onclick = () =>
  inspect('Displayed observation · Evidence and source', displayedFrame);
$('inspect-verdict').onclick = () =>
  action(async () => {
    inspect('Formal verification · Accepted verdicts', '');
    await verdictBrowser.open(current.id, current.verdicts);
  });
$('inspect-skill').onclick = () =>
  inspect(
    'Recovery skill · SKILL.md',
    current.skills
      .map((s) => `---\n${JSON.stringify(s.metadata, null, 2)}\n---\n\n${s.markdown}`)
      .join('\n\n'),
  );
$('inspect-recovery').onclick = () =>
  action(async () =>
    inspect(
      'Recovery trace · Explicitly delivered context',
      await api(`/api/runs/${current.id}/recovery`),
    ),
  );
const auditBrowser = bindSessionAudit($('audit-controls'), $('inspector-body'), api, action);
const reportBrowser = bindReportHistory($('report-controls'), $('inspector-body'), api, action);
const verdictBrowser = bindVerdictDetails($('verdict-controls'), $('inspector-body'), api, action);
const assignmentBrowser = bindAssignmentDetails(
  $('assignment-controls'),
  $('inspector-body'),
  api,
  action,
);
$('inspect-assignments').onclick = () =>
  action(async () => {
    inspect('Assignment details · Explicit context and final state', '');
    await assignmentBrowser.open(current.id, Object.values(current.assignments));
  });
$('inspect-reports').onclick = () =>
  action(async () => {
    inspect('Role reports · Published versions and caller receipts', '');
    await reportBrowser.open(current.id, Object.values(current.assignments));
  });
$('inspect-audit').onclick = () =>
  action(async () => {
    inspect('Native DSH session audit · Read-only', '');
    await auditBrowser.open(current.id);
  });
$('inspector').addEventListener('close', () => {
  verdictBrowser.close();
  auditBrowser.close();
  reportBrowser.close();
  assignmentBrowser.close();
});
$('close-inspector').onclick = () => $('inspector').close();
$('inspector').addEventListener('click', (e) => {
  const rect = $('inspector').getBoundingClientRect();
  if (
    e.target === $('inspector') &&
    (e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom)
  )
    $('inspector').close();
});
try {
  config = await api('/api/config');
  $('launch-profile').replaceChildren(
    ...Object.entries(config.launchProfiles ?? {}).map(([id, profile]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = profile.label;
      return option;
    }),
  );
  text('team-name', config.team.team_id);
  $('scenario').replaceChildren(
    ...Object.entries(
      config.taskPresets ??
        Object.fromEntries(config.scenarios.map((id) => [id, { label: id.replaceAll('-', ' ') }])),
    ).map(([id, preset]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = preset.label;
      return option;
    }),
  );
  $('scenario').onchange();
  renderDeployment();
  renderAgents();
  showSensor();
  const history = await refreshHistory();
  if (history?.activeId || history?.runs[0]) await loadRun(history.activeId || history.runs[0].id);
  else {
    text('connection', 'Local server ready');
    updateControls();
  }
} catch (e) {
  error(e.message);
  connected(false);
  $('start').disabled = true;
}
historyTimer = setInterval(() => {
  if (!busy && !document.hidden) refreshHistory().catch((e) => error(e.message));
}, 2000);
window.addEventListener('pagehide', () => {
  stream?.close();
  clearInterval(historyTimer);
  workspaceHistory.close();
  taskHistory.close();
});
