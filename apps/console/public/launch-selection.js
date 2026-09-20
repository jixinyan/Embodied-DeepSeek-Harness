export const launchFields = Object.freeze([
  'source',
  'environment',
  'embodiment',
  'checkpoint',
  'policy',
  'defaultModel',
]);

export function matchingProfiles(profiles, selection) {
  return Object.entries(profiles).filter(([, profile]) =>
    launchFields.every((field) => !selection[field] || profile[field] === selection[field]),
  );
}

export function launchChoices(profiles, selection, field) {
  const index = launchFields.indexOf(field);
  if (index < 0) throw new Error('Unknown launch selection field.');
  const parents = Object.fromEntries(
    launchFields.slice(0, index).map((key) => [key, selection[key]]),
  );
  return [...new Set(matchingProfiles(profiles, parents).map(([, profile]) => profile[field]))];
}

export function profileSelection(profile) {
  return Object.fromEntries(launchFields.map((field) => [field, profile[field]]));
}

export function validateLaunchSelection(profiles, profileId, selection) {
  if (!Object.hasOwn(profiles, profileId)) throw new Error('Unknown launch profile.');
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
      'A complete environment, embodiment, checkpoint, policy and model selection is required.',
    );
  const profile = profiles[profileId];
  if (launchFields.some((field) => profile[field] !== selection[field]))
    throw new Error('The selected components do not match an installed compatible configuration.');
  return profile;
}
