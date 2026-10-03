# Independent role context continuation and cancellation

Each delegated role owns an independent native DSH Session. Its InvocationBrief,
explicit messages and authorized evidence define the available context. The
caller provides missing information through `context.respond` to the same
assignment. The role publishes its next report with the previous receipt's
version as `expectedVersion`. Report history preserves the immutable predecessor,
current report and caller acknowledgement.

Actual Qwen/RoboDojo run `04823dd4` uses immutable EDH source `8aa11fc` and the
original native `build_tower` catalog. The selected checkpoint identity comes
from the verified 18-file Pi0.5 checkpoint inventory. The decision-owner Planner
has that identity; the independent source reviewer initially receives the native
task and authorized scene capture. Its first report requests the missing policy
ID, complete checkpoint SHA-256, repository revision and native instruction.

Planner supplies the actual fields through `context.respond`. Assignment
`ceb9711a` continues in the same independent Session and publishes version 2 as
completed. Planner explicitly accepts that report. The assessment concerns the
provided source identity and records its limits; it supplies no physical task
verdict.

A separate camera-comparison assignment `e261c34f` receives the original capture
and requests a subsequent native capture with timestamps and scene continuity.
The operator stops the task while that requested context remains unavailable.
The assignment retires with successful cleanup. The task retains its cancelled
outcome, and the Session closes with resources released. Its 141 original events
contain zero tool errors, zero policy jobs and zero formal Verifiers. Actual native
camera observation supplies the authorized evidence. No robot motion is requested.

The public reader loads the original persisted reports, sensor samples and
acknowledgements through the production communication and storage modules. It
compares those records with the ordered events, original model arguments and tool
receipts. Run it against a closed journal copy:

```sh
TSX_TSCONFIG_PATH=tsconfig.runtime.json node --import tsx \
  scripts/check-recorded-role-context.mjs \
  --run data/acceptance/run.json \
  --events data/acceptance/events.json \
  --journal data/acceptance/journal \
  --closed-session data/acceptance/closed.json \
  --checkpoint-verification data/acceptance/checkpoint-verified.json \
  --require-cancelled-pending --require-pre-motion \
  --output data/acceptance/role-context-audit.json
```

`--journal` names a directory containing the original `records.jsonl`; close its
writer before reading. `--output` must be a new file. The optional closed-Session
receipt requires `state=closed`, `resources=released` and this run as the last task.
The optional checkpoint inventory requires its exact digest and revision in the
actual context response and completed report, with the digest absent from the
initial review brief. The two required flags check pending-context cancellation
and the absence of policy requests, executions and formal verdicts respectively.

The actual reader passes against all 141 events and the production journal.
The original journal and its audit copy retain SHA-256
`ffe92e76d93f451ec060f22efaed753cb800dc2fa28ccc27476eb07f16e8b27e`
after reading and server closure. All owned console, policy and bridge processes
exit, and their listeners close. This acceptance covers the selected real Qwen
model, native camera provider and custom Team; additional configurations need
their own original histories.
