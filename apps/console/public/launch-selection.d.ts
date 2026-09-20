export type LaunchField =
  | 'source'
  | 'environment'
  | 'embodiment'
  | 'checkpoint'
  | 'policy'
  | 'defaultModel';
export type LaunchSelection = Record<LaunchField, string>;
export const launchFields: readonly LaunchField[];
export function matchingProfiles<T extends Partial<LaunchSelection>>(
  profiles: Record<string, T>,
  selection: Partial<LaunchSelection>,
): [string, T][];
export function launchChoices<T extends Partial<LaunchSelection>>(
  profiles: Record<string, T>,
  selection: Partial<LaunchSelection>,
  field: LaunchField,
): string[];
export function profileSelection(profile: Partial<LaunchSelection>): LaunchSelection;
export function validateLaunchSelection<T extends Partial<LaunchSelection>>(
  profiles: Record<string, T>,
  profileId: string,
  selection: unknown,
): T;
