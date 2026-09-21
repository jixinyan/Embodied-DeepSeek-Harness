import { launchFields, launchChoices } from './launch-selection.js';

export function renderLaunchControls(catalog, selection, { locked, busy, onChange }) {
  for (const [index, field] of launchFields.entries()) {
    const input = document.getElementById(`select-${field}`);
    const parentsSelected = launchFields.slice(0, index).every((parent) => selection[parent]);
    const choices = locked ? [selection[field]] : launchChoices(catalog, selection, field);
    const signature = JSON.stringify(choices);
    if (input.dataset.choices !== signature) {
      input.replaceChildren(
        new Option('Choose…', ''),
        ...choices.map((value) => new Option(value, value)),
      );
      input.dataset.choices = signature;
    }
    if (parentsSelected && !selection[field] && choices.length === 1) selection[field] = choices[0];
    input.value = selection[field] ?? '';
    input.disabled = busy || locked || !parentsSelected || choices.length === 0;
    input.onchange = () => {
      selection[field] = input.value;
      for (const child of launchFields.slice(index + 1)) delete selection[child];
      onChange();
    };
  }
}
