# DSH source provenance

The manifest audit is retained in [dsh-source-lock.json](dsh-source-lock.json).
The actual selected source import graph is in [dsh-imports.json](dsh-imports.json).
They answer different questions: optional manifest peers are not necessarily runtime
requirements, and the pinned LLM source references attachment types absent from its
manifest dependency closure.

The source import map pins 128 files from 31 modules. It preserves the original
Agent loop, session, scope, model, tool and lifecycle implementations in EDH's
own domain directories. No upstream CLI, presets, Loader, console or full monorepo
is copied. Supporting settings, approval, code-runtime and attachment definitions
are included where imported; their providers are not implicitly activated.

`pnpm check:provenance` checks local source hashes, transitive imports, aliases and
licenses. To modify absorbed source, record the exact patch and update only its
local hash; preserve the original source hash and revision. Upstream module IDs
remain internal aliases, not a second workspace or runtime service.

The three foundation libraries generate local declarations using their upstream
compiler boundaries. Other code is checked with strict EDH settings. See
[third-party notices](../../THIRD_PARTY_NOTICES.md) for licenses and
[progress](../implementation/progress.md) for executed acceptance evidence.

The context-management import adds native compaction, optional tool-text pruning and
token estimation. Only embodied summary instructions differ from pinned behavior;
the source map records that patch and both hashes. Retry/command identity types do
not mount their optional services. See [context management](../implementation/context-management.md).

Image storage imports six attachment-local functions/modules from the same pinned
revision. Filename sanitization preserves printable names; cached request-image reads
fully decode and propagate invalid-cache errors. Both patches retain source and local
hashes. EDH's LocalImageStore mounts the native attachment service with explicit storage,
resource limits and disposal. See the [image provider guide](../implementation/image-storage.md).

Native event residency patches Session, SurfaceManager and SessionProjectionRegistry.
Session releases verified published bodies through an identity-bound archive reader;
surface and projection folds retain absolute sequences and read individual archived
events. The model loop, tool dispatcher and fold rules remain native. All three patches
record original and local hashes. See [semantics and checks](../implementation/session-history.md).
