# Source CI dependencies

The [Source checks workflow](../../.github/workflows/source-checks.yml) uses the
recorded Ubuntu 24.04 environment with
Node.js 22.23.3, pnpm 11.19.0 and Python 3.11.17. Dependency installation uses
the frozen pnpm lockfile and CPU Python runtime constraints. The workflow's
JavaScript actions execute with their declared Node.js 24 action runtime;
project checks execute with the selected project Node.js version.

## Selected official stable releases

Reviewed on 2026-10-11. Each workflow action is bound to the exact commit returned
by its official repository for the selected stable release. Release notes and
complete `action.yml` input/output definitions were inspected.

| Action | Release | Commit | Declared runtime |
| --- | --- | --- | --- |
| Checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` | Node.js 24 |
| pnpm setup | [v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0) | `ea17c68df8912ef543352723c149a84f56e3d413` | Node.js 24 |
| Node.js setup | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | `949feb2413d6458794dcd2491c4babbbce0c15c1` | Node.js 24 |
| Python setup | [v7.0.0](https://github.com/actions/setup-python/releases/tag/v7.0.0) | `5fda3b95a4ea91299a34e894583c3862153e4b97` | Node.js 24 |
| Artifact upload | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | Node.js 24 |

Checkout reads the triggering source with credential persistence and source
cleanup disabled. Source permissions remain `contents: read`. No privileged
pull-request event or package publishing is configured.

Installation inspection reads actual pip reports and installed packages before
the complete source checks. Artifact upload requires the explicit installation
report and verified manifest paths. Missing files terminate the step. Hidden-path
admission is limited to those two named files inside `.local/work`.

## Production CPU runtime checks

After source and installation admission, the workflow runs four production
diagnostics using the installed project Node.js and isolated Python environment. Its actual
installation uses the `policy,robodojo,recording` extras, including the adapter's
msgpack, NumPy and psutil imports and PyAV 18.1.0 for recording resource checks.
CPU constraints bind msgpack 1.1.1 and psutil 7.2.2.
NumPy 2.4.6 is selected on Python 3.11 and 2.5.4 on Python >=3.12, matching the
official distribution requirements:
[NumPy 2.4.6](https://pypi.org/project/numpy/2.4.6/),
[NumPy 2.5.4](https://pypi.org/project/numpy/2.5.4/).
Native SDK environments retain their provider-specific constraints.

| Diagnostic | Exercised boundary | Cases |
| --- | --- | --- |
| `check-native-device-owner-offline.py` | Actual owner-thread file/pipe operations, cancelled and concurrent close, queued bind/stop/resume rejection | 6 |
| `check-native-session-owner-offline.py` | Shared device/recording closure, original file/publication errors and independent caller cancellation | 4 |
| `check-worker-transport-offline.mjs` | Actual Python Worker processes, dedicated response pipe, stdin closure, malformed/oversized JSON and disconnected output | 16 |
| `check-core-tools-offline.mjs` | Actual native DSH dispatch, private file admission/versions, cancelled writes, local question persistence and turn conclusion | 15 |

Each diagnostic records production-source hashes and confirmed resource outcomes.
The actual macOS and Ubuntu diagnostics pass all 26 cases without importing model
or simulator SDKs or allocating physical environments. Their source hashes match
the triggering repository revision. The workflow requires each named `acceptance.json` before
publishing its `cpu-runtime-<commit>` artifact; the artifact contains all four
diagnostic directories. Missing or unsuccessful checks terminate admission.

`check-cpu-runtime-evidence.py` reads the complete installation and runtime
artifacts and compares their source hashes to the triggering Git commit. It
requires the expected imports, complete CPU dependency provenance, all runtime
cases and released-owner/Worker outcomes. Source CI writes its `evidence.json`
only after this admission; runtime artifact upload includes that consolidated
report. The current `edh.cpu_runtime_evidence.v2` admission requires 41 cases,
six input manifests, the original agent-tools journal and 42 exact-commit source comparisons. The same command
verifies downloaded artifacts locally. Different-source,
optimized-Python and existing-output invocations terminate before publication.

Stable-action installation run
[`38160908873`](https://github.com/jixinyan/Embodied-DeepSeek-Harness/actions/runs/38160908873)
passes at `e3fef01` on Ubuntu 24.04.5, Node.js 22.23.3 and Python 3.11.17.
Independent artifact inspection matches its ten pip distributions, thirteen import
identities and twelve production/checker source comparisons. Its downloaded
installation report has SHA-256
`8a02f6ca6c6352c438e7abdbfd32b1d41eac6011bd42bfe8dccffc87eb160ce8`.

Complete installation/source/runtime run
[`38161986298`](https://github.com/jixinyan/Embodied-DeepSeek-Harness/actions/runs/38161986298)
passes at `50dd522` on the same selected CI platform. Its actual artifact contains
fourteen installed distributions, thirteen admitted production/dependency imports
and all 26 runtime cases. Independent artifact inspection verifies 28 source
comparisons against that exact Git revision and each complete installation record.
The installation-report SHA-256 is
`f1873b8492413b741e3e6d76997922f32744b10370f8ecbbbabad08fb26eee3a`.

Source-bound artifact admission also passes at `3accbb6` in
[`38162874886`](https://github.com/jixinyan/Embodied-DeepSeek-Harness/actions/runs/38162874886).
Its uploaded consolidated inspection independently matches all seven result
fields, five input digests and the inspector's actual Git source digest.
Four local admission processes are confirmed released. Complete source checks,
fresh installation and all 26 runtime cases pass with zero native allocations.

The [setup guide](../development/setup.md) documents the equivalent local
installation checks. The [configuration matrix](../implementation/supported-configurations.md)
records separate native configuration and task acceptance boundaries. Source CI
allocates no model, learned-policy network, simulator or GPU.
