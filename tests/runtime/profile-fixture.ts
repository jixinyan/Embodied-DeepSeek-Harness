import type { PhysicalRuntimeProfile } from '@edh/execution';
import { ContractValidator, type ActionSpec } from '@edh/contracts';
import { readFile } from 'node:fs/promises';
export async function profileValidator() {
  return new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
}
/** Synthetic one-channel profile; no real robot/action limits are implied. */
export function fixtureProfile(id = 'fixture-arm'): PhysicalRuntimeProfile {
  const actionSpec: ActionSpec = {
    schema_version: 'physical.action_spec.v1' as const,
    embodiment_id: id,
    version: 'fixture-v1',
    coordinate_frame: 'fixture-joint',
    control_mode: 'joint_position' as const,
    frequency_hz: 10,
    channels: [
      {
        name: 'joint',
        quantity: 'angular' as const,
        unit: 'radian' as const,
        minimum: -1,
        maximum: 1,
      },
    ],
  };
  const source = {
    repository: 'https://example.invalid/cpu-fixture',
    release: 'test-only',
    revision: 'a'.repeat(40),
    supportedEmbodiments: [id] as [string],
    config: {},
  };
  return {
    schemaVersion: 'edh.physical-profile.v1',
    simulation: { ...source, id: 'cpu-scene', provider: 'fixture-sim', taskAdapters: ['cup'] },
    embodiment: {
      id,
      family: 'robot_arm',
      actionSpec,
      observationChannels: ['front-rgb', 'joints'],
      requiredTools: ['perception.capture'],
      promptContext: `Synthetic embodiment ${id}; no navigation capability.`,
    },
    policy: {
      ...source,
      id: 'cpu-policy',
      provider: 'fixture-policy',
      modelFamily: 'scripted',
      transport: 'custom-fixture',
      acceptedInstruction: 'subgoal',
      actionSpec: structuredClone(actionSpec),
      checkpointRef: 'fixture://script-v1',
      normalizationRef: 'none',
      observationMapping: { image: 'front-rgb', state: 'joints' },
      actionTransform: 'fixture-identity-v1',
    },
    rolePromptAdditions: { planner: 'Use fixture evidence only.' },
  };
}
