export function renderTaskComposer({
  enabled,
  session,
  scenario,
  presets,
  goals,
  runs,
  busy,
  current,
}) {
  const element = (id) => document.getElementById(id);
  element('task-composer').hidden = !enabled;
  const instruction = element('task-instruction');
  const key = `${session?.id ?? ''}:${scenario}`;
  const presetInstruction = presets?.[scenario]?.instruction ?? '';
  if (instruction.dataset.task !== key) {
    if (
      instruction.dataset.session !== (session?.id ?? '') ||
      instruction.value === instruction.dataset.preset
    )
      instruction.value = presetInstruction;
    instruction.dataset.task = key;
    instruction.dataset.session = session?.id ?? '';
    instruction.dataset.preset = presetInstruction;
  }
  instruction.disabled = busy || session?.state !== 'ready';
  const input = element('task-context');
  const terminal = new Set(['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown']);
  const eligible = runs.filter(
    (run) => run.userSessionId === session?.id && terminal.has(run.state),
  );
  const signature = JSON.stringify([session?.id, eligible.map((run) => [run.id, run.state])]);
  if (input.dataset.tasks !== signature) {
    const retained = input.dataset.session === session?.id ? [...input.selectedOptions] : [];
    const selected = new Set(retained.map((option) => option.value));
    const visible = new Set(eligible.map((run) => run.id));
    input.replaceChildren(
      ...retained.filter((option) => !visible.has(option.value)),
      ...eligible.map((run) => {
        const option = new Option(
          `${run.id.slice(0, 8)} · ${run.state} · ${run.instruction}`,
          run.id,
        );
        option.selected = selected.has(run.id);
        return option;
      }),
    );
    input.dataset.tasks = signature;
    input.dataset.session = session?.id ?? '';
  }
  input.disabled = instruction.disabled || !input.options.length;
  const validate = () => {
    instruction.setCustomValidity(instruction.value.trim() ? '' : 'Enter a task instruction.');
    input.setCustomValidity(
      input.selectedOptions.length > 4 ? 'Select at most four historical tasks.' : '',
    );
  };
  instruction.oninput = validate;
  input.onchange = validate;
  validate();
  const reset = element('reset-task-instruction');
  reset.disabled = instruction.disabled;
  reset.onclick = () => {
    instruction.value = presetInstruction;
    validate();
  };
  element('inspect-next-criteria').disabled = !goals?.[scenario];
  element('inspect-submission').disabled = !current?.submission;
}
