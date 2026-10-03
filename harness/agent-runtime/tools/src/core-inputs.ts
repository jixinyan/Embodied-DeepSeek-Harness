const text = (description: string) => ({ type: 'string', description });
const list = (description: string) => ({
  type: 'array',
  items: text('Nonempty string, at most 12000 UTF-8 bytes.'),
  description,
});
const version = {
  type: 'integer',
  description:
    'Nonnegative safe integer. Use the last returned version; use 0 before the first write.',
};
const evidenceId = text(
  'Copy evidence.id from an authorized observation receipt; 1 to 128 characters.',
);
const attachmentId = text(
  'Copy images[index].attachmentId for one camera in that observation; 1 to 128 characters.',
);
const maskEvidenceId = text(
  'Copy maskEvidenceId from segmentation of this exact source image; 1 to 128 characters.',
);
const maskAttachmentId = text(
  'Copy instances[index].maskAttachmentId for the selected object mask; 1 to 128 characters.',
);
const evidenceRefs = list(
  'Authorized observation evidence IDs to include or grant explicitly; at most 32. Use [] when no observations are needed.',
);
const obj = { type: 'object', additionalProperties: true };
export const CORE_TOOL_PARAMETERS: Record<string, Record<string, unknown>> = {
  'user.ask': {
    question: text('One self-contained question for the user.'),
    reason: text('Explain which task decision needs this answer.'),
    options: list('Zero to eight suggested answers. Use [] for a free-text question.'),
  },
  'agent.report': {
    status: { type: 'string', enum: ['completed', 'failed', 'insufficient_context', 'cancelled'] },
    summary: text('Factual findings, limitations and the caller action they support.'),
    result: {
      oneOf: [obj, { type: 'null' }],
      description: 'Structured role result; null for insufficient_context.',
    },
    evidenceRefs,
    requestedContext: list(
      'Specific missing inputs for insufficient_context; otherwise []. At most 32.',
    ),
    expectedVersion: version,
  },
  'planning.read': {},
  'planning.update': { plan: obj, expectedVersion: version },
  'files.read': {
    path: text(
      'Relative path within this assignment private files, for example memory/progress.md.',
    ),
  },
  'files.write': {
    path: text('Relative path within this assignment private files.'),
    content: text('Complete UTF-8 file contents, up to 131072 bytes. Empty contents are allowed.'),
    expectedVersion: version,
  },
  'files.search': { query: text('Nonempty text to find in this assignment private files.') },
  'team.ack_report': {
    assignmentId: text('Exact sender assignmentId from a received report.'),
    reportId: text('Exact immutable reportId being assessed.'),
    disposition: { type: 'string', enum: ['accepted', 'rejected'] },
    summary: text('Explain the report assessment and any remaining evidence limitations.'),
  },
  'team.query': {
    assignmentId: text('Your assignment ID or one returned by your own team.delegate call.'),
    beforeReportId: text('Optional pagination cursor: copy reportHistoryPage.nextBeforeReportId.'),
    includeBodies: {
      type: 'boolean',
      description: 'Optional; request earlier report bodies as well as receipts.',
    },
  },
  'team.delegate': {
    member: text(
      'Configured Team member alias. Formal Verifier is assigned by the host; learning-disabled Evolver is unavailable.',
    ),
    objective: text('Bounded specialist task with a concrete expected result.'),
    context: text(
      'Explicit instructions, attempted actions, facts, constraints and expected output. The recipient has a fresh context; empty text is allowed.',
    ),
    evidenceRefs,
  },
  'team.send': {
    assignmentId: text(
      'Exact active recipient assignment ID from the explicit communication context.',
    ),
    message: text('Self-contained context or instructions for that assignment.'),
    evidenceRefs,
  },
  'context.request': {
    assignmentId: text('Exact active caller assignment ID from your InvocationBrief.'),
    message: text(
      'Identify the missing facts, observations or constraints needed to complete the assignment.',
    ),
    evidenceRefs,
  },
  'context.respond': {
    assignmentId: text('Exact active assignment ID that requested more context.'),
    message: text('Answer the requested inputs with factual context and remaining limitations.'),
    evidenceRefs,
  },
  'perception.capture': {},
  'perception.segment_objects': {
    evidenceId,
    attachmentId,
    textPrompt: { type: 'string', description: 'Object text prompt, 1 to 1024 characters.' },
  },
  'perception.estimate_depth': {
    evidenceId,
    attachmentId,
    maskEvidenceId,
    maskAttachmentId,
  },
  'perception.measure_object': {
    evidenceId,
    attachmentId,
    maskEvidenceId,
    maskAttachmentId,
  },
  'observation.turn_view': {
    direction: {
      type: 'string',
      enum: ['left', 'center', 'right'],
      description:
        'Advertised view direction. Inspect the returned achieved view; motion depends on the embodiment.',
    },
  },
  'observation.rotate': {
    yawDeg: {
      type: 'number',
      description:
        'Finite relative body yaw in degrees between -90 and 90; positive turns left, negative turns right. Use 0 to hold yaw.',
    },
    pitchDeg: {
      type: 'number',
      description:
        'Finite relative measured head-camera pitch in degrees between -45 and 45; positive looks up, negative looks down. R1Pro uses trunk motion. Use 0 to hold pitch.',
    },
  },
  'execution.start': {
    instruction: text(
      'One concrete instruction accepted by the selected checkpoint for the active goal. Use the catalog instruction verbatim when required by this deployment; at most 12000 UTF-8 bytes.',
    ),
  },
  'execution.query': {},
  'execution.pause': {},
  'execution.end': {
    executionId: text('Exact current execution_id from the accepted start or query receipt.'),
    reason: text('Observation-supported reason to end this attempt for independent formal review.'),
  },
  'execution.resume': {},
  'tasks.select_goal': {
    goalId: text('Exact goal_id of a ready item in the last successfully written plan.'),
  },
  'tasks.retry': {
    changes: list(
      'One to 32 concrete adjustments supported by the failed attempt; continuation from the retained scene is valid when budget ended with observed progress.',
    ),
    attemptSummary: text(
      'Previous instruction, confirmed stop reason, observed physical outcome and exact failed checks; distinguish supported causes from uncertainty.',
    ),
  },
  'tasks.replan': {
    reason: text('Evidence-based reason to revise the plan or introduce admitted repair work.'),
    changes: list('One to 32 concrete plan changes; preserve the original goal criterion.'),
    attemptSummary: text(
      'Factual previous attempt and failed checks. Required after formal failure.',
    ),
  },
  'tasks.finish': {},
  'tasks.abandon': {
    reason: text(
      'Observed unsuccessful outcome or missing evidence, including exhausted attempts when applicable.',
    ),
    status: {
      type: 'string',
      enum: ['failed', 'unknown'],
      description:
        'failed for established unsuccessful outcome; unknown when the criterion cannot be settled.',
    },
  },
  'verification.check': {},
  'verification.submit': {
    status: {
      type: 'string',
      enum: ['passed', 'failed', 'unknown'],
      description:
        'Verdict consistent with verification.check facts and the exact admitted all/any criterion.',
    },
    explanation: text(
      'Identify the checked condition, returned fact status, source evidence and any missing evidence; stopping alone is insufficient.',
    ),
  },
  'skills.search': {
    query: text('Focused task-semantic keywords for a planning or verification question.'),
  },
  'skills.load': {
    skillId: text('Exact skillId from reviewed search metadata or an explicit skill reference.'),
    sections: list(
      'Optional distinct heading names to load; at most 32. Omit for the complete SKILL body.',
    ),
  },
  'skills.save': {
    markdown: text(
      'Complete SKILL.md with applicability, failure/success guidance, limits and source evidence; at most 12000 UTF-8 bytes.',
    ),
  },
  'evidence.read': { evidenceId },
};
export const CORE_TOOLS = [...Object.keys(CORE_TOOL_PARAMETERS), 'todo_write'];
export const CORE_TOOL_OPTIONAL_PARAMETERS: Readonly<Record<string, readonly string[]>> = {
  'team.query': ['beforeReportId', 'includeBodies'],
  'skills.load': ['sections'],
};

export const CORE_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'evidence.read':
    'Read one immutable observation already authorized for this assignment. Returns a SensorSample with evidence.id, evidence.task_scope, evidence.observed_at and images, and presents available images to this model. Each images[index] includes attachmentId and the camera name when available. Reading preserves the original capture time. SKILL source references and another role conversation do not grant access; request missing observations explicitly from the caller.',
  'perception.capture':
    'Capture current authorized sensor observations. Returns a SensorSample with evidence.id, evidence.observed_at, evidence.task_scope and images; the result also presents available RGB images to this model. Each images[index] includes attachmentId and the camera name when available. Copy evidence.id and images[index].attachmentId for segmentation and geometry. Capture does not move the device or verify success.',
  'perception.segment_objects':
    'Ground one text-described object in an authorized source camera image with SAM. Supply evidenceId and attachmentId copied from capture or evidence.read. Returns instances, each with maskAttachmentId, plus maskEvidenceId and overlayEvidenceId; an empty instances array supplies no object geometry. Use the original RGB references with a selected mask for subsequent depth or native measurement. Segmentation does not establish persistent object identity or physical success.',
  'observation.turn_view':
    'Request an advertised active view using the embodiment motion resource. Decision owner only, with stopped execution and available resource. Returns an authorized observation and achieved state; inspect actual motion and capture time. View changes may move the body and invalidate earlier geometry. Use only when exposed by the selected deployment.',
  'observation.rotate':
    'Rotate the current embodiment to actively observe the environment. Decision owner only, before execution or after a confirmed ended execution with formal verification. Supply both degree-valued angles; unsupported axes must be 0. Returns a new SensorSample, presents its RGB images and includes rotation with requested/achieved yaw and pitch, measured before/after pose, control_steps, raw_sim_steps and stop_reason. R1Pro yaw turns the entire body and pitch changes trunk posture. Inspect achieved angles, displacement and any stalled/budget/cancelled outcome. Motion invalidates earlier capture geometry; policy execution and formal verification cannot run concurrently with rotation.',
  'planning.read':
    'Read authoritative task planning context without side effects. Returns plan (null before the first write), planWrite, taskId, ownerAgentId, ownerAssignmentId, activeGoalId, attemptId, successContract, goal catalog, allowed subgoal checks, retry and learningEnabled. planWrite is a complete planning.update argument object with numeric expectedVersion and next plan.version, actual owner/task identities and unchanged criteria. Edit planWrite.plan items to record your decisions and pass that object directly to planning.update. The initial template contains the required final goal; later templates preserve all current items and only advance version. This read neither writes a plan nor decides item status or dependencies.',
  'files.read':
    'Read one assignment-private versioned text file. Returns path, content and a decimal version string. Convert that version to an integer for the next files.write.expectedVersion. Files belonging to another role require explicit communication.',
  'files.write':
    'Write the complete contents of one assignment-private file. expectedVersion is integer 0 for a new file; otherwise convert the latest returned decimal version string to an integer. Returns path, content and the committed decimal version string. File notes can record evidence and progress; they do not verify physical success.',
  'files.search':
    'Search this assignment private files and return matching file records in files. Retrieve only the material needed for the current task decision.',
  'team.delegate':
    'Create a fresh specialist assignment for a configured member with objective, complete explicit context and authorized observation references. Returns accepted and assignmentId for messages or inspection. Supply the requested result, task facts, attempted actions and limitations; conversations are independent. The host assigns formal Verifier at execution end, and disabled recovery learning forbids Evolver delegation.',
  'team.send':
    'Send self-contained context and explicitly granted observations to an active assignment in the allowed caller/delegate relationship. Returns a message delivery receipt. Delivery does not imply recipient completion or task success.',
  'context.request':
    'Request missing information from the active caller using explicit message text and evidenceRefs. Returns a message receipt. To suspend an incomplete specialist assignment, publish agent.report with insufficient_context, result=null and requestedContext, then wait for the caller.',
  'context.respond':
    'Provide explicitly requested facts and authorized observations to an active delegated assignment. Returns a message receipt and permits its native follow-up; preserve its stated objective and permissions.',
  'team.ack_report':
    'Record an immutable accepted/rejected assessment of one exact received assignment report. Returns its acknowledgement receipt. Read the report first, identify limitations and assess its scope. This assessment does not replace formal physical verification.',
  'execution.start':
    'Start one nonblocking, bounded policy job for the selected ready goal and current attempt, after its successful selection receipt. Returns execution identity, state and admitted budget; actions pass through ActionGate. The host supplies goal, attempt, criterion and resource identities. Await the receipt, finish this response and wait for the execution/formal-verdict follow-up. At most one start per attempt; no polling loop or duplicate start. A new failed-goal attempt requires an accepted tasks.retry first.',
  'execution.query':
    'Read the current published job status without starting motion. Returns execution (null when absent) and formalVerification (null or assignmentId/status/verdictStatus/nextStep). Inspect control_steps, policy_calls, stop_reason, device_confirmed and boundary_event_id. A pending formalVerification is host-owned: finish this response and wait for its verdict follow-up. Status references can be metadata-only while running; do not interpret those as images or success.',
  'execution.pause':
    'Decision owner requests confirmed stopping of the current job. Returns execution status after the request; require state=paused and device_confirmed before treating motion as paused. Ordinary pause preserves the current attempt and cumulative budget and creates no formal Verifier.',
  'execution.end':
    'Decision owner ends the exact current running or ordinarily paused job for independent formal review. Supply its executionId and an observation-supported reason. The worker drains policy work, confirms device stop and publishes a fresh ended boundary with planner_stop; the host assigns a fresh Verifier. Returns the actual current execution. A concurrent native end retains its original reason and boundary. This action ends the attempt and declares no physical success; await the formal verdict before goal selection, retry or completion.',
  'execution.resume':
    'Decision owner explicitly resumes a confirmed ordinarily paused job in the same attempt with its remaining cumulative budget. Returns execution status. Reassess the scene and current goal before authorization; ended jobs require the formal outcome and explicit retry instead.',
  'verification.check':
    'Formal Verifier only: run the admitted criterion checks at this assignment exact confirmed end boundary. Returns facts and boundaryId, and supplies the check observation images to this model. Each fact has check_id, value (true/false/null), evidence_refs and a reason for null. The host retains facts and evidence for verification.submit; do not replace arguments, move the device or interpret incomplete evidence as success.',
  'perception.measure_object':
    'Measure one SAM-grounded visible object region using same-frame native simulator RGB-D and camera calibration. Supply its original authorized evidenceId/attachmentId and matching maskEvidenceId/maskAttachmentId. Available only for an explicitly enabled native provider while confirmed stopped. Returns meter-valued axial depth and camera range, source hashes, camera/world frames and the mean of visible valid surface points. The surface centroid is not the full object geometric center. This read-only measurement does not verify task success.',
  'perception.estimate_depth':
    'Estimate depth for one SAM-grounded object in an authorized source image. Supply the original evidenceId and attachmentId plus its matching SAM maskEvidenceId and maskAttachmentId. Returns meter-valued camera axial depth statistics, valid-pixel coverage, model provenance and an overlay. Camera range requires deployment-provided intrinsics. Monocular estimates have unverified accuracy for the source camera and cannot establish verified geometry or task success.',
  'tasks.retry':
    'Admit one new attempt after a current formal failed verdict and confirmed ended execution. Provide a factual attemptSummary and nonempty concrete changes. Read planning.read.retry for the per-goal three-attempt limit. Await this receipt before fresh perception, plan/TODO updates and execution.start in a subsequent model step. The environment is retained and original success criteria remain unchanged; retry does not start motion.',
  'tasks.replan':
    'Record the decision owner plan revision and concrete changes. After formal failure, include the factual attemptSummary. Update the durable plan explicitly; a new execution attempt still requires tasks.retry. Recovery learning follows the Team configuration.',
  'planning.update':
    'Write the complete durable PlanDocument as a structured JSON object in plan, with every object and array closed and admitted criteria unchanged. Use planning.read.planWrite as the complete argument object and edit its plan items for your decisions. The plan field begins with { and contains nested objects and arrays; it is never a quoted or escaped JSON document. expectedVersion is numeric and plan.version equals expectedVersion + 1. Retain the required final goal with a non-abandoned status. Item statuses are planned, active, waiting, done or abandoned; abandoned is available only for optional goals. A done item requires its latest accepted passed verdict. Conclude an unsuccessful task through tasks.abandon. Await the successful write receipt before selecting a goal in a subsequent model step. Keep descriptions concise; task identities, owners, dependencies and criteria are structured fields.',
  'tasks.select_goal':
    'Select an existing ready goal from the successfully committed durable plan. Call in a subsequent model step after planning.update returns success. Dependencies require current formal success. Await this selection receipt before execution.start.',
  'agent.report':
    'Publish a scoped assignment report to its fixed caller. Supply every required field, including expectedVersion, result, evidenceRefs and requestedContext. Start expectedVersion at 0 and use the returned version afterward. Supply result as a structured JSON object or null, respecting the role output schema; evidenceRefs carries authorized evidence IDs. A final report completes this assignment and concludes this turn. insufficient_context requires result=null and specific requestedContext, concludes this turn and waits for explicit caller context. Task decision owners report only insufficient_context and complete through tasks.finish or tasks.abandon; formal Verifiers complete through verification.submit.',
  'verification.submit':
    'Submit one formal passed, failed or unknown verdict after verification.check at the confirmed execution boundary. The host delivers the accepted verdict and authorized evidence to Planner, concludes this native turn and retires the Verifier assignment.',
  'tasks.finish':
    'Complete the original task after current-attempt formal success at the latest confirmed execution boundary. The durable plan must be complete and every decision-owner TODO must be completed. Update the entire TODO list before calling. Publishes the task outcome and concludes the current native turn.',
  'tasks.abandon':
    'Record the decision owner final failed or unknown task outcome with a concrete reason. Before calling, finish factual assessment TODOs describing unmet conditions and exhausted or unavailable recovery; completed assessment work does not claim physical success. Keep the required final plan goal and its original criterion in history; changing its plan status to abandoned is unnecessary. Confirms execution stopping, publishes the outcome and concludes the current native turn.',
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
