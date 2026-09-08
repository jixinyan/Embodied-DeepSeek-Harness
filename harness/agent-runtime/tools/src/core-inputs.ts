/** Native DSH input schemas for the upper application tool pack. No dispatch logic. */
const str = { type: 'string', minLength: 1, maxLength: 12000 };
const integer = { type: 'integer', minimum: 0 };
const strings = { type: 'array', items: str, maxItems: 32 };
const obj = { type: 'object', additionalProperties: true };
export const CORE_TOOL_PARAMETERS: Record<string, Record<string, unknown>> = {
  'planning.read': {},
  'planning.update': { plan: obj, expectedVersion: integer },
  'files.read': { path: str },
  'files.write': {
    path: str,
    content: { type: 'string', maxLength: 131072 },
    expectedVersion: integer,
  },
  'files.search': { query: str },
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
  'observation.turn_view': { direction: { enum: ['left', 'center', 'right'] } },
  'execution.start': { instruction: str },
  'execution.query': {},
  'execution.pause': {},
  'execution.resume': {},
  'tasks.retry': { changes: strings, attemptSummary: str },
  'tasks.replan': { reason: str, changes: strings, attemptSummary: str },
  'tasks.finish': {},
  'tasks.abandon': { reason: str, status: { enum: ['failed', 'unknown'] } },
  'verification.check': {},
  'verification.submit': { status: { enum: ['passed', 'failed', 'unknown'] }, explanation: str },
  'skills.search': { query: str },
  'skills.load': { skillId: str },
  'skills.save': { markdown: str },
  'evidence.read': { evidenceId: str },
};
export const CORE_TOOLS = [...Object.keys(CORE_TOOL_PARAMETERS), 'todo_write'];
