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
    evidenceId: {
      type: 'string',
      description: 'Authorized observation ID, 1 to 128 characters.',
    },
    attachmentId: {
      type: 'string',
      description: 'Authorized camera attachment ID, 1 to 128 characters.',
    },
    textPrompt: { type: 'string', description: 'Object text prompt, 1 to 1024 characters.' },
  },
  'perception.estimate_depth': {
    evidenceId: str,
    attachmentId: str,
    maskEvidenceId: str,
    maskAttachmentId: str,
  },
  'perception.measure_object': {
    evidenceId: str,
    attachmentId: str,
    maskEvidenceId: str,
    maskAttachmentId: str,
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
  'perception.measure_object':
    'Measure one SAM-grounded visible object region using same-frame native simulator RGB-D and camera calibration. Supply its original authorized evidenceId/attachmentId and matching maskEvidenceId/maskAttachmentId. Available only for an explicitly enabled native provider while confirmed stopped. Returns meter-valued axial depth and camera range, source hashes, camera/world frames and the mean of visible valid surface points. The surface centroid is not the full object geometric center. This read-only measurement does not verify task success.',
  'perception.estimate_depth':
    'Estimate depth for one SAM-grounded object in an authorized source image. Supply the original evidenceId and attachmentId plus its matching SAM maskEvidenceId and maskAttachmentId. Returns meter-valued camera axial depth statistics, valid-pixel coverage, model provenance and an overlay. Camera range requires deployment-provided intrinsics. Monocular estimates have unverified accuracy for the source camera and cannot establish verified geometry or task success.',
  'tasks.retry':
    'Admit one new attempt after a current formal failed verdict and confirmed ended execution. Provide a factual attemptSummary and nonempty concrete changes. Read planning.read.retry for the per-goal three-attempt limit. Await this receipt before fresh perception, plan/TODO updates and execution.start in a subsequent model step. The environment is retained and original success criteria remain unchanged; retry does not start motion.',
  'tasks.replan':
    'Record the decision owner plan revision and concrete changes. After formal failure, include the factual attemptSummary. Update the durable plan explicitly; a new execution attempt still requires tasks.retry. Recovery learning follows the Team configuration.',
  'planning.update':
    'Write the complete durable PlanDocument as a structured JSON object in plan, with every object and array closed and admitted criteria unchanged. Supply expectedVersion from planning.read; plan.version must equal expectedVersion + 1. Retain the required final goal with a non-abandoned status. Item statuses are planned, active, waiting, done or abandoned; abandoned is available only for optional goals. A done item requires its latest accepted passed verdict. Conclude an unsuccessful task through tasks.abandon. Await the successful write receipt before selecting a goal in a subsequent model step. Keep descriptions concise; task identities, owners, dependencies and criteria are structured fields.',
  'tasks.select_goal':
    'Select an existing ready goal from the successfully committed durable plan. Call in a subsequent model step after planning.update returns success. Dependencies require current formal success. Await this selection receipt before execution.start.',
  'agent.report':
    'Publish a scoped assignment report to its fixed caller. Supply every required field, including expectedVersion, result, evidenceRefs and requestedContext. Start expectedVersion at 0 and use the returned version afterward. Supply result as a structured JSON object or null, respecting the role output schema; evidenceRefs carries authorized evidence IDs. A final report completes this assignment and concludes this turn. insufficient_context requires result=null and specific requestedContext, concludes this turn and waits for explicit caller context. Task decision owners report only insufficient_context and complete through tasks.finish or tasks.abandon; formal Verifiers complete through verification.submit.',
  'verification.submit':
    'Submit one formal passed, failed or unknown verdict after verification.check at the confirmed execution boundary. The host delivers the accepted verdict and authorized evidence to Planner, concludes this native turn and retires the Verifier assignment.',
  'tasks.finish':
    'Complete the original task after current-attempt formal success at the latest confirmed execution boundary. The durable plan must be complete and every decision-owner TODO must be completed. Update the entire TODO list before calling. Publishes the task outcome and concludes the current native turn.',
  'tasks.abandon':
    'Record the decision owner final failed or unknown task outcome with a concrete reason. Keep the required final plan goal and its original criterion in history; changing its plan status to abandoned is unnecessary. Confirms execution stopping, publishes the outcome and concludes the current native turn.',
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
      const characterLimit = [
        'evidenceId',
        'attachmentId',
        'maskEvidenceId',
        'maskAttachmentId',
      ].includes(key)
        ? 128
        : key === 'textPrompt'
          ? 1024
          : undefined;
      if (characterLimit !== undefined && value.length > characterLimit)
        throw new Error(`Invalid length for ${key}.`);
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
