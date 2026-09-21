# SKILL source inspection

The workspace experience API returns each retained SKILL bundle with explicit source
references. The server resolves ownership through the saved recovery's `runId`, then
the run-to-user-session record when present. Run `skillIds` indexes are not required
for source resolution. A standalone task has no user-session association.

`apps/server/src/skill-provenance.ts` composes the existing domain store, recovery
history, sensor catalog and shared validators. It creates no agent session and
changes no stored records or evidence permissions.

## API and inspector

`GET /api/skills` returns `{ skills: [...] }`, preserving each bundle's `metadata`
and `markdown`. Each item also includes `runId`, `userSessionId` and `provenance`.
The console's Experience library inspector exposes these fields with the bundle.
The API returns the latest 100 inserted bundles in insertion order. The scan holds
at most 100 bundles, and source resolution reads only their referenced records.
It does not scan every run or materialize recovery-event history.

| Provenance field | Meaning |
| --- | --- |
| `skillId`, `recoveryId`, `goalId` | Experience identity and original recovery goal |
| `runId`, `userSessionId` | Explicit recorded ownership; unresolved identities are null |
| `failedVerdictId`, `successfulVerdictId` | Original failure and accepted recovery result |
| `state` | `available` or `incomplete` for the inspected source records |
| `storeSequence` | Journal sequence observed for this synchronous read |
| `records` | Direct source keys and their current versions; absent versions are null |
| `evidence` | Evidence identities and their associated image identities |
| `images` | Distinct image identities with referring evidence identities |
| `missing` | Missing-reference diagnostics, including legacy recovery ownership gaps |

An `available` result means the inspected metadata and relationships are present and
consistent. It does not certify image file contents, the full event history, physical
task success independently of stored verdicts, or transfer performance. Image bytes
are validated by the image service when read. Source inspection only checks their
persisted attachment metadata through SensorSamples.

An `incomplete` result preserves known identities and reports absent recovery, run,
configuration, session, session-task membership or sensor-sample records. A legacy recovery without explicit
run ownership remains incomplete. Existing malformed or conflicting records fail
the request. A sensor sample whose required attachment metadata is absent or
inconsistent also fails through the sensor catalog's integrity checks.

## Validated relationships

- The stored SKILL key agrees with its contract-validated metadata identity.
- Recovery retains an original failed verdict and a passed verdict for the same
  run, original goal and goal-contract version, with distinct attempts and verdicts.
- The passed verdict identifies this recovery and the SKILL's accepted verdict.
- SKILL evidence references exactly match the unique union of failure and success
  evidence references.
- The source run has the same origin and retains both exact accepted verdicts.
  Compact entries resolve through [immutable verdict archives](verdict-history.md).
  Their keys/versions appear in `records`; absent archives make the source incomplete,
  and rewritten records or conflicting summaries fail.
- A recorded user-session association points to a session that owns this run through
  its compact history and immutable membership record, or a legacy inline task list.
  Compact membership must fall within the published admission count and agree with
  the latest-task identity when it occupies the final position. Its key/version is
  included in `records`.
- Referenced sensor samples belong to the source run, preserve its origin and are
  agent-visible. SensorSamples validates immutable sample and attachment metadata.

The inspector records the source configuration's presence and version. Deployment
validation remains responsible for configuration semantics and compatibility.
No inferred ownership is assigned from unrelated runs.

## Experience scope and retention

New SKILL metadata describes its actual declared source: test fixture, simulation
or hardware. Simulation/hardware guidance records that transfer to other environments,
embodiments or policies has not been validated. Existing immutable bundles retain
their recorded metadata.

Planner and Verifier still use `skills.search` for metadata and `skills.load` for
selected bodies. Console inspection does not add content to agent contexts. Source
references grant no access to another assignment's evidence. See the
[memory guide](../../harness/agent-runtime/memory/README.md).

These references identify dependencies for future retention policy. `records` is
not an exhaustive list of every event, audit, assignment file or extension-owned
record in the source task. This endpoint authorizes no deletion. Domain retention
must preserve referenced task/recovery evidence and account for other owners before
collecting source records or original image objects. Cross-session references remain
valid after journal compaction.

## Acceptance

Run `pnpm test:skill-provenance`. Tests use authored metadata documents, the actual
repository PNG, real LocalStore and image files, and a local HTTP server invoking
the production reader and request-origin check. They cover explicit ownership,
shared image references, detached reads, compaction/reopen, missing references,
legacy ownership, inconsistent records, exact source verdicts, mismatched SKILL
identities, the latest-100 window, HTTP origin restrictions and source limitations.
Archived-result checks also cover exact source references, absent archives, summary
conflicts and rewritten archive versions.

No model, sensor, simulation or hardware executes in these tests. Live recovery
publication and complete application integration with a provider remain separate
acceptance requirements.
