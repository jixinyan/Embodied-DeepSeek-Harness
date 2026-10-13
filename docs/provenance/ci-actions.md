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

After source and installation admission, the workflow runs six production
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
| `check-core-tools-offline.mjs` | Actual native DSH core/extension dispatch, detached assignment bindings, private file admission/versions, cancelled writes, local question persistence and turn conclusion | 34 |
| `check-task-plans-offline.mjs` | Configured task goal/owner admission, persisted plan versions and actual journal compaction | 17 |
| `check-model-retry-offline.mjs` | Actual refused TCP connections, native retry chains, independent Sessions, cancellation/disposal and durable pending-history release | 20 |

Each diagnostic records production-source hashes and confirmed resource outcomes.
The actual Ubuntu diagnostics pass all 97 cases without importing model
or simulator SDKs or allocating physical environments. Their source hashes match
the triggering repository revision. The workflow requires each named `acceptance.json` before
publishing its `cpu-runtime-<commit>` artifact; the artifact contains all six
diagnostic directories. Missing or unsuccessful checks terminate admission.

`check-cpu-runtime-evidence.py` reads the complete installation and runtime
artifacts and compares their source hashes to the triggering Git commit. It
requires the expected imports, complete CPU dependency provenance, all runtime
cases and released-owner/Worker outcomes. Source CI writes its `evidence.json`
only after this admission; runtime artifact upload includes that consolidated
report. The current `edh.cpu_runtime_evidence.v5` admission requires 97 cases,
41 input digests, the original tool/plan/retry journals and 96 exact-commit
source comparisons. The same command
verifies downloaded artifacts locally. Different-source,
optimized-Python and existing-output invocations terminate before publication.

Actual source/installation/runtime run `38398570632` passes at `1c7a85d` on the
selected Ubuntu platform. Downloaded artifacts independently match fourteen
distributions, thirteen imports, 41 input digests and 96 exact-commit source
comparisons. Uploaded/local inspection matches all seven consolidated fields and
the checker identity. Seven task-plan journals preserve their bytes and release
writers. The original retry evidence preserves 338 events across 22 independent
Sessions, with 56 actual failed connections and zero provider responses. All native
allocations remain zero. Exact evidence is recorded in the
[CPU validation guide](../implementation/cpu-release-validation.md).

Source CI separately runs seven authored SKILL document/metadata tests and eight
authored model-request configuration tests. The latter checks the published model
files and protocol-specific option admission without model/provider allocation.
Its JUnit report is retained as `model-request-options.xml` in the same runtime
artifact. These authored checks have their own scope and are excluded from the
production diagnostic case count above.

Source CI also runs thirteen authored model-failure classification/cancellation
tests and preserves `model-failures.xml`. These checks exercise production
functions and native retry taxonomy without a provider response or model
allocation. Actual application HTTP error-reader checks belong to the configured
workspace diagnostic; loaded-provider failure/recovery acceptance remains separate.

Source CI also runs fifteen authored retry-configuration cases and preserves
`model-retry-configuration.xml`. These checks admit provider policy values and
detached route bindings before native registration.

## Native Team file admission matrix

A separate job runs the same FileTeamLoader diagnostic on Ubuntu 24.04, macOS 15
and Windows 2025, using Node.js 22.23.3 and pnpm 11.19.0. These stable runner labels
are listed in the official [runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
The job preserves Git source line endings with an explicit `core.autocrlf=false`
environment setting before checkout. The pinned actions above provide source,
package-manager/runtime setup and artifact publication.

Each actual filesystem runs twenty-three Role/schema cases and two native directory
links. Windows uses directory junctions; Linux/macOS use directory symlinks.
The diagnostic compares all twenty source hashes to the triggering commit before
creating inputs. Its artifact includes fifty-one raw input files, link identities
and admitted Team snapshots. Actual run `38398570632` passes all three jobs at
`1c7a85d`; independent downloaded-artifact readers match all source/input hashes,
twenty-three outcomes and six authored role snapshots per platform. The matrix
creates no Session, model, simulator or device. Its scope covers Team file admission;
complete product/platform acceptance retains the separate configuration matrix.

The [setup guide](../development/setup.md) documents the equivalent local
installation checks. The [configuration matrix](../implementation/supported-configurations.md)
records separate native configuration and task acceptance boundaries. Source CI
allocates no model, learned-policy network, simulator or GPU.
