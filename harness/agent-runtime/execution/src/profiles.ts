import { isDeepStrictEqual } from 'node:util';
import type { ContractValidator, PhysicalRuntimeProfile } from '@edh/contracts';
export type {
  PhysicalRuntimeProfile,
  SimulationProfile,
  EmbodimentProfile,
  PolicyProfile,
} from '@edh/contracts';

export type ResolvedPhysicalRuntimeProfile = PhysicalRuntimeProfile;

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** Configuration consistency only; registered adapters must validate their own mappings. */
export function resolvePhysicalRuntimeProfile(
  input: unknown,
  validator: ContractValidator,
): ResolvedPhysicalRuntimeProfile {
  const profile = structuredClone(validator.parse('PhysicalRuntimeProfile', input));
  const { simulation, embodiment, policy } = profile;
  validator.parse('ActionSpec', embodiment.actionSpec);
  validator.parse('ActionSpec', policy.actionSpec);
  if (embodiment.actionSpec.embodiment_id !== embodiment.id)
    throw new Error('ActionSpec belongs to another embodiment.');
  for (const provider of [simulation, policy])
    if (!provider.supportedEmbodiments.includes(embodiment.id))
      throw new Error(`${provider.id} does not support embodiment ${embodiment.id}.`);
  if (!isDeepStrictEqual(policy.actionSpec, embodiment.actionSpec))
    throw new Error('Policy canonical output ActionSpec differs from the embodiment contract.');
  for (const channel of Object.values(policy.observationMapping))
    if (!embodiment.observationChannels.includes(channel))
      throw new Error(`Policy observation mapping references unavailable channel: ${channel}`);
  return freeze(profile);
}

/** Trusted installed adapters validate SDK-specific options without allocating a backend. */
export interface PhysicalProfileValidators {
  readonly simulations: Readonly<Record<string, (profile: ResolvedPhysicalRuntimeProfile) => void>>;
  readonly policies: Readonly<Record<string, (profile: ResolvedPhysicalRuntimeProfile) => void>>;
}

export function validatePhysicalProviderBindings(
  profile: ResolvedPhysicalRuntimeProfile,
  bindings: PhysicalProfileValidators | undefined,
): void {
  const simulation = bindings?.simulations[profile.simulation.provider];
  const policy = bindings?.policies[profile.policy.provider];
  if (typeof simulation !== 'function' || typeof policy !== 'function')
    throw new Error('Physical profile requires registered simulation and policy validators.');
  for (const validate of [simulation, policy]) {
    const result: unknown = validate(profile);
    if (result !== undefined)
      throw new Error('Physical profile validators must be synchronous and return void.');
  }
}
