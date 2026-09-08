/** Native DSH input schemas for the upper application tool pack. No dispatch logic. */
const str = { type: 'string' };
const integer = { type: 'integer' };
const strings = { type: 'array', items: str };
const obj = { type: 'object', additionalProperties: true };
export const CORE_TOOL_PARAMETERS: Record<string, Record<string, unknown>> = {
  'agent.report': {
    status: { type: 'string', enum: ['completed', 'failed', 'insufficient_context', 'cancelled'] },
    summary: str,
    result: { oneOf: [obj, { type: 'null' }] },
    evidenceRefs: strings,
    requestedContext: strings,
    expectedVersion: integer,
  },
  'planning.read': {},
  'planning.update': { plan: obj, expectedVersion: integer },
  'files.read': { path: str },
  'files.write': {
    path: str,
    content: { type: 'string' },
    expectedVersion: integer,
  },
  'files.search': { query: str },
  'team.query': { assignmentId: str },
  'team.delegate': {
    member: str,
    objective: str,
    context: { type: 'string' },
    evidenceRefs: strings,
  },
  'team.send': { assignmentId: str, message: str, evidenceRefs: strings },
  'context.request': { assignmentId: str, message: str, evidenceRefs: strings },
  'context.respond': { assignmentId: str, message: str, evidenceRefs: strings },
  'perception.capture': {},
  'observation.turn_view': { direction: { type: 'string', enum: ['left', 'center', 'right'] } },
  'execution.start': { instruction: str },
  'execution.query': {},
  'execution.pause': {},
  'execution.resume': {},
  'tasks.retry': { changes: strings, attemptSummary: str },
  'tasks.replan': { reason: str, changes: strings, attemptSummary: str },
  'tasks.finish': {},
  'tasks.abandon': { reason: str, status: { type: 'string', enum: ['failed', 'unknown'] } },
  'verification.check': {},
  'verification.submit': {
    status: { type: 'string', enum: ['passed', 'failed', 'unknown'] },
    explanation: str,
  },
  'skills.search': { query: str },
  'skills.load': { skillId: str },
  'skills.save': { markdown: str },
  'evidence.read': { evidenceId: str },
};
export const CORE_TOOLS = [...Object.keys(CORE_TOOL_PARAMETERS), 'todo_write'];

/** EDH admission limits beyond DSH's supported JSON Schema subset. */
export function assertCoreInputLimits(args: Record<string, unknown>): void {
  if (Buffer.byteLength(JSON.stringify(args)) > 256 * 1024)
    throw new Error('Tool input exceeds 256 KiB.');
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      const limit = key === 'content' ? 131072 : 12000;
      if (
        Buffer.byteLength(value) > limit ||
        (!value.length && key !== 'content' && key !== 'context')
      )
        throw new Error(`Invalid length for ${key}.`);
    }
    if (
      Array.isArray(value) &&
      (value.length > 32 ||
        value.some(
          (item) => typeof item !== 'string' || !item.length || Buffer.byteLength(item) > 12000,
        ))
    )
      throw new Error(`Invalid reference/context list: ${key}.`);
  }
  if (
    'expectedVersion' in args &&
    (!Number.isSafeInteger(args.expectedVersion) || Number(args.expectedVersion) < 0)
  )
    throw new Error('expectedVersion must be a nonnegative safe integer.');
}
