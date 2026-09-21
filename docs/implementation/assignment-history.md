# Retired assignment history

`AssignmentHistory` preserves completed role details in LocalStore. Active roles keep
their full `RunAssignment`; retired roles publish a compact run projection and expose
their details through an explicit read. This storage lifecycle uses the existing DSH
Session and TeamSessions lifecycle.

## Publication and identity

After native disposal and final audit publication, UpperRun releases evidence grants,
sets `retired` or `retirement_failed`, and calls `AssignmentHistory.retain`. The archive
contains the full InvocationBrief, model/tool binding, latest TODO and report, turn/step
metadata, last observation ID and latest stream frame when available. Zod validates
the envelope; the shared validator checks InvocationBrief and AgentReport. Task,
assignment, native Session and Team identities must agree.

The journal key is `assignment-history:` followed by the JSON array
`[runId, assignmentId]`. Its value has format `edh.assignment-history.v1` and must
retain journal record version 1. Repeated publication requires identical contents.
The writer reads the stored value back and compares it to the complete source before
releasing any resident payload.

The compact `RunAssignment` retains identity, member, status, model/tools, caller ID,
last observation ID, TODO count and turn/step/TODO sequence metadata. A formal
assignment also retains `verificationContextStored` when its check record was published.
`detailsStored`
marks the archive boundary. `brief`, report/TODO bodies, `agentSeen` and `agentStreams`
for that retired assignment leave the live projection. Other roles remain unchanged.

UpperRun configures `TeamSessions.readRetiredAssignment`. After the retirement event
succeeds, TeamSessions compares that durable brief with its original assignment and
releases the resident copy. `get` reads the archive for retired assignments and checks
Team identity. Duplicate assignment IDs remain rejected. Standalone TeamSessions hosts
without this optional reader retain their existing in-memory assignment history.

Archive publication and run-projection publication are separate journal writes. If
the archive succeeds and publishing the run fails, the previous persisted run still
has its inline details. Missing or conflicting published archives fail explicitly.
Failed archive publication leaves the original resident payload available and surfaces
the retirement error. Restart reads saved history; it does not resume a native role.

## Read API and console

```text
GET /api/runs/{runId}/assignments?assignment={assignmentId}
```

The reader requires one valid assignment query and membership in the stored run.
Archived status, model/tools, caller and last observation identity must match that
run's summary. Older inline assignments remain readable through the same route.
The response contains `runId`, `assignment`, `observation`, `stream`, `archived` and
`verification`.
Observation metadata resolves through the run-scoped SensorSamples catalog; missing
records fail, and restricted observations return HTTP 403. Image bytes retain their
existing scoped image route. Reading history grants no live role evidence permissions.

`verification` is null when no formal context exists and no published-context marker
requires one. Otherwise it contains the stored `context`, its referenced `observation`,
an accepted `verdict` or null, and a status:

| Status | Stored evidence |
| --- | --- |
| `awaiting_checks` | Context exists; no check facts or accepted verdict |
| `checked` | Check facts exist; no accepted verdict |
| `settled` | A matching formal verdict was accepted, including an `unknown` result |

The reader checks the complete assignment scope and evidence visibility. Accepted
verdicts must match the request, execution, stopped boundary, native role identity,
criteria identity/version, facts and evidence references. Multiple accepted verdicts,
missing published contexts and conflicting records fail explicitly. The compact
summary and immutable archive must agree on the context marker. These historical
reads perform no provider checks and grant no agent permissions.

The console's **Assignments** inspector and role cards load the selected details.
The historical sensor selector and TODO panel each retain only their currently selected
archive. Changing selections cancels the previous request and excludes stale results.
Loading, empty and failure states are explicit. Inspection renders stored text as text.
Formal verification details show execution, boundary, request, goal, attempt and
evidence identities, check values/reasons and the formal-result status. Switching
roles, loading another response or closing the inspector clears the previous details.
Refresh details explicitly reloads the selected record.
The Team graph uses the retained caller ID after the brief leaves the projection.

Retired report bodies are absent from ordinary run updates. **Role reports** continues
to expose all published versions, delivery status and acknowledgements through its
existing paged route. Native audits remain independently available.

## Acceptance and remaining limits

`pnpm test:assignment-history` runs nine actual file/HTTP/process checks. Coverage
includes exact preservation, detached reads, immutable archives, compaction/reopen,
write exclusion, invalid identity/scope, report inspection after archival, observation
references, malformed queries, conflicting run summaries, formal-context transitions,
an authored unknown-result document, missing/restricted evidence and verdict conflicts.
A child process archives
over 100 MiB of freshly read project documents under a 64 MiB V8 old-space limit;
the resulting run projection is below 2 MiB and retains no full brief.

`pnpm test:assignment-lifetime` runs ten native DSH/file checks, including verification
that retired lookups read their archive after native cleanup. Browser component DOM
acceptance uses actual stored project documents and the production HTTP reader,
console markup, API transport and selection controllers. No model or physical backend
executes in these checks.

Formal-verification browser checks use authored documents through the same production
reader and component. They cover waiting/checked/unknown displays, literal fact text,
ordinary-role clearing, missing-context errors, refresh, empty selection and close.

The console selection regression uses a real HTTP server and these stored documents
to check superseded-request cancellation, selected-result reuse, clearing and explicit
missing-assignment errors. `pnpm test:console` includes this check.

This bounds retained assignment payloads by live assignments and explicit readers.
Individual briefs or selected detail responses can still be large. Compact identity
rows, completion/retirement promises, journal key indexes, execution/verdict/request
arrays and disk history still grow with lifetime activity. Active model context,
whole-application memory, live VLM behavior and source-aware domain retention require
their own acceptance. Historical SensorSamples, image objects, reports and audits
remain preserved.
