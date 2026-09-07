# 0001 — EDH owns the repository and selectively absorbs DSH

Status: accepted by the user, 2026-09-07.

The repository is Embodied DeepSeek Harness. Keep intuitive, flat domain modules
under `packages/`, separate Python providers and first-party application entries.
Do not copy all of DSH and attach a physical plugin, and do not create a new loop.
Selected DSH implementations will become internal modules with provenance.

Bootstrap scope is interfaces, schemas, source mappings, role/tool/team examples,
SVG architecture and development scaffolding. DSH source migration and runtime
verification are Step 00; no functional step is completed by scaffolding alone.
All source workspaces are private. MIT is used for new scaffold code; preserve
applicable upstream attribution when importing code. No artifact is published to
a package registry and no simulator/model dependency is installed in bootstrap.

The repository spec is the implementation source of truth. The earlier Obsidian
copy is a design-history snapshot; maintain implementation changes here.
