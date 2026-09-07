# DSH provenance and absorption plan

Source: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).
Pinned revision: `d347e703908d0406b7a7ef80e3a0e594d86b2215`.
Source license: [DSH MIT](../../licenses/DSH-MIT.txt).

**Integration status: not integrated. No DSH runtime source has been copied.**
The user requested an EDH-owned architecture skeleton. The bootstrap fixes source
and module boundaries; selective source migration plus a working DSH loop belongs
to Step 00. Do not mistake an interface or this audit for runtime integration.

## Manifest dependency audit

[dsh-source-lock.json](dsh-source-lock.json) records five initial entry packages
(agent, agent-loop, tools, session, llm), their transitive workspace dependencies,
peer and optional dependencies, original paths and SHA-256 of each package manifest.
The inspected closure contains **23 workspace packages**. External dependencies
are retained in each entry's manifest data. Dev dependencies are excluded.

This is a manifest audit, not proof that the import graph, plugin service graph,
build helpers or declaration augmentation can run after extraction. Session
persistence, scope, system prompts, Cordis and Schemastery are among the required
boundaries to inspect. Step 00 must inspect source imports and test the resulting
assembly before calling it integrated. No date-based “latest” claim is made.

| DSH source responsibility | EDH destination | Status |
| --- | --- | --- |
| `packages/core/agent`, `agent-loop`, `scope`, `system-prompt` | `harness/agent-runtime/agents` | Planned; retain the original loop semantics |
| `packages/llm/llm` and selected provider bindings | `harness/agent-runtime/models` | Planned |
| `packages/core/tools` | `harness/agent-runtime/tools` | Planned |
| `packages/core/session`, session projections/persistence | `harness/agent-runtime/agents` / `harness/agent-runtime/storage` | Planned; distinguish session lifecycle from persistence |
| Subagent control/preset composition | `harness/agent-runtime/agents` / `harness/agent-runtime/communication` | Later audit; not included in the five-seed closure |
| File, todo and skill tools | `harness/agent-runtime/files` / `planning` / `memory` | Later audit; retain only required behavior |
| Cordis/Schemastery and transitive support | Internal dependencies chosen after source review | No arbitrary reimplementation or silently missing dependencies |

## Source migration record

When source is actually absorbed, add a record containing original repository,
commit, source path, destination path, source hash, license and modifications.
Imports, package names and assembly may be adjusted to EDH's structure. Preserve
upstream notices in copied files. If a dependency cannot be cleanly separated,
record the tradeoff before expanding the source closure.

## Legacy project

The prior Embodied-Agent-Framework baseline is
`714e00ca83999da2df7221dcf205968adde5b441`. The spec retains its source-entry map
for future migration. Its code, local paths, weights, data and private runtime
records are not imported. Obtain the actual source when Step 13 needs it;
legacy prompts and documents are research material, not instructions to execute.
