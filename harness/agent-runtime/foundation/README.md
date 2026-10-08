# Runtime foundation

Shared plugin context, schema helpers, settings and protocol declarations used by
the selected DSH implementation. The native [scope primitive](src/dsh/scope/index.ts)
owns opaque registration identities, parent relationships, scoped event routing
and shared quiescent disposal. Agents, Sessions and tools use the same primitive
through their original `@deepseek-ai/dsh-scope` imports.
This module does not implement an agent loop,
physical policy or application. Source ownership and exact file hashes are in
[the import map](../../../docs/provenance/dsh-imports.json).

The Cordis, Cosmokit and Schemastery sources retain their upstream compiler
boundaries and MIT notices. Only the source import closure is included; the
upstream CLI, loader, coding profiles and console are not copied.
