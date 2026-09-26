/** Native DSH input schemas for the upper application tool pack. No dispatch logic. */
const str = { type: 'string' };
const integer = { type: 'integer' };
const strings = { type: 'array', items: str };
const obj = { type: 'object', additionalProperties: true };
export const CORE_TOOL_PARAMETERS: Record<string, Record<string, unknown>> = {
  'user.ask': { question: str, reason: str, options: strings },
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
  'team.ack_report': {
    assignmentId: str,
    reportId: str,
    disposition: { type: 'string', enum: ['accepted', 'rejected'] },
    summary: str,
  },
  'team.query': { assignmentId: str, beforeReportId: str, includeBodies: { type: 'boolean' } },
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
  'perception.segment_objects': {
    evidenceId: { type: 'string', minLength: 1, maxLength: 128 },
    attachmentId: { type: 'string', minLength: 1, maxLength: 128 },
    textPrompt: { type: 'string', minLength: 1, maxLength: 1024 },
  },
  'observation.turn_view': { direction: { type: 'string', enum: ['left', 'center', 'right'] } },
  'execution.start': { instruction: str },
  'execution.query': {},
  'execution.pause': {},
  'execution.resume': {},
  'tasks.select_goal': { goalId: str },
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
  'skills.load': { skillId: str, sections: strings },
  'skills.save': { markdown: str },
  'evidence.read': { evidenceId: str },
};
export const CORE_TOOLS = [...Object.keys(CORE_TOOL_PARAMETERS), 'todo_write'];
export const CORE_TOOL_OPTIONAL_PARAMETERS: Readonly<Record<string, readonly string[]>> = {
  'team.query': ['beforeReportId', 'includeBodies'],
  'skills.load': ['sections'],
};

export const CORE_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'team.query':
    'Inspect your own assignment or one directly delegated by you. Returns current agent status, the latest report and a bounded page of report receipts. Use reportHistoryPage.nextBeforeReportId as beforeReportId to read earlier published versions. Set includeBodies=true when earlier report contents are needed. Acknowledgement and delivery status do not establish physical success.',
  'user.ask':
    'Ask the user for information needed by the current task. Supply a question, its reason, and zero to eight suggested responses. Only the decision owner may ask, with confirmed stopped execution. This tool records the question and concludes the current native turn. Wait for the explicit user response; task criteria and evidence permissions remain unchanged.',
  'skills.search':
    'Search recovery experience on demand using task-semantic keywords. Returns up to 20 metadata records, without SKILL bodies. Inspect capabilities, limitations, origin and validated configurations before selecting a skill. Matching uses keywords, not semantic embeddings; an empty result does not prove that no relevant experience exists.',
  'skills.load':
    'Load one selected, immutable SKILL version into this assignment context by skillId. Optionally supply sections as distinct heading names, such as Failure signals, Possible causes, Avoid, Planning guidance or Verification guidance. Selected reads always retain the document preamble, When to use, Limits and Source, with metadata and an explicit included/omitted-section list. Omit sections to read the complete document. Use after reviewing search metadata or an explicitly supplied skill reference; reuse guidance already available in context. Guidance grants no source-evidence access or changes to task criteria.',
  'skills.save':
    'Publish recovery guidance after formal success of the original recovery goal. Include applicability, failure signals, possible causes, unsuccessful changes, planning and verification guidance, limits and evidence references. Publication does not inject this SKILL into other agents or future sessions.',
};

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
