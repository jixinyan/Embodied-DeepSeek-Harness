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

Decision-owner and formal-verifier bindings also select their shared numbered
workflows. Their contents contribute to the Team source digest. See
[prompt composition and schemas](../../../docs/implementation/prompt-workflow.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
