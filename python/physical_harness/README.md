# Physical services

The Python package owns policy execution and environment/device/provider boundaries.
All exported adapters are `typing.Protocol` declarations. No RPC server, policy,
simulator, SAM model or hardware driver is included. The package imports using only
the Python standard library. Environment directories do not indicate support.

Optional local install: `python3 -m pip install -e python/physical_harness`
(from the repository root, preferably in a virtual environment).
The bootstrap check does not require installation: `pnpm check:python`.

Wire schemas are shared with TypeScript in `packages/contracts/schema/`.
Executable cross-language validation is deferred to implementation Step 01.
