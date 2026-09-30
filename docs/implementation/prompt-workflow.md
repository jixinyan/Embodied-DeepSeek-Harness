# Role workflows and model-facing tool schemas

## Prompt composition

The [Planner workflow](../../harness/agent-runtime/agents/roles/planner/WORKFLOW.md)
and [Verifier workflow](../../harness/agent-runtime/agents/roles/verifier/WORKFLOW.md)
are shared operational instructions.
[FileTeamLoader](../../harness/agent-runtime/teams/src/loader.ts) selects them by
the Team's decision_owner and final_verifier bindings. Custom aliases and
simulation-specific roles receive the corresponding workflow. Other specialists
keep their configured instructions. Composition order is ROLE.md, deployment
context, member additions, then responsibility workflow. Workflow contents
contribute to the immutable Team source digest. Native DSH adds tools, explicit
assignment context and completion instructions.

The numbered sequence is observe/read context, commit plan and TODOs, select a
ready goal, start one job, yield for host follow-up, assess formal evidence, then
explicitly retry/replan/finish/abandon. Dependent transitions await successful
receipts. Retry preserves the environment and original criterion; each accepted
retry has a new attempt identity and budget.

## Prior project reference

Reviewed all six files in the original project's
[prompt directory](https://github.com/jixinyan/Embodied-Agent-Framework/tree/714e00ca83999da2df7221dcf205968adde5b441/src/eaf/agent/agents/prompts):
__init__.py, shared.py, top.py, manip.py, nav.py and verifier.py.
The source commit is 714e00ca83999da2df7221dcf205968adde5b441.

| Prior prompt mechanism | EDH behavior |
| --- | --- |
| Numbered scanning, planning, execution, checking and recovery | Shared responsibility-bound workflows across configured profiles |
| Observe prerequisites and inspect actual tool results | Planner inspects images, admitted capability and receipts before decisions |
| Ground objects and distinguish distance quantities | Preserve image/mask, camera frame, capture time, units and uncertainty with metrics |
| Atomic instructions and post-action observation | One supported checkpoint instruction; confirmed end supplies evidence for formal verification |
| Re-ground and adjust after repeated failure | Evidence-supported diagnosis and concrete changes, including continuation from observed budget-limited progress |
| Durable TODOs and progress notes | Native TODOs, versioned plans, private files and scoped evidence; SceneState remains deferred |
| Independent verification report | Fresh post-end Verifier checks the original criterion and submits retained facts |

EDH retains Planner-direct policy jobs, host-assigned formal verification and
ActionGate. Geometry thresholds and instruction capabilities come from the selected
deployment. Formal results follow admitted all/any criteria. Live Teams disable
experience generation; SKILL metadata and selected sections remain available on demand.

## Actual schema path

[Core definitions](../../harness/agent-runtime/tools/src/core-inputs.ts) supply
typed arguments, enums, per-parameter descriptions and tool descriptions. Every
implemented core tool requires a description. The application wraps parameters
with an object root, explicit required fields and additionalProperties=false.
Optional fields are team.query.beforeReportId, team.query.includeBodies and
skills.load.sections. Native todo_write retains its upstream whole-list schema.

planning.update.plan uses the dereferenced canonical PlanDocument schema.
agent.report.result uses the configured role output schema or a JSON object, plus
null. Both values are structured objects. Their dynamic schemas follow the same
native DSH registration and serialization path as other tools.

DSH supports type, properties, required, items, additionalProperties, enum, const,
oneOf and annotations. The [domain projection](../../apps/server/src/model-tool-schema.ts)
preserves supported structure and exposes numeric/string/array bounds in descriptions.
Full domain validation enforces the original canonical schema before effects.
The workflow documents the conditional done/last_verdict_ref requirement.

Descriptions include receipt fields and sequencing: native DSH projects tool name,
description and parameters to the model. Output schemas validate host-side values.

| Input | Receipt source |
| --- | --- |
| Plan identities and initial version | planning.read taskId, ownerAgentId, ownerAssignmentId and plan |
| Goal selection | Admitted plan row goal_id after successful plan-write receipt |
| Source camera | Capture/evidence receipt evidence.id and camera attachment id |
| Selected SAM mask | Segment receipt maskEvidenceId and instances[index].maskAttachmentId |
| Retry | planning.read.retry followed by accepted tasks.retry receipt |
| Formal result | verification.check facts: check_id, value, evidence_refs, optional reason; boundaryId |
| Done plan row | Current accepted verdict_id stored as last_verdict_ref |
| Delegated role | team.delegate assignmentId; explicit caller context and authorized evidenceRefs |

Geometry retains source identity and calibration. Empty masks, unknown checks and
metadata-only references provide no additional visual facts. Existing input limits,
evidence permissions, ownership checks, confirmed boundaries and version checks
remain enforced.

## Validation

Private evidence for the current real Qwen/Pi0.5 RoboTwin validation is stored under
.local/work/prompt-workflow-20260930/. The request recorder forwards to the existing
vLLM service and saves actual system prompts and serialized tool schemas. Source
journals establish outcome, retry ordering, independent Verifier identities,
controls, tool errors and release. Progress records the accepted run measurements
after this live validation completes.
