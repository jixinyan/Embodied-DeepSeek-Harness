# Working on Embodied DeepSeek Harness

Read `docs/implementation/progress.md`, `docs/project-spec.md`, and
`docs/architecture/modules.md` before changing behavior. Continue the existing
checkout and first unfinished task. Current user instructions take precedence.
Explain design choices with concrete examples; ask the user when a material
requirement or deployment binding is unclear.

## Project boundaries

- EDH owns the repository. Absorb selected DSH source into its modules with
  provenance. Do not import the entire upstream repository or write a new loop.
- Native Qwen/Pi0.5 RoboTwin task success and retained-scene retry pass with fresh
  formal Verifiers, actual action receipts, native videos and released resources.
  Native Qwen/Pi0.5 RoboDojo zero-tool-error retry and task success pass. Its same-
  Session terminal task passes independent zero-action verification and releases
  resources. Clean custom-role RoboTwin source/action/video acceptance also passes.
  Native Qwen/GR00T RoboCasa CloseDrawer succeeds with fresh formal verification,
  completed plan/TODOs, source-bound action/video evidence and released resources.
  BEHAVIOR preserves unsuccessful task outcomes with actual controls.
  Native perception, active observation, transport and confirmed stop checks have
  separate evidence. Default deployment factories and maintenance bindings require
  their complete product acceptance. Evolver development is paused and SceneState
  implementation is deferred under current user instructions.
  Read progress for actual capability. Do not label a placeholder, mock or directory
  as a working physical provider or completed implementation step.
- Reuse DSH tool registration/dispatch/validation, sessions, inbox/followup, model
  adapters and cancellation. Do not build a parallel generic registry, dispatcher,
  message loop or model SDK. Read decision 0003 before adding a runtime abstraction.
- PhysicalBoundaryValidator is for EDH domain/provider wire checks, not mandatory
  middleware for ordinary DSH tools or messages.
- New delegations have independent contexts and explicit InvocationBriefs.
- Planner directly starts policy jobs with `execution.start`; there is no separate
  Executor agent in the default workflow.
- Only the decision owner may retry/replan/resume. A confirmed ordinary pause stays
  with Planner and does not start formal verification.
- Running frames and status may reach Planner and operator audit, but do not create
  or update a Verifier assignment.
- A fresh Verifier starts only after an eligible `ended` execution
  (`policy_stop`, `planner_stop`, `episode_terminated`, or `budget_exhausted`) with a confirmed
  device boundary. Budget expiry requires formal verification. Cancellation and
  backend failure remain failed or unknown; a stopped job is not success.
- Native `execution.end` requests Planner-owned terminal review, followed by fresh
  independent verification. It preserves existing terminal outcomes and ordinary
  pause/resume semantics; actual native acceptance remains required.
- Recovery SKILL publication requires original-goal formal success. Skills
  inform planning/verification, not low-level policy training or task criteria.
- Tools include planning, files, perception and active observation as well as
  execution. Actual physical resource effects determine scheduling.

## Public language

- Documentation, example role prompts, configuration descriptions, diagrams/SVG
  text, user-facing messages and commit messages must be in English.
- Code comments use Chinese with English technical terms. Identifiers retain
  their English names.
- Internal conversation with the user may be in Chinese. Do not copy untranslated
  discussion notes into the repository. Translate diagrams and inspect their layout.

## Structure and checks

- Use intuitive modules under `harness/agent-runtime/`, physical providers under
  `harness/physical-runtime/`, and shared contracts under `harness/contracts/`.
- Wire schema source: `harness/contracts/schema/physical.schema.json`.
  Regenerate TypeScript with `pnpm generate:contracts`; never hand-edit generated types.
- Runtime/semantic validation is separate from scaffold schema checks.
- All packages are private source workspaces in bootstrap, not published builds.
- Run checks appropriate to changes; baseline is `pnpm check`.
- Keep diagrams in SVG. Add useful module docs, not empty directory collections.
- Document accepted architecture changes and update progress with exact checks,
  unimplemented areas and the next action. Never claim simulation/hardware results
  from synthetic fixtures. Do not add models, datasets, secrets or local run data.
- Keep source licenses and provenance mappings when DSH code is imported.

## Version control

- Commit frequently at coherent, verified checkpoints; do not wait until an entire
  implementation step is finished. For example, schema changes and their fixtures
  can be one commit, followed by a separate loader implementation commit.
- Inspect the diff and run checks appropriate to the change before committing.
  Stage only the intended files; preserve unrelated user changes.
- Use descriptive commit messages explaining the concrete change. Record known
  incomplete work explicitly rather than describing it as finished.
- Push completed checkpoints at phase delivery or handoff and report the commit
  and any remaining local changes. Commit frequency does not imply a push per edit.
- Preserve published history; do not force-push, reset away work or rewrite existing
  commits without explicit authorization. Keep secrets and runtime data out of Git.

## Adapter integration checkpoint

On `jd_B300`, current EDH work may use at most one physical GPU, selected from
GPUs 2–4. Co-locate model, policy, CUDA and graphics rendering on that selected
device, confirm actual process placement and preserve unrelated workloads.
Device selection remains deployment-specific; framework code must support
other GPUs through configuration.

Read `docs/implementation/model-policy-adapters.md` for executable endpoint and
action-gate components. Native worker transport has partial real acceptance;
GR00T controls pass and complete provider workflows remain pending. Do not replace native
DSH model/tool behavior or bypass the action gate.
