const $ = (id) => document.getElementById(id);
let config, current, stream, displayedFrame;
let busy = false;
let activeRunId = null;
let runHistory = [];
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
async function api(path, data) {
  const response = await fetch(
    path,
    data === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
  return result;
}
function inspect(title, value) {
  text('inspector-title', title);
  text('inspector-body', typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  if (!$('inspector').open) $('inspector').showModal();
}
function connected(value) {
  text('connection', value ? 'Event stream connected' : 'Reconnecting to server');
  $('connection-dot').classList.toggle('offline', !value);
}
async function refreshHistory() {
  const data = await api('/api/runs');
  runHistory = data.runs;
  activeRunId = data.activeId;
  $('history').replaceChildren();
  for (const run of data.runs) {
    const button = document.createElement('button');
    button.classList.toggle('active', run.id === current?.id);
    const title = document.createElement('strong');
    title.textContent = run.scenario.replaceAll('-', ' ');
    const info = document.createElement('span');
    info.textContent = `${run.state} · ${new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    button.append(title, info);
    button.onclick = () => loadRun(run.id).catch((e) => error(e.message));
    $('history').append(button);
  }
  if (!data.runs.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No runs yet.';
    $('history').append(p);
  }
  updateControls();
  return data;
}
function updateControls() {
  const active = runHistory.find((r) => r.id === activeRunId);
  $('start').disabled = busy || Boolean(active && !ended(active.state));
  $('scenario').disabled = $('start').disabled;
  const writable = current && !current.readOnly && !ended(current.state) && !busy;
  const execution = current?.executions.at(-1);
  $('pause').disabled = !writable || execution?.state !== 'running';
  $('resume').disabled = !writable || execution?.state !== 'paused';
  $('stop').disabled = !writable;
}
function showSensor() {
  const selection = $('sensor-view').value;
  displayedFrame = selection === 'latest' ? current?.latestSensor : current?.agentSeen[selection];
  const frame = displayedFrame;
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
  text('sensor-description', frame?.description ?? 'Awaiting an actual fixture observation.');
  text('sensor-age', frame ? new Date(frame.evidence.observed_at).toLocaleTimeString() : '—');
  $('inspect-frame').disabled = !frame;
  const inside = frame?.visualization.cupInside === true;
  $('cup').setAttribute('transform', inside ? 'translate(580 194)' : 'translate(338 262)');
  const step = Number(frame?.visualization.step ?? 0);
  $('robot-arm').setAttribute(
    'points',
    step % 2 ? '567,289 551,239 465,198 427,219' : '567,289 551,239 465,198 404,231',
  );
}
function renderAgents() {
  const assignments = Object.values(current?.assignments ?? {});
  text('session-count', `${assignments.length} SESSIONS`);
  $('agents').replaceChildren();
  const members = Object.keys(config.team.members);
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
      member === config.team.bindings.decision_owner
        ? '◈'
        : member === config.team.bindings.final_verifier
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
    status.className = `tag ${running ? 'running' : ''}`;
    status.textContent = running ? 'RUNNING' : latest ? 'IDLE' : 'STANDBY';
    card.append(icon, info, status);
    card.onclick = () => inspect(`${member} · Independent assignments`, membersAssignments);
    $('agents').append(card);
  }
  const old = $('sensor-view').value;
  const options = [
    { value: 'latest', label: 'Latest sensor' },
    ...assignments
      .filter((a) => current.agentSeen[a.id])
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
  const events = (current?.events ?? [])
    .filter(
      (e) =>
        filter === 'all' ||
        (filter === 'recovery'
          ? /^(recovery|retry|skill)/.test(e.type)
          : e.type.startsWith(filter)),
    )
    .slice(-100)
    .reverse();
  text('event-count', `${current?.events.length ?? 0} events`);
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
  const row =
    filter === 'all' ? owner : assignments.filter((a) => a.member === filter && a.todos).at(-1);
  text(
    'todo-source',
    row?.todos
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
        'TODO history · Native DSH snapshots',
        current.events.filter((e) => e.type === 'agent.todos' && e.detail.assignmentId === row.id),
      );
    const small = document.createElement('small');
    small.textContent = item.status.replaceAll('_', ' ');
    button.append(small);
    div.append(badge, button);
    $('todos').append(div);
  }
  $('inspect-todos').disabled = !assignments.some((a) => a.todos);
}
function renderFeed() {
  if (!current) return;
  const filter = $('agent-filter').value;
  const query = $('debug-search').value.toLowerCase();
  const signature = `${current.id}:${current.events.length}:${filter}:${query}`;
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
        if (query && !JSON.stringify(event).toLowerCase().includes(query)) return false;
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
          'skill.saved',
          'recovery.failed',
        ].includes(event.type);
      })
      .slice(-200);
    const feed = $('agent-feed');
    const scroll = feed.scrollTop;
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
        state.textContent = result ? (errored ? 'error' : 'completed') : 'running';
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
          event.type === 'message.delivered'
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
    text('feed-count', `${entries.length} entries · Provider output and native tool events`);
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
  text('run-state', `${current.state}${current.readOnly ? ' · read-only' : ''}`);
  text('run-id', `RUN ${shorten(current.id)}`);
  text('team-name', current.teamId);
  const execution = current.executions.at(-1);
  text('device-state', execution?.state.toUpperCase() ?? 'IDLE');
  text('steps', `${execution?.control_steps ?? 0} / 5`);
  text('policy-calls', execution?.policy_calls ?? 0);
  text('stop-confirmed', execution ? (execution.device_confirmed ? 'Yes · fixture' : 'No') : '—');
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
  for (const item of current.plan?.items ?? []) {
    const div = document.createElement('div');
    div.className = 'plan-item';
    const badge = document.createElement('span');
    badge.className = 'check';
    badge.textContent = item.status === 'done' ? '✓' : '1';
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
  text(
    'verification-status',
    verdict
      ? `${verdict.status.toUpperCase()} · ${verdict.task_scope.goal_id} · ${verdict.task_scope.attempt_id}`
      : 'Awaiting execution boundary',
  );
  text(
    'verification-explanation',
    verdict?.explanation ?? 'A completed policy call does not establish task success.',
  );
  $('inspect-verdict').disabled = !verdict;
  text('skill-count', `${current.skillIds.length} SKILLS`);
  $('phase-replan').classList.toggle('active', Boolean(current.recoveryId));
  $('phase-record').classList.toggle(
    'active',
    Object.values(current.assignments).some(
      (a) => a.member === config.team.bindings.recovery_evolver,
    ),
  );
  $('phase-skill').classList.toggle('active', current.skillIds.length > 0);
  text(
    'recovery-copy',
    current.skillIds.length
      ? 'Recovery distilled. The skill preserves failure signals, possible causes, corrective guidance and both failed and successful evidence.'
      : current.recoveryId
        ? 'Evolver is receiving scoped planner, execution and verification records. Publication requires original-subgoal success.'
        : 'Evolver joins when the planner decides to replan or retry after a formal failed subgoal.',
  );
  $('inspect-recovery').disabled = !current.recoveryId;
  $('inspect-skill').disabled = !current.skills?.length;
  $('inspect-audit').disabled = false;
  if (current.error) error(current.error);
  renderAgents();
  showSensor();
  renderTimeline();
  renderFeed();
  updateControls();
}
async function loadRun(id) {
  stream?.close();
  error('');
  current = await api(`/api/runs/${id}`);
  render();
  await refreshHistory();
  stream = new EventSource(`/api/runs/${id}/events`);
  stream.onopen = () => connected(true);
  stream.onerror = () => connected(false);
  stream.addEventListener('snapshot', (event) => {
    const next = JSON.parse(event.data);
    if (next.id !== current.id || next.events.length < current.events.length) return;
    const oldState = current.state;
    current = next;
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
for (const tab of document.querySelectorAll('[data-tab]'))
  tab.onclick = () => {
    for (const button of document.querySelectorAll('[data-tab]'))
      button.setAttribute('aria-selected', String(button === tab));
    for (const pane of document.querySelectorAll('[data-pane]'))
      pane.hidden = pane.dataset.pane !== tab.dataset.tab;
  };
$('agent-filter').onchange = renderFeed;
$('debug-search').oninput = renderFeed;
$('follow-output').onchange = () => {
  if ($('follow-output').checked) $('agent-feed').scrollTop = $('agent-feed').scrollHeight;
};
$('inspect-todos').onclick = () =>
  inspect(
    'TODO history · Native DSH snapshots',
    current?.events.filter((e) => e.type === 'agent.todos') ?? [],
  );
$('start').onclick = () =>
  action(async () => {
    const result = await api('/api/runs', {
      scenario: $('scenario').value,
      requestId: crypto.randomUUID(),
    });
    await loadRun(result.runId);
  });
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
$('event-filter').onchange = renderTimeline;
$('inspect-team').onclick = () => inspect('Team definition & resolved bindings', config);
$('inspect-frame').onclick = () =>
  inspect('Displayed observation · Evidence and source', displayedFrame);
$('inspect-verdict').onclick = () =>
  inspect('Formal verification · Accepted verdicts', current.verdicts);
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
$('inspect-audit').onclick = () =>
  action(async () =>
    inspect('Native DSH session audit · Read-only', await api(`/api/runs/${current.id}/audit`)),
  );
$('close-inspector').onclick = () => $('inspector').close();
$('inspector').addEventListener('click', (e) => {
  if (e.target === $('inspector')) $('inspector').close();
});
try {
  config = await api('/api/config');
  text('team-name', config.team.team_id);
  for (const member of Object.keys(config.team.members)) {
    const option = document.createElement('option');
    option.value = member;
    option.textContent = member;
    $('agent-filter').append(option);
  }
  renderAgents();
  const history = await refreshHistory();
  if (history.activeId || history.runs[0]) await loadRun(history.activeId || history.runs[0].id);
  else {
    text('connection', 'Local server ready');
    updateControls();
  }
} catch (e) {
  error(e.message);
  connected(false);
  $('start').disabled = true;
}
window.addEventListener('pagehide', () => stream?.close());
