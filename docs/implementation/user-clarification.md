# Active-task user clarification

The decision owner can call `user.ask` with `question`, `reason` and an `options`
array. Suggested responses are optional; an empty array permits a free-text question.
The built-in Planner exposes this tool and `execution.pause`. Custom decision roles
must explicitly include the tools they need in their role definition.

## Admission and native lifecycle

UpperRun authenticates the caller from its assignment scope. A question records the
run, requesting assignment, native tool-call ID, selected goal and attempt. Execution
must be absent or confirmed paused/ended. When present, the queried execution must
exactly match a published backend status and carry device confirmation. Planner can
request a pause and wait for that confirmation before asking.

Question publication calls native DSH `concludeTurn()`. This ends the asking turn
after its tool results settle. Waiting for the user does not keep a tool call open.
While a question is pending, or an accepted answer awaits the asking turn's completion,
the owner can read plans, files, reports, execution, evidence and skills, and acknowledge
reports. Domain mutations, new delegations and execution/resume are rejected. Native
TODO tracking remains available. Other agents retain their existing permissions.

The answer is stored before delivery. UpperRun waits through native `whenIdle()`,
rechecks task/assignment lifetime, and uses the original TeamSessions/DSH followup
mechanism to send a `user-clarification` message to the requesting Planner. Delivery
does not grant new tools, change immutable criteria or establish verified success.
Resuming a paused execution requires the Planner's explicit decision and the existing
execution-boundary checks.

## Durable identity and failure handling

`UserClarifications` stores `edh.clarification.v1` records. Question identity hashes
the run, assignment and native call ID. Repeating the same pending call returns the
same question; changing its content conflicts. Each run permits one unanswered question.
A subsequent question can coexist with a prior accepted answer whose delivery is still
settling. Completion of that older delivery does not replace the current question.

States are `pending`, `answered`, `cancelled` and `interrupted`. Accepted responses
contain an immutable UUID `requestId` and normalized text. Repeating both fields
returns the stored receipt. A changed ID or answer returns a conflict and never
initiates another delivery. Free text is accepted even when suggestions are provided.

Delivery is tracked separately as `none`, `queued`, `settled`, `failed` or
`interrupted`. `settled` denotes native quiescence; task completion remains subject to
formal verification. Ending a task or retiring its requesting assignment cancels an
unanswered question. A delivery failure is persisted and enters the existing run
failure path. Restart marks pending questions and queued deliveries interrupted,
preserves accepted answers and does not replay them.

Question records and run events are separate journal writes. A write/publication
failure is reported; cross-record transaction atomicity is not provided. Restart
inspects the durable question records, and historical projections resolve their latest
state through the question reader. Malformed or conflicting stored identities fail.

## HTTP and console

`GET /api/runs/:runId/clarifications/:questionId` returns `{clarification}`.
`POST` to the same route accepts `{requestId, text}` and returns HTTP 202 with
`{record, replay}`. The route checks run ownership and current task admission. Exact
accepted retries remain readable after task completion; a pending historical question
cannot resume a task. Local Host/Origin restrictions apply.

Questions, reasons and responses allow 12,000 characters; suggestions allow eight
distinct values of up to 1,000 characters each. The answer route accepts up to 96 KiB
of JSON to accommodate escaped and multibyte text, followed by field validation. Other
JSON routes retain their existing 16 KiB default. Unsupported media types, malformed
JSON, excessive bytes and invalid fields return explicit errors.

The panel shows the question, its reason, suggestions, a free-text answer and delivery
status within the existing workspace. Suggestions populate the answer without submitting
it. Drafts and unconfirmed request identity persist in browser session storage per
run/question. Accepted responses clear the draft and disable editing. Read-only task
views disable submission. Stale pending updates cannot reopen an answered question;
late responses cannot overwrite a different selected question. All content renders as text.

## Acceptance and remaining verification

Run the focused checks with:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json --test tests/runtime/clarifications.test.ts tests/console/clarification-http.test.mjs
```

Nine native/file checks cover identity, isolated copies, answer retries/conflicts,
independent deliveries, scoped cancellation, journal reopen, input and stored-record
validation, actual write exclusion and native conclude-turn dispatch. One HTTP check
uses the production browser JSON helper, body reader and question service over a real
socket. It covers origin admission, invalid requests, byte limits, a 12,000-character
multibyte response, write exclusion, repeated acceptance and conflicts.

Browser component checks use production markup/controller/API code and the real
question service. They cover suggestions, literal markup, draft restoration, read-only
mode, failed submission during an actual journal write hold, retry identity, successful
response persistence and stale-state handling. The component has no model consumer;
its accepted answer correctly remains queued.

A full UpperRun test with a live VLM and provider-confirmed pause/resume remains
required. Component checks establish the listed mechanisms; they do not establish
model decision quality, physical stopping or end-to-end task continuation.
