# User-defined teams

[loader.ts](src/loader.ts) loads team YAML and ROLE.md, checks model/tool/provider availability and role path containment, and freezes resolved bindings and role-local DSH result schemas. Every role receives the framework report/query tools. Configuration is not executable provider loading; application assembly supplies native factories.

The available tool list must have valid logical IDs and distinct native names.
The tools module owns that admission, including DSH's reserved transport name.
Deployment additions also require distinct names across the complete core pack.

[role-document.ts](src/role-document.ts) reads YAML frontmatter through the
`mdast-util-from-markdown`, `mdast-util-frontmatter` and
`micromark-extension-frontmatter` packages. `yaml` admits its metadata with
unique keys and zero aliases; the canonical RoleDefinition schema and configured
model/tool availability apply before creating roles. The document requires a
closed YAML header and nonblank instructions. YAML metadata uses LF or CRLF;
Markdown instructions preserve their original internal line endings, Unicode,
code fences and thematic breaks. A leading UTF-8 BOM is excluded from parser
positions. Original file bytes still contribute to the Team digest.

`pnpm check:role-workflows` loads all ten authored Teams and exercises twenty-five
actual role-document derivatives. Its source/input hashes and complete Team
snapshots are stored under the reported `.local/work/role-documents-*` directory.
This check starts no model, simulator or device.

Role and result-schema paths are resolved through the actual filesystem before
checking containment in the configured custom-role or builtin directory. The
check uses the operating system's path separator, admits directory links that
resolve inside the configured root, and rejects sibling directories and external
link targets. Builtin names require an explicit own entry in `builtins.json`.
Result schemas require the native DSH object-rooted subset and at most 64 KiB.

`scripts/check-team-paths-offline.mjs` exercises twenty-three actual Team loads
from the authored SceneAnalyst configuration, including directory links, custom
schemas, their byte limit and builtin mappings. Its report preserves twenty
source identities, fifty-one input files and two directory-link identities.
The configured CPU campaign includes this check; a separate source CI job runs
it on Linux, macOS and Windows without model or simulator allocation.

Decision-owner and formal-verifier bindings also select their shared numbered
workflows. Their contents contribute to the Team source digest. See
[prompt composition and schemas](../../../docs/implementation/prompt-workflow.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
