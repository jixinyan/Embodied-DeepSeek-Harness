# Cross-language contract acceptance

`wire-cases.json` contains shared bases and JSON-pointer patches for 77 shape/field
cases. `lifecycle-cases.json` contains 69 state/verdict/recovery cases using the same
pattern. Cases are synthetic; they do not represent an actual robot run or skill.

The TypeScript and Python suites consume these exact files. Expected acceptance,
rejection codes and booleans are fixture data, not generated from the implementation.
Wire validators never coerce or mutate inputs. Lifecycle tests also check nonmutation.
Invalid wire shapes throw; semantic gates return codes without advancing any state.

Run `pnpm test:contracts` after the root development setup. `generated-types.ts` is a
compile-time check, not a runtime substitute. Keep authoritative fields in the shared
schema and regenerate declarations. See the
[contract guide](../../docs/implementation/contracts.md) for API and integration limits.
