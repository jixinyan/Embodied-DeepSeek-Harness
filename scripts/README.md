# Development checks

These scripts validate the repository skeleton, not framework runtime behavior.

- `generate-contracts.mjs`: generate TypeScript from the shared JSON Schema; `--check` detects drift.
- `check-contracts.mjs`: validate wire fixtures, role frontmatter, sample Team/tool references and selected malformed inputs.
- `check-structure.mjs`: check private package boundaries, declared imports, local documentation links, SVG policy and a guard against untranslated Chinese in public text.
- `check-python.mjs` / `.py`: compile and import Python Protocols without optional dependencies; parse SVG XML.

Run the aggregate `pnpm check` from the root. No actual provider registry or
configuration loader is exposed by these scripts.
