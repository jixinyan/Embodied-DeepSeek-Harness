# Working on Embodied DeepSeek Harness

Read `docs/implementation/progress.md`, `docs/project-spec.md`, and
`docs/architecture/modules.md` before changing behavior. Continue the existing
checkout and first unfinished task. Current user instructions take precedence.
Explain design choices with concrete examples; ask the user when a material
requirement or deployment binding is unclear.

## Project boundaries

- EDH owns the repository. Absorb selected DSH source into its modules with
  provenance. Do not import the entire upstream repository or write a new loop.
- DSH-backed upper roles, tools, recovery, storage and a local console run with
  explicitly labeled CPU fixtures. HTTP model and WebSocket policy adapters plus
  standalone action admission are CPU-tested. Native RoboCasa reset, manual control
  through ActionGate and live VLM image/tool rounds are verified. The host worker
  bridge, learned-policy task acceptance and remaining physical providers are pending.
  Read progress for actual capability. Do not label a placeholder, mock or directory
  as a working physical provider or completed implementation step.
- Reuse DSH tool registration/dispatch/validation, sessions, inbox/followup, model
  adapters and cancellation. Do not build a parallel generic registry, dispatcher,
  message loop or model SDK. Read decision 0003 before adding a runtime abstraction.
- PhysicalBoundaryValidator is for EDH domain/provider wire checks, not mandatory
  middleware for ordinary DSH tools or messages.
- New delegations have independent contexts and explicit InvocationBriefs.
- Only the decision owner may retry/replan/resume; verifier may pause.
- Budget expiry requires formal verification. A stopped job is not success.
- Recovery SKILL publication requires original-goal formal success. Skills
  inform planning/verification, not low-level policy training or task criteria.
- Tools include planning, files, perception and active observation as well as
  execution. Actual physical resource effects determine scheduling.

## Public language

- All repository-facing content must be in English: documentation, example role
  prompts, configuration descriptions, diagrams/SVG text, comments and commit messages.
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

Read `docs/implementation/model-policy-adapters.md` for executable endpoint and
action-gate components. Real provider acceptance and the host-to-worker bridge are
pending. Do not replace native DSH model/tool behavior or bypass the action gate.
