# Python contract and policy tests

`pnpm test:contracts` checks the shared TypeScript/Python corpus. With the `policy`
extra installed, `test_policy.py` also runs real localhost WebSocket inference and
CPU-device action admission: seventeen tests cover budgets, stale results, pause,
resume races, lost acknowledgements, transport bounds and cleanup.

No learned policy, simulator or robot is evaluated. CI installs the extra; socket
tests are explicitly skipped when it is absent. See the
[adapter guide](../../../docs/implementation/model-policy-adapters.md).
