export const launchFields = Object.freeze([
  'source',
  'environment',
  'embodiment',
  'executionMode',
  'checkpoint',
  'policy',
  'defaultModel',
]);

const component = (profile, field) =>
  field === 'executionMode' ? (profile[field] ?? 'policy') : profile[field];

export function matchingProfiles(profiles, selection) {
  return Object.entries(profiles).filter(([, profile]) =>
    launchFields.every(
      (field) => !selection[field] || component(profile, field) === selection[field],
    ),
  );
}

export function launchChoices(profiles, selection, field) {
  const index = launchFields.indexOf(field);
  if (index < 0) throw new Error('Unknown launch selection field.');
  const parents = Object.fromEntries(
    launchFields.slice(0, index).map((key) => [key, selection[key]]),
  );
  return [
    ...new Set(matchingProfiles(profiles, parents).map(([, profile]) => component(profile, field))),
  ];
}

export function profileSelection(profile) {
  return Object.fromEntries(launchFields.map((field) => [field, component(profile, field)]));
}

export function validateLaunchSelection(profiles, profileId, selection) {
  if (!Object.hasOwn(profiles, profileId)) throw new Error('Unknown launch profile.');
  const profile = profiles[profileId];
  if (
    !selection ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    Object.keys(selection).length !== launchFields.length ||
    launchFields.some(
      (field) =>
        !Object.hasOwn(selection, field) ||
        typeof selection[field] !== 'string' ||
        !selection[field].trim(),
    )
  )
    throw new Error(
      'A complete environment, embodiment, execution mode, checkpoint, policy and model selection is required.',
    );
  if (launchFields.some((field) => component(profile, field) !== selection[field]))
    throw new Error('The selected components do not match an installed compatible configuration.');
  return profile;
}
