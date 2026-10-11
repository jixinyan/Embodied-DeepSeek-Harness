export type ExecutionMode = 'policy' | 'direct' | 'hybrid';

const LITCHI_EXECUTION_MODES: Readonly<Record<string, ExecutionMode>> = {
  gpt_only: 'direct',
  pi05_plus_gpt: 'hybrid',
};

export function resolveExecutionMode(profile: {
  policy: { config: Record<string, unknown> };
}): ExecutionMode {
  const config = profile.policy.config;
  const configured = config.execution_mode;
  const legacy = config.evaluation_method;
  const value = configured ?? legacy ?? 'policy';
  const mode = typeof value === 'string' ? (LITCHI_EXECUTION_MODES[value] ?? value) : value;
  if (mode !== 'policy' && mode !== 'direct' && mode !== 'hybrid')
    throw new Error(`Unsupported policy execution mode: ${String(value)}.`);
  if (configured !== undefined && legacy !== undefined) {
    const legacyMode =
      typeof legacy === 'string' ? (LITCHI_EXECUTION_MODES[legacy] ?? legacy) : legacy;
    if (legacyMode !== mode) throw new Error('execution_mode conflicts with evaluation_method.');
  }
  return mode;
}
