import mermaid from '/vendor/mermaid/mermaid.esm.min.mjs';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  layout: 'dagre',
  htmlLabels: false,
  fontFamily: 'system-ui, sans-serif',
  themeVariables: {
    primaryColor: '#edf6ff',
    primaryTextColor: '#123069',
    primaryBorderColor: '#8abaff',
    lineColor: '#76a9ed',
    fontSize: '14px',
  },
});

let renderedSignature = '';
let graphSignature = '';
let visibleAssignments = [];
let revision = 0;
const label = (value) =>
  Array.from(String(value).slice(0, 160), (char) =>
    /[a-zA-Z0-9 _.-]/.test(char) ? char : `#${char.codePointAt(0)};`,
  ).join('');

export function renderCoordination(configuration, run) {
  const assignments = Object.values(run?.assignments ?? {});
  const members = [
    ...new Set([
      ...Object.keys(configuration?.team?.members ?? {}),
      ...assignments.map((a) => a.member),
    ]),
  ];
  visibleAssignments = assignments;
  const signature = JSON.stringify([
    configuration?.digest,
    members,
    run?.id,
    assignments.map((a) => [a.id, a.status]),
    run?.state,
    run?.activeGoalId,
    run?.verdicts?.at(-1),
    run?.skillIds,
    run?.readOnly,
    Boolean(run?.latestSensor),
    run?.requests?.length,
    [run?.executions?.at(-1)?.execution_id, run?.executions?.at(-1)?.state],
    run?.recoveryId,
    run?.activeRecoveryId,
  ]);
  if (signature === renderedSignature) return;
  renderedSignature = signature;
  const cards = document.getElementById('team-cards');
  cards.replaceChildren();
  const graph = [
    'flowchart LR',
    `team(("${label(configuration?.team?.team_id ?? run?.teamId ?? 'Team')}"))`,
  ];
  for (const [index, member] of members.entries()) {
    const selected = assignments.filter((a) => a.member === member);
    const current = selected.find((a) => a.status === 'running') ?? selected.at(-1);
    const role = configuration?.roles?.[member];
    const state =
      run?.state === 'interrupted' && current?.status === 'running'
        ? 'interrupted'
        : (current?.status ?? 'configured');
    const node = `role${index}`;
    graph.push(`${node}["${label(member)}"]`, `team --- ${node}`);
    if (state === 'running') graph.push(`class ${node} activeRole`);
    const card = document.createElement('button');
    card.className = 'role-orbit-card';
    card.dataset.state = state;
    card.setAttribute('aria-label', `${member}: ${state}. Inspect role and assignments.`);
    const emblem = document.createElement('span');
    emblem.className = 'role-emblem';
    emblem.textContent = member.slice(0, 1).toUpperCase();
    const title = document.createElement('strong');
    title.textContent = member;
    const status = document.createElement('span');
    status.className = 'role-status';
    status.textContent = state;
    const count = document.createElement('small');
    count.textContent = `${selected.length} assignments · ${current?.tools.length ?? role?.definition.tools.length ?? 0} tools`;
    const model = document.createElement('small');
    model.className = 'role-model';
    model.textContent = current?.model ?? role?.model ?? 'Model unavailable';
    card.append(emblem, title, status, count, model);
    card.onclick = () => {
      document.getElementById('inspector-title').textContent = `${member} / Role configuration`;
      document.getElementById('inspector-body').textContent = JSON.stringify(
        { role, assignments: visibleAssignments.filter((a) => a.member === member) },
        null,
        2,
      );
      document.getElementById('inspector').showModal();
    };
    cards.append(card);
  }
  const links = new Set();
  for (const assignment of assignments) {
    const caller = assignments.find((a) => a.id === assignment.brief.caller_assignment_id);
    if (!caller || caller.member === assignment.member) continue;
    const from = members.indexOf(caller.member);
    const to = members.indexOf(assignment.member);
    if (from >= 0 && to >= 0) links.add(`role${from} --> role${to}`);
  }
  graph.push(...links);
  document.getElementById('team-mode').textContent = run
    ? `TASK ${run.id.slice(0, 8)}`
    : 'CONFIGURATION';
  const definition = graph.join('\n');
  if (definition !== graphSignature) {
    graphSignature = definition;
    void draw(definition, ++revision);
  }
  const flow = document.getElementById('execution-flow');
  flow.replaceChildren();
  const execution = run?.executions?.at(-1);
  const verdict = run?.verdicts?.findLast((v) => v.execution_id === execution?.execution_id);
  const isRunning = (binding) =>
    run?.state !== 'interrupted' &&
    assignments.some(
      (a) => a.member === configuration?.team?.bindings?.[binding] && a.status === 'running',
    );
  const phases = [
    ['Observe', run?.latestSensor ? 'received' : 'waiting'],
    ['Plan', isRunning('decision_owner') ? 'active' : run?.requests?.length ? 'issued' : 'waiting'],
    [
      'Execute',
      execution
        ? run?.readOnly && execution.state !== 'ended'
          ? 'interrupted'
          : execution.state
        : 'waiting',
    ],
    ['Verify', verdict?.status ?? (isRunning('final_verifier') ? 'active' : 'waiting')],
    [
      'Experience',
      isRunning('recovery_evolver') ? 'active' : run?.skillIds?.length ? 'published' : 'waiting',
    ],
  ];
  for (const [name, state] of phases) {
    const phase = document.createElement('div');
    phase.className = 'workflow-phase';
    phase.dataset.state = state;
    phase.setAttribute('aria-label', `${name}: ${state}`);
    const dot = document.createElement('span');
    dot.className = 'phase-orb';
    dot.textContent =
      state === 'passed' || state === 'published' ? '✓' : state === 'failed' ? '!' : '';
    const caption = document.createElement('span');
    caption.textContent = name;
    const status = document.createElement('small');
    status.textContent = state;
    caption.append(status);
    phase.append(dot, caption);
    flow.append(phase);
  }
}

async function draw(definition, version) {
  const { svg } = await mermaid.render(`team-render-${version}`, definition);
  if (version !== revision) return;
  const template = document.createElement('template');
  template.innerHTML = svg;
  document.getElementById('team-graph').replaceChildren(template.content);
}
