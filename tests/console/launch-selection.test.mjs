import assert from 'node:assert/strict';
import test from 'node:test';
import {
  launchChoices,
  launchFields,
  matchingProfiles,
  profileSelection,
  validateLaunchSelection,
} from '../../apps/console/public/launch-selection.js';

const catalog = {
  'b1k-pi': {
    source: 'simulation',
    environment: 'b1k',
    embodiment: 'r1pro',
    checkpoint: 'pi051',
    policy: 'pi05',
    defaultModel: 'local-vlm',
  },
  'b1k-gr00t': {
    source: 'simulation',
    environment: 'b1k',
    embodiment: 'r1pro',
    checkpoint: 'gr00t8',
    policy: 'gr00t',
    defaultModel: 'api-vlm',
  },
  'robocasa-pi': {
    source: 'simulation',
    environment: 'robocasa',
    embodiment: 'panda',
    checkpoint: 'kitchen-policy',
    policy: 'pi05',
    defaultModel: 'local-vlm',
  },
  'robot-pi': {
    source: 'hardware',
    environment: 'lab',
    embodiment: 'panda',
    checkpoint: 'lab-policy',
    policy: 'pi05',
    defaultModel: 'api-vlm',
  },
};

test('environment and embodiment constrain the checkpoint choices', () => {
  assert.deepEqual(
    launchChoices(catalog, { source: 'simulation', environment: 'b1k' }, 'checkpoint'),
    ['pi051', 'gr00t8'],
  );
  assert.deepEqual(
    launchChoices(catalog, { source: 'simulation', environment: 'robocasa' }, 'embodiment'),
    ['panda'],
  );
  assert.deepEqual(launchChoices(catalog, { source: 'hardware' }, 'environment'), ['lab']);
});

test('checkpoint narrows policy and default model', () => {
  const selection = { ...catalog['b1k-gr00t'] };
  assert.deepEqual(launchChoices(catalog, selection, 'policy'), ['gr00t']);
  assert.deepEqual(launchChoices(catalog, selection, 'defaultModel'), ['api-vlm']);
});

test('individually known values cannot form an unregistered combination', () => {
  const selection = { ...profileSelection(catalog['b1k-pi']), checkpoint: 'kitchen-policy' };
  assert.deepEqual(matchingProfiles(catalog, selection), []);
  assert.throws(() => validateLaunchSelection(catalog, 'b1k-pi', selection), /compatible/);
  assert.throws(
    () => validateLaunchSelection(catalog, 'b1k-pi', profileSelection(catalog['b1k-gr00t'])),
    /compatible/,
  );
});

test('complete admitted selections preserve the exact installed profile', () => {
  for (const [id, profile] of Object.entries(catalog)) {
    const selection = profileSelection(profile);
    assert.equal(validateLaunchSelection(catalog, id, selection), profile);
    for (const field of launchFields)
      assert.ok(launchChoices(catalog, selection, field).includes(selection[field]));
  }
});

test('missing, extra, blank and inherited selections are rejected', () => {
  for (const value of [undefined, null, [], {}, Object.create(catalog['b1k-pi'])])
    assert.throws(() => validateLaunchSelection(catalog, 'b1k-pi', value), /complete/);
  for (const field of launchFields) {
    const missing = profileSelection(catalog['b1k-pi']);
    delete missing[field];
    assert.throws(() => validateLaunchSelection(catalog, 'b1k-pi', missing), /complete/);
    assert.throws(
      () =>
        validateLaunchSelection(catalog, 'b1k-pi', {
          ...profileSelection(catalog['b1k-pi']),
          [field]: ' ',
        }),
      /complete/,
    );
  }
  assert.throws(
    () => validateLaunchSelection(catalog, 'b1k-pi', { ...catalog['b1k-pi'], endpoint: 'url' }),
    /complete/,
  );
});

test('execution mode limits the selectable checkpoint and policy', () => {
  const profiles = {
    learned: { ...catalog['b1k-pi'], executionMode: 'policy' },
    direct: {
      ...catalog['b1k-pi'],
      executionMode: 'direct',
      checkpoint: 'gpt-6-astra',
      policy: 'astra',
    },
    hybrid: {
      ...catalog['b1k-pi'],
      executionMode: 'hybrid',
      checkpoint: 'pi051 + gpt-6-astra',
      policy: 'pi05-astra',
    },
  };
  assert.deepEqual(launchChoices(profiles, {}, 'executionMode'), ['policy', 'direct', 'hybrid']);
  assert.deepEqual(launchChoices(profiles, { executionMode: 'direct' }, 'checkpoint'), [
    'gpt-6-astra',
  ]);
  assert.throws(
    () =>
      validateLaunchSelection(profiles, 'learned', {
        ...profileSelection(profiles.learned),
        executionMode: 'direct',
      }),
    /compatible/,
  );
  assert.equal(
    validateLaunchSelection(profiles, 'hybrid', profileSelection(profiles.hybrid)),
    profiles.hybrid,
  );
});

test('unknown profile IDs and field names fail immediately', () => {
  for (const id of ['__proto__', 'toString', 'missing'])
    assert.throws(() => validateLaunchSelection(catalog, id, catalog['b1k-pi']), /Unknown/);
  assert.throws(() => launchChoices(catalog, {}, 'endpoint'), /Unknown/);
  assert.deepEqual(launchChoices({}, {}, 'checkpoint'), []);
});

test('profiles sharing components remain individually addressable', () => {
  const profiles = { a: catalog['b1k-pi'], b: { ...catalog['b1k-pi'], label: 'Other task set' } };
  assert.deepEqual(launchChoices(profiles, {}, 'checkpoint'), ['pi051']);
  assert.equal(matchingProfiles(profiles, profiles.a).length, 2);
  assert.equal(validateLaunchSelection(profiles, 'b', profileSelection(profiles.b)), profiles.b);
});
