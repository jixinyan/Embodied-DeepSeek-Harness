# Python contract tests

`pnpm test:contracts` runs TypeScript and Python against the same synthetic corpus
in `tests/contracts/`. Python tests use `unittest` and the installed CPU dependencies.
No worker, simulator, policy or robot is executed; provider conformance comes later.
