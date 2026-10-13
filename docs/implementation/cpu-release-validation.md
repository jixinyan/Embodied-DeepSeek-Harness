# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).
The base Python package includes Pillow for PNG observation encoding; WebSocket
inference and original-journal inspection use the `policy` and `diagnostics` extras.

## Current CPU checkpoints

| Scope | Exact source and verified result |
| --- | --- |
| Policy initialization ownership | `1c632ba` on macOS and isolated Linux: 62 matching policy startup/reservation cases, three matching actual Console startup cases, 29 exact-commit files, fifteen captured Console source/input files and released runners; complete source checks pass without allocation |
| Native environment construction | `5e737fd` on macOS and isolated Linux: 23 matching actual factory checks, nine exact-commit sources, eighteen raw inputs and two independent uninitialized RoboDojo adapters per platform; complete source checks pass with no allocation |
| Team file admission | `1c7a85d` on local macOS and CI Linux/macOS/Windows: 23 actual authored-Team load checks per platform, 20 source identities, 51 input files, two native directory links and six complete authored role snapshots; independent artifact inspection passes without allocation |
| Role document admission | `0818111` on macOS and isolated Linux: all ten complete Team snapshots match the captured checkpoint and each other; 25 actual FileTeamLoader document cases verify ten source identities and fifty derivative files per platform without allocation |
| Configured production campaign | `1c632ba`: 45 components, 1,623 cases, 1,030 independently inspected source/input/link comparisons, 196 exact-commit production/checker/package files and 45 released diagnostic process groups |
| Packaged Desktop | macOS `887d707` and Linux `86c612a`: identical ten-file ASAR contents and diagnostic source, twenty-four profile selections, six service cycles, application restart and Console reuse/reload/reopening |
| Latest Ubuntu source/installation CI | `1c632ba`, run `38415631866`: 97 production runtime cases, fourteen distributions, fourteen imports, 41 input identities and 99 independently checked exact-commit source comparisons |
| Configured package entry ownership | `0818111` on macOS and isolated Linux: actual `pnpm start` and `pnpm demo`, nineteen source/input identities per platform, compatible native profiles, empty Sessions and idle provider services; both process groups, listeners and journal writers release |
| Trusted extension factory assembly | `f7d27e1` on macOS, isolated Linux and Ubuntu CI: twenty exact-source identities, fifteen core cases, nineteen extension cases and ten matching native outcomes per platform; private journals preserve committed file contents and release writers |
| Native tool names and extension admission | `0a341d6` on macOS and isolated Linux: 47 helper/Team-loader cases, ten authored Teams, 28 original-configuration cases, seven native scope/dispatch checks and fifteen core tool cases; original inputs and canonical server changes remain unchanged |
| Installed policy processors | Linux `5b26a5a`: 46 original requests, 72 CPU cases, 418 independently checked input/checkpoint/SDK/source comparisons and 282 exact prepared tensor/codec metadata fields; fifteen loaded sources match `1c632ba` without processor reruns |
| Native Console port admission | `88f1099` on macOS and isolated Linux: 81 cases and 81 independently repeated reads per platform, 66 declared JSON derivatives and 15 source identities; all outcomes match, original bindings remain unchanged and the server checkout is preserved |
| GPT profile configuration | `b69d927`: 60 declared original-profile derivatives cover modes, demonstration metadata, gateway ports and worker endpoints; 46 reject and 14 admit with unchanged original bindings |
| Selected GPT file preparation | `8c75a65` on macOS and isolated Linux: 33 cases and 28 independently repeated file checks per platform, 22 source identities, 31 declared configuration derivatives and 15 stored-image fields; eleven macOS and ten Linux production files match the commit, and actual Console process/listener/writer ownership releases |
| Persistent native retries | The latest downloaded CI journals preserve 22 independent native Sessions, 56 genuine failed connections and 338 source-matched event bodies; pending-history release and cancellation retain their declared scope |

Every checkpoint excludes model inference, loaded-policy execution,
simulator allocation and new physical task acceptance. The
[release requirements](progress.md#remaining-release-requirements) identify the
native workflows that still require their actual model/policy/simulator runs.

## Native environment construction

`environments/factory.py` owns native provider selection and adapter construction.
NativeWorkerSession calls it after existing configuration admission and before
the original NativeActionDevice owner-thread reset/description flow. Selected SDK
imports, source-root checks, constructor parameters, RoboTwin working-directory
selection and BEHAVIOR process ownership retain their original behavior.

The [factory diagnostic](../../scripts/check-native-environment-factory-offline.py)
passes twenty-three CPU checks using an original Worker configuration. It admits
actual file/directory failures before provider imports and constructs two actual
uninitialized RoboDojo adapters. Those instances preserve independent local state,
reject observation and episode-status calls before reset, and close repeatedly.
The report retains ten source identities and eighteen input-file identities.
Working directory, child-process identities and file-descriptor counts remain
unchanged. No RPC reset, SDK provider, model, simulator or device allocates.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-native-environment-factory-offline.py \
  --config /absolute/path/actual-deployment.json \
  --output .local/work/environment-factory-check
```

The configured CPU campaign includes this check using its original
`workerConfiguration` input. Worker transport/client/host and Session-owner reports
capture the factory source as part of their executed implementation. Local evidence:
`.local/work/environment-factory-cpu-20261013-02/acceptance.json`.
A standard Python AST inspection independently matches four original provider
branches, 34 initialization-prefix statements, seven initialization-suffix statements
and all forty remaining NativeWorkerSession class members against `b6ecc22`.
Evidence: `.local/work/environment-factory-source-preservation-20261013.json`.
Loaded native provider behavior retains its separate acceptance requirements.

Isolated Linux at `5e737fd` passes the same twenty-three outcomes and complete
source checks using the unchanged original Worker file. Independent downloaded-
file inspection verifies nine exact-commit sources, eighteen raw input identities,
matching macOS/Linux outcomes and two independent constructor instances per
platform. The runner releases, isolated source remains clean and canonical server
status and tracked-change bytes remain unchanged. Evidence:
`.local/work/environment-factory-platforms-independent-20261013.json` and
`.local/work/environment-factory-linux-receipt-20261013-02/`.

The complete configured campaign passes at `5e737fd` with forty-five components
and 1,607 cases. Independent inspection verifies 1,025 source/input/link comparisons,
195 distinct committed production/checker/package files and all forty-five released
diagnostic groups. Three campaign interruption cases confirm drained source checks,
released runners and absence of the next component and final acceptance. Evidence:
`.local/work/environment-factory-foundation-cpu-20261013/independently-verified.json`,
`.local/work/environment-factory-foundation-cpu-20261013/committed-source-verification.json`
and `.local/work/environment-factory-cpu-shutdown-20261013/acceptance.json`.
Source CI `38403998420` additionally passes 97 production runtime cases and the
Linux/macOS/Windows Team matrix. Independently downloaded artifacts match fourteen
distributions, thirteen imports, 41 input identities and 98 exact-source comparisons,
including the factory sources now retained by Worker and Session diagnostics.
Evidence: `.local/work/ci-environment-factory-runtime-inspection-20261013.json` and
`.local/work/ci-environment-factory-consolidated-independent-20261013.json`.

## Team file admission

`scripts/check-team-paths-offline.mjs` calls the production FileTeamLoader with
the authored RoboTwin SceneAnalyst Team and declared Role/schema derivatives.
Twenty-three cases exercise actual files and native directory links: custom-role
and builtin containment, internal/nested schema references, external and sibling
targets, explicit builtin mappings, a 64 KiB schema boundary, malformed JSON and
the original native DSH object-rooted schema admission. Windows uses actual
directory junctions; POSIX platforms use actual directory symlinks. The report
retains twenty source hashes, fifty-one input-file hashes, two link identities
and complete admitted Team snapshots. Repeated reads preserve source digests and
the authored role instructions, models, tools and workflows.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-team-paths-offline.mjs \
  --output .local/work/team-file-admission
```

Use a new output directory under `.local/work`. Optional `--source-revision HEAD`
also requires every recorded source to match the selected commit's original bytes
before creating diagnostic inputs. The configured CPU campaign includes the same
diagnostic. A separate source CI matrix runs it on Ubuntu 24.04, macOS 15 and
Windows 2025 with unchanged Git checkout line endings and pinned Node.js/pnpm.
Its artifacts preserve the actual input files alongside their report. No Session,
model, simulator or device is created by this check.

Source `1c7a85d` passes on local macOS and all three native CI platforms in run
`38398570632`. Independent downloaded-artifact readers verify twenty source hashes,
fifty-one input-file hashes, twenty-three outcomes and six complete admitted role
snapshots per platform. Evidence: `.local/work/team-paths-independent-20261013.json`
and `.local/work/ci-team-paths-{ubuntu,macos,windows}-inspection-20261013.json`.

## Native model-request retries

`scripts/check-model-retry-offline.mjs` starts the production native DSH host
and configured Chat Completions/Responses adapters against a closed local TCP
port. Genuine connection failures drive the original `llm-retry` plugin.
Twenty checks retain 22 native journals and 56 failed request attempts,
with zero provider responses or tool/physical execution. They cover bounded and
disabled retries, concurrent independent Sessions, retry reset on a later turn,
fractional backoff, actual native jitter, user cancellation, host disposal,
explicit always-mode cancellation and loaded
Team trace. Real 15-second retry waits release within the diagnostic's three-second
bound when cancellation/disposal occurs. Retry/start events match their original
Session sequences and retain distinct chains across Sessions/turns.

The production SessionHistory/SessionAudits path persists 338 immutable event
bodies. Eight cases release historical bodies during a real pending wait. Native
retry continuation and cancellation preserve their projections after release.
The shared audit admission in `apps/server/src/native-audit-payloads.ts` keeps the
original finite millisecond values and native normal/always budget shape. Both
record and image retention use it. Eighteen invalid derivatives reject. Reopened
production LocalStore readers independently compare every event with its original
native snapshot, derive the native replay projection and release their writers.
The source journal hash remains unchanged. These checks provide no model response
and resume no agent workflow.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-model-retry-offline.mjs \
  --output .local/work/model-retry-check
pnpm exec tsx --tsconfig tsconfig.runtime.json --test \
  tests/runtime/model-retry-configuration.test.ts
```

Fifteen authored configuration cases verify native policy defaults, route capture,
input independence, disabled/always settings and invalid fields/counts/codes/backoff.
They perform no HTTP request. An independent TypeScript printer comparison of the
local retry executor with pinned DSH revision
`d347e703908d0406b7a7ef80e3a0e594d86b2215` confirms identical executable source;
only comments differ. The import map retains both source hashes.

The complete CPU campaign includes `model-retry`. Source CI retains its journals,
both Team traces, the actual history journal and separate `model-retry-configuration.xml`. Consolidated v5
artifact admission verifies every retry case, failure stream, journal digest,
Team correlation, history digests and exact-commit source. Actual cloud/vLLM successful recovery
and provider-specific retry timing require their native acceptance checks.

The complete current-source CPU campaign passes 37 components and 1,185 cases.
Independent inspection verifies 633 source/input comparisons, unchanged original
journals/images and 37 absent diagnostic process groups. Original Responses/output
and image-context checks retain their recorded acceptance boundaries. No model,
simulator or GPU allocates. Evidence:
`.local/work/model-retry-history-cpu-campaign-20261012/independently-verified.json`.
Independent history inspection verifies 35 current source identities, 22 native
Sessions, all 338 durable event bodies, eight pending-wait archives, fractional
delays, source preservation and released writers. Evidence:
`.local/work/model-retry-history-cpu-campaign-20261012/model-retry/independently-verified.json`.

Source `4978102` matches 144 distinct captured production/checker files against
the exact Git commit. Actual Ubuntu CI `38293337371` passes fresh installation,
complete source checks, seven SKILL tests, eight model request-option tests,
thirteen failure tests, fifteen retry-configuration tests and its separate
78-case production runtime suite. Independent downloaded-artifact admission
verifies fourteen distributions, thirteen imports, 41 input digests and
88 exact-commit source comparisons. Independent production readers additionally
verify all 338 downloaded native event bodies, exact fractional delays and replay
projections with unchanged history and released writers. Native retry streams,
journals and Team traces retain their original identities. Seven plan journals remain unchanged and
release writers; all three JUnit reports contain the expected cases with zero
failures/skips. Configuration/test/workflow sources independently match the
same revision. No model, simulator or GPU allocates.

Evidence: `.local/work/model-retry-history-cpu-campaign-20261012/committed-source-verification.json`,
`.local/work/ci-model-retry-history-inspection-20261012.json`,
`.local/work/ci-model-retry-history-independently-verified-20261012.json`,
`.local/work/ci-model-retry-history-native-independently-verified-20261012.json`,
`.local/work/ci-model-retry-history-configuration-independently-verified-20261012.json`,
`.local/work/ci-model-retry-history-failures-independently-verified-20261012.json` and
`.local/work/ci-model-retry-history-options-independently-verified-20261012.json`.

Evidence: `.local/work/model-retry-cpu-campaign-20261012/model-retry/acceptance.json`,
`.local/work/model-retry-configuration-20261011.xml` and
`.local/work/model-retry-source-independently-verified-20261011.json`.

## Model failure admission

`models/src/model-failures.ts` supplies the common HTTP boundary for cloud
Responses and local/cloud Chat Completions. A JSON error body is read only for
400/413/429 and within the configured response limit, capped at 64 KiB. Exact
`context_length_exceeded` on 400/413 becomes DSH `CONTEXT_WINDOW_EXCEEDED`.
Authentication status remains authoritative. Quota codes/types on 429 become
terminal `QUOTA`; other 429 responses become `RATE_LIMIT`, 5xx becomes `SERVER`
and 408 becomes `TIMEOUT`. Positive provider retry timing and request IDs are
retained without error prose. Responses `error` and `response.failed` events
retain the same structured classifications. Native DSH extensions own recovery.

Thirteen authored tests check classification, status admission, native retry
taxonomy, timing, input preservation and cancellation before metadata access.
They supply scalar/object inputs to production functions, provide no model
response and perform no provider request. Source CI saves the separate JUnit
report as `model-failures.xml`; these tests do not contribute to the production
diagnostic case count.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json --test \
  tests/runtime/model-failures.test.ts
```

The configured production HTTP workspace separately checks two actual rejected
Session requests (400) through the shared reader, including a one-byte bound,
and an actual cross-origin rejection (403). Error readers release, no Session is
created, all four providers/services remain unallocated, and the writer/listener
release. These are application HTTP errors, with no provider error envelope or
model result. Loaded-provider errors, live failure SSE and successful overflow
recovery retain their actual-model acceptance requirements.

Evidence: `.local/work/model-failures-20261011.xml` and
`.local/work/model-failure-readiness-20261011/readiness.json`.

The complete current-source CPU campaign passes 36 components and 1,165 cases.
Independent inspection checks 574 source/input comparisons, the unchanged
original journals/images and 36 absent diagnostic process groups. Original
Responses/output and complete image-context admission retain their documented
scopes. All model/provider/simulator/GPU allocations remain zero. Evidence:
`.local/work/model-failures-cpu-campaign-20261011/independently-verified.json`.

Source `f6a890a` additionally matches 116 distinct production/checker files
against the exact Git commit. Actual Ubuntu CI `38185797204` passes complete
source/fresh-installation checks, seven SKILL tests, eight model-configuration
tests, thirteen model-failure tests and its separate 58-case production runtime
suite. Independent downloaded-artifact inspection verifies fourteen installed
distributions, thirteen imports, fifteen input digests and 53 exact-commit source
comparisons. Seven plan journals remain unchanged and release writers.
Both actual JUnit reports contain every expected case with zero failures/skips;
their configuration/test/workflow sources independently match the revision.

Evidence: `.local/work/model-failures-cpu-campaign-20261011/committed-source-verification.json`,
`.local/work/model-failures-independently-verified-20261011.json`,
`.local/work/ci-model-failures-inspection-20261011.json`,
`.local/work/ci-model-failures-independently-verified-20261011.json`,
`.local/work/ci-model-failures-junit-independently-verified-20261011.json` and
`.local/work/ci-model-failures-options-independently-verified-20261011.json`.

## Protocol-specific model request options

`models/src/configuration.ts` admits request settings for the selected protocol
during configuration reading. Nondefault Chat Completions role, token field,
reasoning replay, strict-tool, tool-choice and extension settings require that
protocol. Responses retains its native instructions/output-token mapping and
output replay. The published cloud API, local vLLM, Qwen and Astra model files
retain their declared bindings. Eight authored configuration tests pass locally
and in actual Ubuntu CI; they exercise configuration admission without provider
requests or model/simulator/GPU allocation.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json --test \
  tests/runtime/model-request-options.test.ts
```

Current source `620d507` passes the complete 36-component/1,165-case CPU campaign.
Independent inspection confirms 570 source/input comparisons, 115 distinct
production/checker files against Git, original journal/image identities and
36 absent diagnostic process groups. Actual four-provider HTTP metadata retains
the configured Teams/checkpoints/models, idle services and released resources.
The original-image/Responses diagnostics retain their recorded scopes above.

Actual Ubuntu CI `38183379841` passes fresh installation, complete source checks,
seven SKILL tests, eight protocol-configuration tests and its separate 58-case
production runtime suite. Downloaded artifacts independently verify fourteen
distributions, thirteen imports, fifteen input digests and 53 exact-commit source
comparisons. Consolidated/checker identities agree and seven task-plan journals
remain unchanged with released writers. The actual JUnit report contains all
eight configuration cases with zero failures/skips; configuration/test/workflow
and four model-file sources independently match the selected Git revision.

Evidence: `.local/work/model-options-cpu-campaign-20261011/independently-verified.json`,
`.local/work/model-options-cpu-campaign-20261011/committed-source-verification.json`,
`.local/work/ci-model-options-inspection-20261011.json`,
`.local/work/ci-model-options-independently-verified-20261011.json` and
`.local/work/ci-model-request-options-independently-verified-20261011.json`.

## Model image request admission

`models/src/model-images.ts` admits the shared cloud/local adapter image boundary
with the native DSH attachment types. Intrinsic ID, format, byte length and dimensions
must agree with the requested reference. Display names and original-dimension
annotations retain their native alias semantics. Request metadata requires a
nonempty variant ID, supported format, positive safe dimensions/byte length,
actual Uint8Array bytes, `uchar` depth, `srgb` color space and a Boolean alpha flag.
The declared request length must equal the encoded data length. Metadata and
image bytes are detached from the resolver, including shared-memory data.
The native attachment service owns decoding, compression and byte provenance.

`models/src/responses-input.ts` converts existing DSH messages and retains
function-call/result identities, text and ordered images. Each unique image is
resolved once; every represented occurrence counts toward the image count and
base64 byte budget. The final complete JSON request has its existing byte limit.
Chat Completions retains native DSH image serialization and offloading. Both
adapters check cancellation after credential/image resolution and before HTTP,
preserve the caller's cancellation reason and reject empty configured credentials.

`check-recorded-model-images.mjs` copies an original journal and admits six original
RoboTwin PNGs through actual LocalImageStore decoding/storage. Two complete recorded
Qwen contexts contain fifteen image occurrences; original messages, call/result IDs,
native Chat Completions serialization and Responses image order remain unchanged.
All 67 checks pass, including real native request compression, exact byte limits,
duplicate-reference identity, metadata/data mutations, shared-memory isolation,
represented-image limits and cancellation before/after actual image reads.
The diagnostic also checks both production adapters' request preparation and
public invalid-request streams. Its connection-audit socket supplies no response
and observes zero connections. No provider/model/simulator/GPU allocates.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-model-images.mjs \
  --data-directory .local/work/<original-journal> \
  --images-directory .local/work/<original-png-directory> \
  --output .local/work/<new-image-inspection>
```

CPU campaign configuration accepts optional `modelImageRecords` with `directory`
and `imagesDirectory`. The selected original journal/images join source provenance;
the diagnostic runs inside the campaign's owned process group. The complete
configured macOS campaign passes 36 components and 1,165 cases. Independent
inspection verifies 570 source/input comparisons, unchanged report/journal/image
digests and all 36 absent process groups. Independent native reads verify both
original contexts and all six persisted image objects. Existing Responses checks
retain 69 Astra outputs/70 calls; historical native checks retain twelve independent
assignments and six visual-context cases. Four-provider readiness and full source
checks pass with 73 Python files, 28 base imports, 56 Python diagnostics and
128 pinned DSH files/25 bindings. All allocations remain zero. This acceptance
covers request preparation; current-code loaded provider/task behavior retains
the native release requirements.

Evidence: `.local/work/model-image-admission-b-20261011/` and
`.local/work/model-images-cpu-campaign-20261011/independently-verified.json`.

Committed source `1012df8` matches all 115 distinct campaign production/checker
files against Git. Actual Ubuntu CI `38182924925` passes fresh installation,
complete source checks, seven SKILL tests and the separate 58-case runtime suite.
Independent downloaded-artifact admission verifies fourteen distributions,
thirteen imports, fifteen input digests and 53 exact-commit source comparisons.
Consolidated/checker identities agree; all seven task-plan journals remain unchanged
and release writers. The original-image diagnostic retains its separate local scope.
Evidence: `.local/work/model-images-cpu-campaign-20261011/committed-source-verification.json`,
`.local/work/ci-model-images-inspection-20261011.json` and
`.local/work/ci-model-images-independently-verified-20261011.json`.

## Responses function-call and replay admission

`models/src/responses-function-calls.ts` owns protocol admission for the production
Responses adapter. The existing installed `eventsource-parser` owns SSE decoding;
native DSH owns message assembly, tool validation/dispatch, cancellation and retries.
Required event fields use Zod without number/string coercion. Output indices and
sequence numbers are nonnegative safe integers; function-call events have increasing
sequence numbers. Named SSE events must agree with payload types, and unnamed events
use their payload type. Call IDs, tool names and argument strings are required.
The official optional item ID/status fields retain their optional/null semantics;
argument events require item IDs and bind them to the same output/call identity.

Duplicate identities, unknown argument targets, changed final arguments, repeated
finalization and inconsistent completed terminal output throw
`PROVIDER_PROTOCOL_ERROR` before native DSH tool dispatch. Completed output must
include exactly the streamed calls at their original output indices. Existing
token-budget and interrupted-stream handling remain in the native assembler/loop.
Responses replay selects the calls retained in that DSH message, checks their
identities/names/arguments and preserves other original output items. This keeps
subsequent context consistent with DSH truncation and pruning.

Primary field references: [Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events),
the official SDK [function-call item](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_function_tool_call.py),
[argument delta](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_function_call_arguments_delta_event.py)
and [item-added event](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_output_item_added_event.py).

`check-recorded-responses.mjs` uses production LocalStore readers and the native
DSH stream expansion/assembler on copied original journals. Actual Astra records
retain 69 complete model outputs and 70 tool calls. Their argument segments and
assembled tool calls remain unchanged through current admission and replay.
All 128 original-record/boundary/invalid-derivative cases pass, including duplicate
or missing fields, item identity changes, argument disagreement, event ordering,
terminal mismatch, selected replay calls and native token-budget/interruption
handling. Copied writers release and source/copy digests remain unchanged.

These records retain final provider output and durable DSH chunks. Event envelopes
and sequence numbers in this diagnostic are explicitly projected from those
records. Raw provider SSE is not retained. The diagnostic supplies no provider
response and makes zero requests, dispatches or model/simulator/GPU allocations.
Original live streaming and native task success retain their separate acceptance
requirements. Evidence: `.local/work/responses-replay-admission-20261011/` and
`.local/work/responses-cpu-campaign-20261011/responses/`.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-responses.mjs \
  --data-directory .local/work/<original-responses-journal> \
  --output .local/work/<new-responses-inspection>
```

`responsesJournalDirectories` is an optional bounded list in CPU campaign
configuration. Selected journals join source provenance and the `responses`
diagnostic uses the campaign's owned process group and release checks.

The complete configured macOS campaign passes all 35 components and 1,098 cases.
Independent inspection matches 543 source/input comparisons, unchanged report
digests and all 35 released diagnostic process groups. Original Responses journals
reopen with released writers and independently preserve all 69 outputs, 70 calls,
durable native DSH assembly and detached replay items. Existing historical context
checks retain twelve independent assignments and six visual-context cases; all
four provider readiness checks pass. Complete source checks pass with 73 Python
files, 28 base imports, 56 Python diagnostics and 128 pinned DSH files/25 bindings.
No model, simulator or GPU allocates. Evidence:
`.local/work/responses-cpu-campaign-20261011/independently-verified.json`.

The committed source at `72757e0` additionally matches 106 distinct campaign
production/checker files against Git. Actual Ubuntu CI `38181160684` passes
fresh installation, full source checks, seven SKILL document/metadata tests
and its separate 58-case runtime suite. Independent artifact admission matches
fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit
source comparisons. The downloaded consolidated evidence and checker source agree;
all seven task-plan journals preserve their bytes and release writers. The private
Responses journal diagnostic has its local record-based acceptance above. Evidence:
`.local/work/ci-responses-inspection-20261011.json`,
`.local/work/ci-responses-independently-verified-20261011.json` and
`.local/work/responses-cpu-campaign-20261011/committed-source-verification.json`.

## Continuous production CPU checks

The [Source checks workflow](../../.github/workflows/source-checks.yml) installs
the `policy,robodojo,recording` extras in a fresh constrained environment and runs
the complete source checks, then the device-owner, Session-resource, actual
Worker-transport, native DSH core-tool and configured task-plan diagnostics. The adapter dependencies are msgpack 1.1.1,
psutil 7.2.2 and NumPy 2.4.6 on Python 3.11 or 2.5.4 on Python >=3.12; recording
uses the declared PyAV 18.1.0. Optional model/simulator SDKs remain separate.

All 26 cases pass in actual macOS and GitHub Ubuntu CPU environments: six owner-thread cases,
four shared Session/device/recording cases and sixteen genuine Python Worker
process cases. The checks preserve source hashes, require confirmed thread/process
closure and retain original failure details. No model, simulator, sensor frame or
physical action is generated. The installation artifact retains actual pip and
installed-import provenance; the current runtime artifact requires all five
named acceptance reports. See [CI source provenance](../provenance/ci-actions.md)
and the [setup commands](../development/setup.md).

Committed `50dd522` passes actual GitHub run `38161986298` with fourteen installed
distributions, thirteen production/dependency imports and all 26 runtime cases.
Independent downloaded-artifact inspection matches 28 source comparisons against
that exact commit, each distribution/version/download identity, the original pip
report digest and closed-owner/Worker outcomes. CUDA remains invisible and native
allocations remain zero.

`scripts/check-cpu-runtime-evidence.py` is the reusable artifact reader. It
requires the original complete pip report, installation manifest and all five
runtime reports, verifies their exact Git source identities and publishes a
single source-bound inspection. The v1 inspector at `3accbb6` admits the actual
`50dd522` downloaded CI artifacts. Four actual CLI cases pass, including rejection of a different source
revision, Python optimization and an already-published output file. Seven original
evidence/checker identities remain unchanged; no model or simulator starts.

```sh
.venv/bin/python scripts/check-cpu-runtime-evidence.py \
  --installation .local/work/<downloaded-installation-artifact> \
  --runtime .local/work/<downloaded-runtime-artifact> \
  --source-revision <exact-ci-commit> \
  --output .local/work/<new-inspection>.json
```

The installation directory contains `cpu-install-report.json` and
`cpu-installation/installation.json`; the runtime directory contains
`device-owner/`, `session-owner/`, `worker-transport/`, `agent-tools/` and `task-plans/`.
The v3 inspector verifies the actual agent-tools journal and seven task-plan
journals against their reported digests, including the published Tower goal and
seventeen task-plan outcomes. All fifteen input files are required.
Read only artifacts
from the selected actual workflow run. This inspector verifies artifact
consistency and source identities; native task acceptance remains in the
[release register](v1-delivery.md).

The same production inspector passes in actual GitHub run `38162874886` at
`3accbb6` and independently admits both downloaded artifacts. Its fourteen
distributions, thirteen imports and 28 source comparisons match that exact commit.
The uploaded consolidated report matches seven inspection fields, all five input
digests and the inspector's Git source digest. Four local CLI-admission processes
are confirmed absent after completion. All 26 actual runtime cases and complete
source checks pass; native allocations remain zero.

Complete v2 run `38172377733` passes at `4d9031b` with all 41 actual CPU cases,
including fifteen native DSH core-tool cases. Downloaded artifacts independently
admit fourteen distributions, thirteen imports, seven input digests and 42
exact-commit source comparisons. Uploaded/local inspection matches seven
consolidated result fields and the inspector's Git source digest. Independent
local checks also match fourteen tool source identities, seven original receipt
fields and eight original request/schema fields, with the canonical contract
unchanged from the parent commit and released journal writers.
Evidence: `.local/work/ci-core-tools-installation-20261011/`,
`.local/work/ci-core-tools-runtime-20261011/`,
`.local/work/ci-core-tools-independently-verified-20261011.json` and
`.local/work/core-tools-refactor-ci-verified-20261011.json`.

Complete v3 run `38173880914` passes at `82cdc7e` with all 58 actual CPU cases,
including seventeen configured task-plan cases. Independent downloaded-artifact
inspection verifies fourteen distributions, thirteen imports, all fifteen input
digests and 53 exact-commit source comparisons. Uploaded/local inspection matches
seven consolidated result fields and the inspector's Git source identity.
Production TaskPlans/LocalStore readers independently verify all seven downloaded
plan journals, exact configured goal/owner/version, declared read rejections,
unchanged journal/report digests and released writer locks. The seventeen Linux
plan outcomes match local macOS validation. All native allocations remain zero.
Evidence: `.local/work/ci-task-plans-installation-20261011/`,
`.local/work/ci-task-plans-runtime-20261011/`,
`.local/work/ci-task-plans-inspection-20261011.json` and
`.local/work/task-plans-ci-independently-verified-20261011.json`.

Other private local evidence:

Production module exports at `3398769` pass actual CI `38176009858` with the
same 58 CPU outcomes. Independent artifact admission verifies fourteen
distributions, thirteen imports, fifteen input digests and 53 exact-source
comparisons. Uploaded/local consolidated fields and checker identity match.
Production readers preserve all seven downloaded task-plan journals and release
every writer. Separate local verification compares 25 core-tool/task-plan source
identities and their original Linux outcomes, then reopens actual file/question/
plan records without changing their journals. Complete source checks pass; all
native allocations remain zero. Evidence:
`.local/work/ci-module-exports-installation-20261011/`,
`.local/work/ci-module-exports-runtime-20261011/`,
`.local/work/ci-module-exports-inspection-20261011.json`,
`.local/work/module-exports-ci-independently-verified-20261011.json` and
`.local/work/module-exports-independently-verified-20261011.json`.

Additional private local evidence:

Active observation module integration at `8de1f01` passes actual Ubuntu CI
`38177836119`: complete source checks, seven authored SKILL document/metadata
tests and all 58 cases in the separate v3 artifact suite. Independent downloaded
artifact admission verifies fourteen distributions, thirteen imports, fifteen
input digests and 53 exact-commit source comparisons. Consolidated result fields
and checker identity match; production readers preserve all seven plan journals
and release their writers. The 32-component macOS original-record campaign is
recorded in [rotation admission](#active-observation-receipt-admission).
No native allocations occur. Evidence:
`.local/work/ci-rotation-installation-20261011/`,
`.local/work/ci-rotation-runtime-20261011/`,
`.local/work/ci-rotation-inspection-20261011.json` and
`.local/work/rotation-ci-independently-verified-20261011.json`.

- `.local/work/ci-runtime-local-20261011/`
- `.local/work/ci-runtime-installation-macos-20261011/`
- `.local/work/ci-evidence-local-20261011.json`
- `.local/work/cpu-installation-ci-pinned-20261011/`
- `.local/work/ci-installation-providers-20261011/`
- `.local/work/ci-runtime-providers-20261011/`
- `.local/work/ci-providers-verified-20261011.json`
- `.local/work/ci-production-evidence-complete-20261011.json`
- `.local/work/ci-evidence-admission-20261011/`
- `.local/work/ci-installation-admitted-20261011/`
- `.local/work/ci-runtime-admitted-20261011/`
- `.local/work/ci-current-artifacts-verified-20261011.json`
- `.local/work/ci-consolidation-verified-20261011.json`

## Active observation receipt admission

The production observation module owns bounded request admission and strict,
immutable measured receipt reads. NativeTaskBackend retains task identity and
cancellation before transmitting a request or publishing sensor metadata.
Device resource ownership and actual motion remain in the physical Worker/provider.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-rotation.mjs \
  --data-directory /absolute/path/closed-original-behavior-journal \
  --output .local/work/<new-rotation-check>
```

Repeat `--data-directory` for additional closed original journals. The diagnostic
reads private copies through LocalStore and verifies actual Planner tool-call,
request and receipt identities. Two original BEHAVIOR receipts retain exact
measured angles, positions and control/physics counts; 94 invalid receipt
derivatives and 22 invalid requests reject. Parsed receipts and position arrays
are immutable. Original journals, private copies and eight source hashes remain
unchanged, and every copied journal writer releases. No policy, model, simulator
or motion runs. Additional pitch/provider/concurrency workflows retain their
native release requirements.

The separate original core-tool evidence check passes sixteen original results,
including both rotations, fifteen ordered images and one formal check, against
their persisted native DSH receipts. Original task outcomes remain unchanged.
Evidence: `.local/work/rotation-cpu-campaign-20261011/rotation-receipts/` and
`.local/work/rotation-tool-evidence-complete-20261011/`.

`rotationJournalDirectories` is an optional bounded list in the CPU campaign
configuration. Its original journals join input provenance and the
`rotation-receipts` diagnostic uses the campaign's existing process-group
ownership, cancellation and release checks.

The complete configured macOS CPU campaign passes all 32 components and 668
admission/process/wire/resource cases, including 118 original/invalid rotation
inputs. Separate historical context checks retain twelve independent native
assignments and six visual-context cases; four configured provider profiles pass
readiness. Independent inspection matches 492 source/input hashes, every report
digest and all 32 absent diagnostic process groups. Production LocalStore and
rotation readers independently admit both recorded motions, preserve the copied
journal digest and release its writer. Complete source checks pass with 72 Python
files, 28 base imports, 55 diagnostics, 128 pinned DSH files/25 bindings and 19
private workspaces. GPU, model and simulator allocations remain zero. Evidence:
`.local/work/rotation-cpu-campaign-20261011/independently-verified.json`.

## Perception input and depth statistics admission

Clean `6d1f4e2` passes actual Ubuntu CI `38179169536`, including complete source
checks, seven authored SKILL tests and all 58 cases in the five-component artifact
suite. Independent downloaded-artifact inspection matches fourteen distributions,
thirteen imports, fifteen input digests and 53 exact-commit source comparisons.
Consolidated result/checker identities agree; every copied plan journal retains
its digest and releases its writer. The original-record perception diagnostics
below have their separate local evidence. CI evidence:
`.local/work/ci-perception-installation-20261011/`,
`.local/work/ci-perception-runtime-20261011/`,
`.local/work/ci-perception-inspection-20261011.json` and
`.local/work/perception-ci-independently-verified-20261011.json`.

Both actual SAM/YOLO HTTP clients use production request admission before network
transmission. Original image/mask/ROI/calibration records pass; empty or oversized
bytes, unsupported media, invalid ROI/calibration fields and excessive Unicode
prompt/calibration lengths reject. Admitted image/mask bytes are copied, ROI and
calibration metadata are detached and immutable, and original cancellation reasons
are preserved. The diagnostic binds a TCP listener solely to observe unintended
requests: rejected calls create zero connections, no provider response is supplied,
and the listener releases at completion.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-perception-inputs-offline.mjs \
  --image /absolute/path/original-source.png \
  --directory /absolute/path/original-ts-acceptance \
  --intrinsics /absolute/path/original-camera/intrinsics.json \
  --prompt cabinet --output .local/work/<new-perception-input-check>

CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-depth-statistics-offline.py \
  --image /absolute/path/original-source.png \
  --directory /absolute/path/original-ts-acceptance \
  --calibrated-directory /absolute/path/original-camera \
  --output .local/work/<new-depth-statistics-check>
```

The Python diagnostic calls `summarize_predicted_depth`, the same production helper
used by YOLO, on four original cold/warm records and two original calibrated
records. All selected/valid counts, fractions, float32 axial statistics and camera
ranges match the saved service outputs within `rtol=1e-7`, `atol=1e-9`. Invalid
array/mask/calibration derivatives reject, and camera-range division/squaring or
axial reduction overflow raises at the arithmetic site. Original arrays, source
files and NumPy settings remain unchanged; no model SDK is imported.
The diagnostic requires enabled Python assertions and verifies that the imported
production helper belongs to the selected checkout before reading source records.
The actual optimized-Python invocation rejects without creating an output, and
the guarded six-record inspection passes all 168 cases. Its report is
`.local/work/depth-statistics-source-admission-20261011/acceptance.json`.

Actual macOS checks pass 134 request cases and 168 depth-statistic cases with zero
GPU jobs, model calls and environment allocations. Saved predictions retain their
original `unverified_for_source_camera` accuracy status. Evidence:
`.local/work/perception-input-complete-20261011/acceptance.json` and
`.local/work/depth-statistics-admission-20261011/acceptance.json`.

The optional strict `perceptionRecords` CPU campaign configuration contains
`image`, `directory`, `intrinsics`, `calibratedDirectory` and `prompt`. Its
`perception-inputs` and `depth-statistics` components use the existing process-group
ownership, report/source hashes, original-file checks and confirmed process release.

The complete configured macOS campaign passes all 34 components and 970
admission/process/wire/resource cases. Independent inspection matches 533
source/input hashes and all 34 absent process groups. It rereads original admitted
perception requests, six saved depth-statistic results and both rotations, preserving
every journal/report digest and releasing journal writers. Complete source checks
pass with 73 Python files, 28 base imports, 56 diagnostics, 128 pinned DSH files/25
bindings and 19 private workspaces. Evidence:
`.local/work/perception-cpu-campaign-20261011/independently-verified.json`.

The source-origin/optimized-Python admission also passes the complete configured
34-component, 970-case campaign. Independent inspection again verifies 533
source/input hashes, unchanged original records and all 34 absent process groups.
No model, simulator or GPU allocates. Current evidence:
`.local/work/perception-source-cpu-campaign-20261011/independently-verified.json`.

Clean `5527e60` also passes actual Ubuntu CI `38179611064`: full source checks,
seven SKILL document/metadata tests and 58 separate runtime cases. Independent
downloaded-artifact inspection matches fourteen distributions, thirteen imports,
fifteen input digests and 53 exact-commit source comparisons. Consolidated
result/checker identities agree, all seven original plan journals retain their
digests and their writers release. Native allocations remain zero. Evidence:
`.local/work/ci-perception-source-installation-20261011/`,
`.local/work/ci-perception-source-runtime-20261011/`,
`.local/work/ci-perception-source-inspection-20261011.json` and
`.local/work/perception-source-ci-independently-verified-20261011.json`.

## Fresh CPU installation

The production `scripts/check-cpu-installation.py` reads actual pip installation
reports, checks installed versions and editable-source ownership, runs `pip check`
and admits thirteen production/dependency imports. Complete initial provenance is
required; supplemental reports add consistent package identities. The current
`bc9a79e` checker admits twelve unique distributions from a genuine combined
core/provider installation. A genuine supplemental-only report rejects before
output publication. No optional model or simulator SDK is imported.

Clean `6b63217` installs frozen pnpm dependencies and independent Python
environments on macOS arm64/Python 3.14 and Linux x64/Python 3.12. Both pass complete
source checks, four-provider HTTP readiness, four actual ActionGate/thread/file-lock
cases and Desktop packaging. GitHub Source checks on Python 3.11 also passes for
`6b63217`, `8e63230` and `bc9a79e`, retaining actual pip reports and installation
manifests as workflow artifacts. The exact versions and configured native profiles
are recorded in the [configuration matrix](supported-configurations.md).

The fresh macOS package selects all four compatible profiles through the actual
Console controls, then completes service-stop and application-quit cycles. Ten
ASAR files match the source, including the packager's actual package sanitizer.
Renderer isolation and disabled hardware graphics are confirmed. No Session,
managed model/policy service or inference starts. Browser errors remain empty;
service/application processes, writer ownership and listeners are released.

Independent verification compares 857 tracked source files per platform, 53/46
evidence files and five/eight released processes on macOS/Linux. Linux additionally
confirms six released process groups. Cross-platform comparison verifies nine
source identities, thirteen matching module identities and unchanged results for
the four actual ActionGate cases. Original configuration identities and canonical
user changes remain unchanged. Model, inference, simulator and GPU allocations
remain zero. Signed distribution and native task behavior retain their respective
acceptance requirements.

Private evidence under the canonical checkout:

- `.local/work/fresh-cpu-installation-macos-20261009/`
- `.local/work/fresh-desktop-cpu-20261011-03/acceptance.json`
- `.local/work/fresh-cpu-installation-linux-20261011-verified/`
- `.local/work/fresh-cpu-installation-platform-comparison-20261011.json`
- `.local/work/supplemental-cpu-installation-20261011/`
- `.local/work/cpu-installation-ci-complete-20261011/`

The original Linux archive is
`.local/work/fresh-cpu-installation-linux-20261011-evidence.tar.gz`, SHA-256
`bc74bddd62313a25078cfd584df6997b98caf55fe980cde551a66dc806bcc19e`.
Its contents and process releases were independently verified before transfer.
Follow the [setup guide](../development/setup.md) for actual installation commands.

## Packaged Desktop CPU workflow

`scripts/check-desktop-configuration-cpu.mjs` verifies an actual packaged executable
against its clean source checkout and original native workspace configuration.
It checks ASAR bytes with the installed packager library, actual source revision,
every configured component selector, Node/context isolation and renderer sandbox
preferences. Chromium sandboxing stays enabled; disabling flags are rejected.
Actual service-stop and application-quit cycles require absent application/service
processes, released writer ownership and refused connections to the former listener.
The original configuration hashes and clean source are checked after completion.
The v2 diagnostic also relaunches the packaged application against the same saved
configuration. Its startup must stay idle without writer ownership or an open
Console. A third explicit service cycle verifies Console window reuse, reload,
close and reopen without replacing its service process. The reopened Console
selects every configured profile, exposes no launcher IPC and completes application
quit with confirmed application/service/writer/listener release.

Clean `887d707` passes the v2 workflow on macOS with all four configured providers,
ten source-matched ASAR files, twelve profile selections, three service cycles and
zero browser errors. Independent inspection matches nineteen source/package/
configuration identities, confirms five released application/service processes
and three refused listeners, and reopens the original empty production LocalStore.
Its journal remains unchanged and writer ownership releases. Application restart
preserves the selected path and stays idle. Native allocations remain zero.
Evidence: `.local/work/desktop-restart-configuration-20261012/acceptance.json` and
`.local/work/desktop-restart-configuration-20261012/independently-verified.json`.
Clean Linux `86c612a` passes the same v2 workflow with a real headless
Wayland/Pixman compositor, ten matching ASAR files, twelve profile selections and
three service cycles. Independent verification matches nineteen source/package/
configuration identities and confirms six released processes including the
compositor, its absent process group/sockets and unchanged canonical server source.
All 31 transferred evidence files and their archive digest verify. Cross-platform
inspection matches the ten packaged files and diagnostic source, twenty-four
selections and six service cycles. The copied Linux production journal also reopens
unchanged with zero records and released writer ownership. Evidence:
`.local/work/desktop-restart-linux-20261012-evidence/unpacked-files.json` and
`.local/work/desktop-restart-linux-20261012-evidence/platform-comparison.json`.
Archive SHA-256:
`901ac028ae9d870c91ca2f76d962d5c8066ce1357fa64fe3f45b935bfae04eeb`.
Choose short repository-owned directories for `XDG_RUNTIME_DIR` and `TMPDIR`;
Wayland and Chromium create UNIX sockets in those directories.
Allocated profile/task acceptance retains its native release requirements.

The `bd8cb9d` diagnostic passes on macOS and Linux with four configured profiles,
ten packaged files, two window/service cycles and zero browser errors. Linux uses
Ubuntu 22.04's Weston 9.0.0 headless backend and Pixman CPU renderer, installed in
an isolated directory from original distribution packages. Native allocations
remain zero. Complete allocated profile/task switching and signed distribution
retain their native and release requirements.

Private evidence: `.local/work/desktop-configuration-cpu-macos-20261011-03/` and
remote `.local/work/desktop-configuration-cpu-linux-20261011/`.
Executable arguments and actual application versions are retained in
`application.json`; per-cycle configuration/service/Session responses and
`acceptance.json` preserve the selected components and cleanup identities.
Independent verification rechecks twenty file identities per platform, three/four
actual process releases on macOS/Linux and both refused former listeners. Linux
additionally confirms its compositor process group and Wayland socket are released,
with canonical user changes preserved. Cross-platform comparison matches all ten
packaged files, eight profile selections and the diagnostic source identity.
The transferred archive in
`.local/work/desktop-configuration-cpu-linux-20261011-evidence/` has SHA-256
`7bab4aebd455fd93ef61eaccba7d2ff69a644937aef35621c2ca40d45519e552`.
The [Desktop guide](../../apps/desktop/README.md#acceptance) provides the command.

## Consolidated CPU campaign

The campaign includes the native DSH core/extension diagnostic and configured
task-plan storage diagnostic in every configuration. They use the same declared
output directory, process-group ownership, source hashing and final publication
rules as policy, transport, perception and Console checks. Private local journals
and native Session scopes require no model or simulator allocation.

Source `348a06d` passes the complete configured forty-two-component campaign,
including all 1,559 cases, 892 independently inspected source/input comparisons
and 180 exact-commit production/checker files. All diagnostic process groups and
journal writers release, with original records/images unchanged. Independent
retry inspection preserves all 338 event bodies in 22 native Sessions. Fifteen
previously executed installed processor files match this source; no SDK/model
rerun occurs. Evidence: `.local/work/complete-foundation-cpu-20261013/`,
`.local/work/complete-foundation-native-retries-independent-20261013.json` and
`.local/work/current-sdk-foundation-source-20261013.json`.

The shutdown diagnostic admits successful source-closure output independently
of the selected DSH file count. Its three actual SIGTERM/SIGINT/repeated-signal
cases drain source checking, reject the next component, publish no final
acceptance and confirm runner/process-group release. Evidence:
`.local/work/complete-foundation-cpu-shutdown-20261013/acceptance.json`.

Each diagnostic runs asynchronously in its own POSIX process group. A normally
completed component publishes `<component>.process.json` with the actual PID,
exit status and confirmed group release; the campaign records its digest.
SIGINT/SIGTERM request campaign closure. The current diagnostic completes its
own checks and cleanup before the next component is rejected. Repeated signals
preserve that ownership. Interrupted campaigns exit with failure, retain
`completed.json` and `interruption.json`, and publish no final `acceptance.json`.
Process-group release after child exit has a ten-second confirmation deadline.
Supply a new output directory with an existing parent. The campaign resolves the
parent through the actual filesystem, admits it within this checkout's
`.local/work`, and records canonical output paths. Configured directory aliases
retain the same source and process ownership.

## Core tool definitions and native dispatch

`extension-definition.ts` owns detached assignment-factory assembly and matching
native names. UpperRun binds its result through the existing assignment permission
and lifetime wrapper into the native DSH scope. The public core diagnostic's v2
report records twenty production/configuration/checker sources, fifteen core
cases and nineteen extension cases. Actual factory calls read private source files
and return numeric byte lengths through native schema validation and rendering.
Two native Sessions independently bind `source.length`; ordinary `constructor`
and `toString` tools remain scoped to their configured owner. Invalid bindings
reject before invoking the factory. Caller input/schema changes, invalid
arguments, cancellation, foreign visibility and disposed scopes are checked
against actual DSH results. Both agents, host and journal writer release.
macOS evidence: `.local/work/extension-factory-core-20261013-02/acceptance.json`.
The CI evidence inspector verifies all nineteen extension cases and ten original
native outcomes, including numeric values recomputed from committed source bytes.
This diagnostic performs no model inference or physical allocation.

Source `f7d27e1` verifies twenty committed files on macOS, isolated Linux and
Ubuntu CI. All fifteen core cases, nineteen extension cases and ten native outcomes
match. The actual Linux runner exits and the canonical server checkout remains
unchanged. CI `38383628510` passes installation/source checks and 97 runtime cases;
downloaded artifacts match 95 source comparisons and 41 inputs. Production readers
reopen private file storage, seven task-plan journals and the retry audit history,
preserving all source bytes, 338 events and 22 Session identities with released
writers. Evidence: `.local/work/extension-factory-platforms-independent-20261013.json`,
`.local/work/ci-extension-factory-inspection-20261013.json`,
`.local/work/ci-extension-factory-tools-independent-20261013.json` and
`.local/work/ci-extension-factory-native-independent-20261013.json`.

`tool-names.ts` owns logical-ID admission and the native name projection used by
Deployment, FileTeamLoader, UpperRun, core definitions and core audit admission.
The complete core/extension pack requires distinct native names, and DSH's
exported transport name remains reserved. `pnpm check:role-workflows` includes
forty-seven production helper/Team-loader cases with ten authored Teams.
Original four-provider deployment checks pass twenty-eight cases and preserve
their existing configuration metadata. Seven actual native DSH checks verify
detached parameters, scoped visibility, two original production-source reads,
argument admission, cancellation and scope disposal. Evidence:
`.local/work/tool-bindings-configured-final-20261013/acceptance.json` and its
`native-tool-outcomes.json`. These scopes perform no model or physical execution.
The core diagnostic now records fifteen production/checker source identities,
including the shared name module; its fifteen actual tool cases pass with a
released host and journal writer at `.local/work/tool-bindings-core-final-20261013/`.

At `0a341d6`, independent inspection matches thirty committed source comparisons
on macOS and twenty-nine on isolated Linux. All twenty-eight configured cases,
seven native checks and six original tool outcomes agree across platforms. Five
original model/provider input identities match. The actual Linux runner exits,
isolated source stays clean and canonical server changes remain unchanged.
Ubuntu CI `38380323559` passes full source checks, fresh installation and 78
runtime cases. Downloaded artifacts match 90 source comparisons and 41 input
identities; production readers preserve seven plan journals and 338 retry events
in 22 Sessions, with released writers. Evidence:
`.local/work/tool-bindings-independent-20261013.json`,
`.local/work/tool-bindings-platforms-independent-20261013.json`,
`.local/work/ci-tool-bindings-inspection-20261013.json`,
`.local/work/ci-tool-bindings-plans-independent-20261013.json` and
`.local/work/ci-tool-bindings-native-independent-20261013.json`.

`tools/core-definition.ts` owns native core definition assembly, assignment-specific
parameters, provider timeout selection, existing DSH argument validation, EDH input
limits and authoritative successful turn conclusion. UpperRun supplies its actual
scoped operations, provider availability, role permissions and lifetime checks.
`core-output.ts` renders canonical JSON with ordered admitted image attachments.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-core-tools-offline.mjs \
  --output .local/work/<new-core-tool-check>
```

The diagnostic creates a real DSH host with no model bindings, registers the
production core definitions and dispatches actual AssignmentFiles operations and
UserClarifications requests into a private LocalStore. Fifteen cases cover original
source-content writes, reads/search, empty content, current-version updates, native
parameter admission, unsafe versions, conflicting versions, private paths, size
limits, caller cancellation, question persistence, same-call identity and native
turn conclusion. Rejected operations preserve the actual journal digest and native
error identity. The writer closes, retained content survives reopening and the
host disposes. Model, simulator and control allocation remains zero.

Actual macOS checks pass at `.local/work/core-tools-cpu-20261011-05/`.
Seven original tasks separately match 98 canonical native results, 27 image
results, 81 images and six formal checks through the same production renderer.
Sixteen original model requests match 344 schemas through the unchanged production
parameter generator. Evidence: `.local/work/core-tools-original-evidence-20261011-01/`
and `.local/work/core-tools-original-schemas-20261011-01/`.
Loaded-policy decisions, native device behavior and complete task success retain
their per-configuration release requirements.

Source CI requires this diagnostic's `agent-tools/acceptance.json` alongside the
device, Session, Worker and task-plan reports. The v3 inspector admits all five
components and their actual journals before artifact publication.
Actual Ubuntu run `38172377733` passes the complete v2 workflow at
`4d9031b`; all fifteen DSH cases match the local CPU admission outcomes.

## Configured task-plan storage

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-task-plans-offline.mjs \
  --output .local/work/<new-task-plan-check>
```

The diagnostic parses the published `examples/tasks/robodojo-build-tower.json`
through the production task-catalog parser, then uses TaskGoals, TaskPlans and
LocalStore directly. Seventeen cases cover configured initial/next templates,
durable writes, foreign ownership, stale writes, completion without an accepted
verdict, immutable final criteria, required final-goal retention, versioned
reopening, compaction and six original/invalid-derived stored reads. Rejected
operations and next-write templates preserve the actual journal digest. All
nine writer open/close cycles release; the report retains eleven production/
configuration source identities and seven journal digests. It performs no model,
simulator or physical control operations.

Local macOS validation passes at `.local/work/task-plans-cpu-20261011-02/`.
Actual GitHub Ubuntu run `38173880914` passes the same seventeen outcomes at
`82cdc7e`; independent production reads of its seven downloaded journals preserve
their digests and release every writer lock.
Source CI executes this diagnostic and requires its report, final compacted
journal and all six derivative journals. The v3 consolidated inspector checks
the exact configured Tower goal against the triggering Git source, all seventeen
named outcomes, compaction/version consistency, eleven source identities and
each unchanged/released derivative journal. Original-record inspection retains
the separate checks described under [model-visible tool schemas](#model-visible-tool-schemas).

## SKILL document storage and retrieval

`pnpm test:skill-sections` executes seven authored-document CPU tests through the
production SkillLibrary, CommonMark selector, LocalStore and native DSH tool
dispatch. Search and load share canonical SkillMetadata, immutable storage-version
and skill/key identity admission. Invalid metadata fields, rewritten records and
foreign identities reject before returning results; rejected reads preserve the
journal sequence. Full/selected reads, references, export, reopening and compaction
retain their document boundaries. Source CI requires the same suite with CUDA
hidden. These tests perform no model inference, simulator allocation, physical
control or recovery-experience production. Experience relevance and transfer
retain their separately agreed acceptance scope.

## Core tool evidence selection

`coreToolEvidenceIds` in the tools module owns model-facing evidence selection;
`renderCoreToolResult` produces canonical JSON text and ordered image content.
UpperRun supplies its calling Verifier's formal-check sample when required and
admits references through existing assignment grants and SensorSamples. Native
DSH continues to validate, render and persist results.

The original-record diagnostic reads private copies of closed production journals
through LocalStore, SensorSamples, VerificationContexts and SessionAudits. Every
successful core result is compared with its original task event and persisted
native DSH `tool/result`. JSON text and all ordered image attachments must match
exactly. Formal images come from actual `verification.checked` captures and their
persisted check identities. Sources retain their hashes.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-tool-evidence.mjs \
  --data-directory /absolute/path/closed-production-journal \
  --require-tool perception.capture --require-tool verification.check \
  --output .local/work/<new-tool-evidence-check>
```

Repeat `--data-directory` for additional original journals and `--require-tool`
for capabilities that must appear in the selected records. Output must be a new
directory under `.local/work`. The diagnostic invokes no models, tools, policies
or devices. Its acceptance covers the supplied original results and reference
selection; loaded perception providers retain their native release gates.

On macOS and isolated Linux, 98 original core results per platform from seven
tasks match their persisted native receipts,
including 27 image results, 81 images, six formal checks, active rotation and
explicit evidence reads. Original journals and production sources retain their
hashes. Independent checks verify seventeen source/journal identities per platform,
exact original results across platforms, report/archive digests and actual Linux
runner/diagnostic release. Frozen source stays clean and canonical server status
remains unchanged. Evidence: `.local/work/tool-evidence-cpu-macos-20261008-verified/`
and `.local/work/tool-evidence-cpu-linux-20261008-verified/`.

The same clean `c857e13` source passes all thirty configured CPU components on
macOS and isolated Linux, with 463 admission/process/wire/resource cases per
platform, six visual-context cases, twelve original context reads and four-provider
readiness. Independent checks verify 428 source/input hashes, every report digest
and thirty actual process-group releases per platform. Linux additionally verifies
twelve context-implementation hashes and actual campaign-runner release.
Full source checks pass with 69 Python files, 28 base imports, 49 diagnostics,
128 pinned DSH files and 25 bindings. Evidence:
`.local/work/tool-evidence-cpu-campaign-macos-20261008/independently-verified.json`.
Linux evidence: `.local/work/tool-evidence-cpu-campaign-linux-20261009-verified/`.
Local cross-platform verification additionally checks 191 production-source
comparisons, ten original input/context comparisons, thirty Linux process
receipts and twenty-nine component reports. Original contexts and four-provider
readiness match. The downloaded Linux campaign archive retains SHA256
`548d03105815cfc3c1cf8a7fcfb860546fe4d3bee859d89d8391b59aee99e2d0`.
These checks allocate no models, simulators or GPUs. Loaded checkpoints, native
task completion and the complete configuration matrix retain their release gates.

## Perception result construction

`perception/src/results.ts` constructs model-facing segmentation, learned-depth
and RGB-D result objects together with their generated SensorSamples. The caller
supplies admitted provider values, attachment references, evidence identities and
processing timestamps. Source observation time, camera/world frames, calibration,
mask identity and model provenance retain their existing meaning. UpperRun owns
provider calls, source checks, cancellation, image storage and assignment grants;
the existing DSH dispatcher owns native result delivery.

The v2 original-tool diagnostic passes on five unchanged production journals:
140 core results, 50 image results, 120 ordered images and six formal checks
match their persisted DSH content. Eight SAM and three YOLO results additionally
pass result construction and immutable retention of all nineteen generated
samples. Matching includes exact source observation/clock metadata, instance
masks, ordered attachments and learned-depth calibration fields. The supplied
records establish this SAM/YOLO construction scope. RGB-D retains its separate
source-bound geometry acceptance and native provider requirements.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-tool-evidence.mjs \
  --data-directory /absolute/path/closed-production-journal \
  --require-tool perception.segment_objects \
  --require-tool perception.estimate_depth \
  --output .local/work/<new-perception-result-check>
```

Repeat `--data-directory` to supply all original journals needed by the requested
tool coverage. The diagnostic preserves exact source/code/journal identities and
releases each copied LocalStore writer. It performs no model inference,
perception-provider requests, environment allocation or physical control.
Evidence: `.local/work/perception-results-recorded-final-20261012/acceptance.json`.
Independent production readers additionally verify twenty-one source/schema/journal
identities, all 140 native result contents, nineteen source-timed sensor samples,
unchanged copied journals and five released writers. Inspection:
`.local/work/perception-results-recorded-final-20261012/independently-verified-source.json`.
All eleven captured implementation/schema files additionally match committed
source `4f89fd6` exactly.

The complete configured CPU campaign passes all thirty-seven components and
1,185 cases with the same perception implementation. Independent inspection
matches 634 source/input identities and verifies every diagnostic process group
has released. Original journals and images remain unchanged; actual transient
model-transport checks retain 56 failed connections and zero provider responses.
Model, simulator and GPU allocations remain zero. Evidence:
`.local/work/perception-results-cpu-campaign-20261012/independently-verified.json`.

Actual Ubuntu CI `38336834409` passes fresh installation, complete source checks,
seven SKILL cases and all 78 production runtime cases at `4f89fd6`. Independently
downloaded artifacts match 89 exact-commit source comparisons, fourteen installed
distributions, thirteen imports and all 41 captured inputs. Production readers
verify seven unchanged task-plan journals with released writers, plus 22 native
retry Sessions, 56 actual failed connections and 338 immutable events. Retry
admission preserves fractional delays and all eight pending-history releases.
The three JUnit reports independently verify eight model-request, thirteen failure
classification and fifteen retry-configuration cases with zero failures or skips.
These checks allocate no models, policies, simulators or GPUs. Evidence:
`.local/work/ci-perception-results-inspection-20261012.json`,
`.local/work/ci-perception-results-independently-verified-20261012.json` and
`.local/work/ci-perception-results-native-independently-verified-20261012.json`.

## Pre-SDK GR00T configuration admission

The [configuration diagnostic](../../scripts/check-gr00t-configuration-offline.py)
uses original pinned checkpoint metadata and declared invalid derivatives through
the production GR00T adapter constructors. Both constructors check compatibility
before optional SDK imports or model construction. The reader owns ordered
modalities, temporal indices, representations and state references, capacity
agreement, normalization dimensions, finite values and ordered finite ranges.
See [admission behavior and commands](checkpoint-bindings.md#gr00t-configuration-admission).

Clean `2821c21` passes 52 RoboCasa and 59 BEHAVIOR checks on both macOS and isolated
Linux. Both original configurations pass; all 109 invalid samples terminate
constructor admission with no model SDK import. Sixty shared input checks also
pass per platform. Full macOS source checks pass with 68 Python files, 28 base
imports, 48 diagnostics and 128 pinned DSH files/25 bindings. Linux passes the same
Python compilation and base-import checks.

The same clean source separately passes sixty installed processor/codec checks
on forty-six original requests across all four providers. Comparison by exact
tensor/envelope identity confirms unchanged prepared values, including image,
normalized state, instruction and embodiment inputs. Independent verification
matches 416 SDK/checkpoint/input/source hashes, 45 configuration/input hashes,
84 local source comparisons and all report/archive digests. Actual OS inspection
confirms runner and diagnostic absence. Frozen source stays clean, canonical
server status and original files remain unchanged, and CUDA stays uninitialized.
Models, inference, environments and device controls remain zero.

Evidence: `.local/work/v1-gr00t-configuration-macos-20261008/` and
`.local/work/v1-gr00t-configuration-linux-20261008-verified/`. Archive identities:

| Archive | SHA256 |
| --- | --- |
| Configuration and shared inputs | `b0e5a970c769df092d9cad5b2286d0996696dfe1c13ac3bbe4c3f5f7b873df2d` |
| Installed processors and codec | `22ffd1533add2d1302e701efd7e7494a4bf71e21b8abde601d0587cd14d63976` |

These checks establish CPU configuration and preprocessing behavior. Loaded-model
cancellation, physical stopping and native task outcomes retain their release gates.

## Installed checkpoint processors

### GR00T pre-inference model-input admission

`collate_model_input` uses the real SDK collator and native bfloat16 conversion,
then checks floating-point state and finite, noncomplex model-input tensors.
Both GR00T adapters bind it to their selected policy's `collate_fn` before online
inference. The installed processor diagnostic calls the same production function
with actual checkpoint processors and original requests, without a policy network.

Clean `48bcc47` passes the following isolated Linux checks:

| Provider | Original requests | Total checks | Invalid derivatives |
| --- | --- | --- | --- |
| RoboTwin | 7 | 21 | 14 saved-normalization overflows |
| RoboCasa | 24 | 30 | 6 GR00T prepared-state/dtype/conversion checks |
| BEHAVIOR | 3 | 9 | 6 GR00T prepared-state/dtype/conversion checks |
| RoboDojo | 12 | 12 | 0 |

GR00T derivatives cover NaN, Infinity, both signs of finite-float32-to-bfloat16
overflow, Boolean state and complex state. Each derivative uses the actual SDK
collator and fails at production admission. All forty-six original requests retain
identical prepared tensor/envelope values, including tensor path, dtype, shape and
byte identity. The configuration diagnostic also passes 111 checks on both macOS
and isolated Linux, with invalid production constructors failing before SDK imports.

Independent verification matches 418 SDK/checkpoint/input/source hashes,
16 configuration sources, 327 derivative hashes and 51 local source comparisons.
Report/archive digests match, original files and canonical server status remain
unchanged, frozen source stays clean and actual OS checks confirm diagnostic
process absence. CUDA remains uninitialized; model, inference, environment and
control allocations remain zero. Full macOS source checks and isolated Linux
Python checks pass with 69 Python files, 28 base imports and 49 diagnostics.

Evidence: `.local/work/v1-gr00t-model-input-linux-20261008-verified/` and
`.local/work/v1-gr00t-model-input-macos-20261008/`.
Installed processor archive SHA256:
`64c4050f7280b3b27d2d9552a61f95f963a65648a96d8c311614b739bf202bac`.
Source/configuration archive SHA256:
`929f94705514cce06bc851840c12722432336cc27f68de3cb2e10ffd214008fc`.
Loaded-model stopping, device behavior and complete native tasks retain their
individual release gates.

### RoboTwin checkpoint action postprocessing

The [saved postprocessor diagnostic](../../scripts/check-robotwin-postprocessor-offline.py)
loads actual saved SDK processors and the local tokenizer with CUDA disabled,
without constructing a policy network. The production `decode_model_actions` in
the [native adapter](../../harness/physical-runtime/src/physical_harness/policies/lerobot_pi05_robotwin.py)
requires complete finite floating-point `1-by-50-by-14` action tensors before and
after postprocessing. Native inference admits integer action limits 1–512 before
input preparation or model calls, then retains native prefix/gripper conversion.

```sh
CUDA_VISIBLE_DEVICES='' HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=harness/physical-runtime/src \
  /path/to/installed-lerobot/bin/python scripts/check-robotwin-postprocessor-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --checkpoint /path/to/checkpoints/pi05_robotwin \
  --tokenizer /path/to/checkpoints/paligemma-3b-pt-224 \
  --output .local/work/<new-postprocessor-check>
```

Original `conventional` RoboTwin entries supply `run`, `requests`, `serviceLog`
and `manifest` paths. The real saved normalizer transforms each recorded selected
model prefix. Declared zero normalized capacity padding forms the configured
50-step input; it does not recover the original complete normalized model output.
Guarded action tensors and native conversion must match the same SDK postprocessor
exactly. Separate processor copies establish float16, bfloat16 and float64 SDK
behavior without changing the original processor's statistics.

Declared invalid derivatives cover non-tensors, non-floating dtypes, nonfinite
values, rank/batch/horizon/channel/empty dimensions, action-count limits and both
signs of finite float32 input overflowing actual saved inverse statistics.
Reports retain original file/source identities, derived input/output digests and
actual process identities. Original requests and supplied tensors remain unchanged;
CUDA stays uninitialized. Model loads, inference, simulator allocation and controls
remain zero. Complete normalized predictions, loaded-policy/device behavior and
native task outcomes retain their own requirements.

Clean `a278547` passes 34 actual LeRobot 0.6.1 CPU postprocessor checks on seven
original selected 16-step model prefixes, each explicitly normalized by the saved
SDK and capacity-padded to 50 steps. Twelve cases pass: seven recorded-prefix
derivatives, three additional floating dtypes and two action-count limits.
Twenty-two invalid numeric/type/shape/count/inverse-overflow derivatives fail
production admission. Guarded actions and native mapping match the same actual
SDK exactly.

The same clean Linux source passes 21 saved input-processing cases, 70 original
Torch/controller cases and 76 four-provider numeric cases. Independent verification
matches 472 source/input hashes and confirms four actual diagnostic process-group
releases plus runner release. Original files and canonical user changes remain
unchanged, frozen source stays clean and CUDA stays uninitialized. Local verification
matches 35 implementation/manifest comparisons, unchanged original prepared tensors,
identical original native Torch results and identical shared numeric results.
GPU jobs, model loads/calls, simulator allocations and controls remain zero.

The retained archive has SHA256
`dd067186d1bb4a2645b11c1f2b0a709685bdd2897575ef97c4952899dfec8513`.
Evidence: `.local/work/robotwin-postprocessor-cpu-linux-20261009-verified/`.

### OpenPI checkpoint model transforms

The [actual SDK diagnostic](../../scripts/check-openpi-transforms-offline.py)
loads the selected ARX X5 configuration, saved checkpoint normalization and
cached PaliGemma tokenizer with CUDA disabled and JAX restricted to CPU. It calls
the actual SDK's input/output transforms without constructing a policy network,
restoring weights, performing model inference or allocating a simulator.

```sh
CUDA_VISIBLE_DEVICES='' JAX_PLATFORMS=cpu \
  OPENPI_DATA_HOME=/absolute/path/installed-openpi-cache \
  HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=harness/physical-runtime/src \
  /path/to/installed-openpi/bin/python scripts/check-openpi-transforms-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --checkpoint /path/to/checkpoints/RoboDojo-sim-arx_x5-joint-0/59999 \
  --output .local/work/<new-transform-check>
```

The original `openpiTask` entry supplies `run`, `requests`, `bridgeDirectory`,
`bridgeLog`, `nativeLog`, `verification` and `policyId`. The cached real tokenizer
must exist at `big_vision/paligemma_tokenizer.model` inside `OPENPI_DATA_HOME`.
Imported SDK sources must match the original identified inference inventory.

Production input admission checks the three available uint8 resized cameras,
prompt tokens and finite padded state before inference. Production output
admission checks all normalized state/action channels and steps before SDK
decoding, including padding and values beyond the selected action prefix, then
checks the complete native float32 action horizon. Actual SDK normalization,
tokenization, absolute-action reconstruction and gripper/prefix semantics remain
unchanged. The JSON bridge admits the action count before preparation or request
transmission. Scoped NumPy arithmetic checks terminate overflow at its transform.

Normalized output inputs are explicitly SDK-derived from original recorded
native actions, including delta normalization and declared capacity padding.
They do not recover original normalized network predictions. Guarded prepared
inputs and float32 native actions must match the same SDK exactly. Declared
invalid derivatives cover types, shapes, nonfinite values, padding, prompt/image
availability, action budgets, actual normalization overflow and finite normalized
values that exceed float32 range after saved quantile inversion. Reports retain
source/input identities and actual CPU process identities. Original files remain
unchanged; loaded-policy and complete task behavior retain native release gates.

Clean `930963c` passes 87 actual installed OpenPI transform cases on twelve
original requests and their explicitly native-action-derived normalized outputs.
Thirty-nine cases pass with exact same-SDK prepared input and native float32
equality; forty-eight declared invalid derivatives fail production admission,
including nonfinite model padding, values after the selected prefix and actual
saved inverse normalization exceeding float32 range.

The same source passes twelve original OpenPI codec inputs, 76 four-provider
numeric cases and 44 actual CLI startup checks. Independent verification matches
193 source/input comparisons and confirms 49 actual process releases, including
all startup children and the runner. Frozen source remains clean, canonical user
changes remain unchanged and original input/source bytes verify independently.
JAX uses CPU devices and CUDA stays uninitialized. Model loads/calls, GPU jobs,
simulator allocations and controls remain zero. Full source checks pass with
72 Python files, 28 base imports, 53 diagnostic entries and 128 DSH files/25 bindings.
Local verification matches fifty implementation/manifest comparisons, all report
and archive identities, and unchanged prepared values for the twelve original
OpenPI inputs against their prior installed-codec acceptance.

Evidence: `.local/work/openpi-transforms-cpu-linux-20261009-verified/`.
Retained archive SHA256:
`5068ca1a6b7bc5c796c53c5a9294cf6d1c1ff0eb9e94b393f811832c2c7be774`.

### RoboTwin pre-model saved-processor admission

The production `prepare_checkpoint_processors` function admits the tokenizer and
model features, loads actual SDK saved input/output processors and validates
normalization before policy construction. SDK-loaded features/modes must match
the model. Native mean/std values must be finite, dimensionally correct and use
nonnegative standard deviations and positive finite epsilon. State normalization,
absolute joint targets and matching action normalization/inverse statistics remain
mandatory. See [commands and behavior](checkpoint-bindings.md#lerobot-saved-processor-admission).

Clean `d937330` passes 22 original/invalid configuration checks in the real installed
LeRobot environment. Twenty-one declared derivatives cover model/processor dimensions,
normalization modes, tokenizer identity, action representation, epsilon, selected
state normalization, saved tensor statistics and compile selector admission.
Actual JSON and safetensors readers handle those files. The diagnostic calls the
same preparation used by the production constructor without constructing a policy
network, loading its weights or issuing inference.

The same source passes sixty installed processor/codec checks on forty-six original
four-provider requests. Every prepared tensor/envelope retains its prior verified
identity and values. Independent verification matches 416 SDK/checkpoint/input/source
hashes, 14 original configuration/tokenizer/source hashes, 105 invalid-derivative
hashes and 42 local source comparisons. Original files and canonical server status
stay unchanged, frozen source is clean and actual OS checks confirm runner and
diagnostic absence. CUDA remains uninitialized; model, inference, environment and
control allocations remain zero. Full macOS source checks and isolated Linux Python
checks retain 68 Python files, 28 base imports and 49 diagnostics.

Evidence: `.local/work/v1-robotwin-processor-preallocation-linux-20261008-verified/`.
Configuration archive SHA256:
`25f05d0a08777c04255238796cc7cc00e519dc975656e63021216011905ba733`.
Installed processor archive SHA256:
`61d7f7904861f59cbd9a38a876b805fb1a6ab5cd4c17008c56e9b20135b73848`.
Loaded-policy execution and complete native tasks retain their release gates.

### Shared original-request preparation

All four adapters expose `prepare_policy_input`; online inference and the installed
SDK diagnostic call the same production preparation. LeRobot's `prepare_model_input`
also admits tensor values after the actual saved processor and before model inference.
Complex or nonfinite tensor values fail immediately, including state normalization
overflow from otherwise finite float32 observations.

Clean `a97d0a9` passes sixty actual CPU processor/codec checks on forty-six original
requests in the isolated installed service environments:

| Provider | Actual preparation | Original requests | Checks |
| --- | --- | --- | --- |
| RoboTwin | LeRobot 0.6.1 saved normalization and local PaliGemma tokenizer | 7 | 21 |
| RoboCasa | GR00T 0.1.0 actual processor, VLAStepData, collator and native bfloat16 conversion | 24 | 24 |
| BEHAVIOR | GR00T 0.1.0 R1Pro processor, VLAStepData, collator and native bfloat16 conversion | 3 | 3 |
| RoboDojo | OpenPI client 0.1.0 production envelope and actual MessagePack round trip | 12 | 12 |

Fourteen RoboTwin rejection checks use declared positive/negative float32-limit
state derivatives and the real saved normalizer. Original observations still
prepare successfully. Every prepared tensor remains finite and on CPU;
RoboDojo camera/state hashes match their original actual inference records.
No policy network is constructed and CUDA remains uninitialized. Models,
inference calls, environments and device controls remain zero.

Independent verification compares 414 original SDK/checkpoint/input/source hashes,
all four report digests and the downloaded archive digest. Source stays clean,
canonical server status remains unchanged, and actual OS inspection confirms
the runner and SDK diagnostic processes are absent. GR00T configuration, processor
and statistics files match the original checkpoint manifest; its supplemental
`embodiment_id.json` is independently recorded with its unchanged-file digest.

```sh
CUDA_VISIBLE_DEVICES='' HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  PYTHONPATH=harness/physical-runtime/src \
  /path/to/selected-sdk-environment/bin/python scripts/check-policy-processors-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --provider robotwin --checkpoint /path/to/pi05_robotwin \
  --tokenizer /path/to/paligemma-3b-pt-224 \
  --output .local/work/<new-installed-processor-check>
```

Select `robocasa` or `behavior` with its real GR00T checkpoint and omit `--tokenizer`;
select `robodojo` in the OpenPI client environment and omit both checkpoint/tokenizer
arguments. Each output directory must be new. Evidence:
`.local/work/v1-policy-processors-linux-20261008-verified/`. Archive SHA-256:
`2dc685057f891ba5b3c5761b792a27154b99a2c47bc62dd3f0545ef56956302b`.
Loaded-model compatibility, GPU cancellation, physical actions and task outcomes
retain their native acceptance requirements.

## Verified source a97d0a9

All thirty configured components pass on macOS and isolated Linux, including
sixty shared policy-input and seventy-six recorded-output checks. Each platform passes 463 admission/process/wire/
resource cases, six visual-context cases, twelve original context reads and
four-provider readiness. Source checks retain 128 pinned DSH files, 25 bindings,
67 Python files, 27 base imports and 47 diagnostic entries.

Independent verification matches 383 component source/input hashes, twenty-three
diagnostic hashes and sixty process receipts. Sixty-one actual OS checks
confirm owned diagnostic group/script absence. Original input bytes and task
outcomes remain unchanged; the canonical server preserves its exact status and
isolated source remains clean. The Linux execution script exits zero.

Both platforms prepare the same four native cases and eight planned submissions
with matching profile, task and prerequisite bindings. GPU jobs, model calls,
environment allocations and controls remain zero. Evidence and independent reports
are under `.local/work/v1-cpu-policy-processors-macos-20261008/` and
`.local/work/v1-cpu-policy-processors-linux-20261008-verified/`. The downloaded archive
matches server SHA-256
`e75451f43ca0a603f0099ff9d6192ce0a4ab310b8374fabca899f8cedbe88561`.
Loaded-model cancellation, physical stop behavior and complete native tasks retain
the native campaign's acceptance requirements.

## Policy observation input preparation

The shared [`observation_inputs.py`](../../harness/physical-runtime/src/physical_harness/policies/observation_inputs.py)
binds source observation/embodiment identity, bounded RGB PNGs and finite float32
states before model calls. Install the `policy-inputs` extra for CPU decoding;
RoboCasa resizing uses the actual OpenCV INTER_AREA implementation. Adapter-specific
batch shapes, Torch operations, native mappings and checkpoint processors retain
their original service owners.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-policy-inputs-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --output .local/work/<new-policy-input-check>
```

Sixty checks pass on both platforms using four original policy requests: twelve
camera frames and twenty-eight state groups. Original RoboDojo tensor hashes match
the actual native inference records. Declared invalid derivatives cover identity, image metadata/
encoding, dimensions, booleans, nonfinite values and float32 overflow. All original
file hashes remain unchanged; no model SDK or inference, simulator or GPU executes.
Standalone local evidence: `.local/work/v1-policy-inputs-macos-20261008/`.
The consolidated campaign includes this diagnostic when
`checkpointAuditConfiguration` is supplied, alongside output/identity diagnostics
for thirty configured components.
Loaded SDK/model/device/task requirements
retain their independent acceptance gates.

## Policy numeric output admission

[`action_outputs.py`](../../harness/physical-runtime/src/physical_harness/policies/action_outputs.py)
validates real numeric arrays, positive horizon/batch dimensions, declared channel
counts and finite values before native conversion. OpenPI checks float32 range
before narrowing; each adapter retains its native action semantics and bounds.
LeRobot rejects Boolean/complex tensors before conversion and reuses one CPU copy.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-policy-outputs-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --output .local/work/<new-policy-output-check>
```

Seventy-six checks on each platform inspect four original numeric matrices and declared invalid
derivatives. BEHAVIOR records admitted 16×23 controls; RoboCasa records converted
16×12 model actions; RoboTwin records a selected 16×14 model-action prefix; RoboDojo
retains raw 50×14 float32 outputs. Prepared OpenPI values match their exact original
record. Batched numeric checks reshape those recorded channels explicitly and
provide no raw SDK group acceptance. Original hashes and action values remain
unchanged. SDK imports, model calls, environment allocations and GPU jobs stay zero.
Evidence: `.local/work/v1-policy-outputs-macos-20261008/`. The configured campaign
includes `policy-outputs` alongside `policy-inputs`, for thirty components.
The actual installed LeRobot/Torch module also passes seventy CPU conversion checks
on all seven original RoboTwin inference records. Both float32 and float64 selections
produce exact original model/native values without mutation. Boolean, complex,
nonfinite, invalid shape and out-of-range joint derivatives fail. Torch 2.11.0+cu130
initializes no GPU, loads no model and issues no controls. Fourteen source/input
hashes and the retained report/diagnostic hashes independently verify; the isolated
environment's seventy-nine packages pass compatibility checks.
Reports: `.local/work/v1-policy-outputs-robotwin-tensors-linux-20261008.acceptance.json`
and `.local/work/v1-policy-outputs-robotwin-tensors-linux-20261008.verified.json`.
Raw GR00T SDK groups, loaded-model/device and physical behavior retain native gates.

### GR00T checkpoint action decoding

The [installed decoder diagnostic](../../scripts/check-gr00t-decoding-offline.py)
uses actual local GR00T checkpoint processors without constructing a policy
network. Both online adapter constructors bind the same
[`decode_model_action`](../../harness/physical-runtime/src/physical_harness/policies/gr00t_model_output.py)
around the processor's `decode_action`. Normalized model arrays require finite
float32 values and configured horizon/channel capacity. Actual SDK decoding
retains checkpoint padding, unnormalization and relative-to-absolute conversion.
Exact decoded keys, group dimensions, finite values and float32 range are admitted
before the SDK's final float32 cast. Scoped NumPy arithmetic terminates numerical
overflow, invalid operations and division by zero during decoding.

```sh
CUDA_VISIBLE_DEVICES='' HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=harness/physical-runtime/src \
  /path/to/installed-gr00t/bin/python scripts/check-gr00t-decoding-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --provider behavior --checkpoint /path/to/checkpoints/GR00T-N1.6-BEHAVIOR1k \
  --output .local/work/<new-decoding-check>
```

Select `robocasa` with its actual compatible checkpoint for that provider. The
configuration uses original `conventional` entries with `run`, `requests`,
`serviceLog` and `manifest` paths. Complete `model_actions` are required: original
concatenated model groups for BEHAVIOR and mapped controller derivatives for
RoboCasa. The real SDK's `apply_action` creates explicitly derived normalized
inputs from those records and their original states. Guarded output groups and
native controller actions must match the same SDK decoder followed by its
original float32 cast exactly. This inspection does not recover original
normalized network predictions or RoboCasa category probabilities.

Checks cover actual recorded cohorts, checkpoint capacity padding, nonfinite
values, non-real dtypes, float16/float64 normalized inputs, rank, batch,
insufficient horizon/channels, empty arrays and invalid BEHAVIOR relative states.
Original request, normalized derivative, state and source files remain unchanged.
Reports preserve source hashes, derived-input/group hashes and process identities.
CUDA stays uninitialized, with zero model loads, inference, simulator allocation
or controls. Loaded checkpoint and physical-task acceptance retain their native
requirements.

Clean `2592b1d` passes the actual GR00T 0.1.0 processor checks on isolated Linux:

| Provider | Original record-derived inputs | CPU cases |
| --- | --- | --- |
| BEHAVIOR | 1,248 | 1,267 |
| RoboCasa | 24 | 39 |
| Total | 1,272 | 1,306 |

Two valid capacity-padding cases use the actual 50-by-128 checkpoint capacities.
Thirty-two declared invalid derivatives fail admission. Exact decoded float32
groups, native controller conversion and original input/file identities remain
unchanged. The same frozen source also passes 1,330 original controller cases and
76 four-provider numeric cases. Independent verification matches 2,706 source/input
hashes and confirms four actual diagnostic process-group releases plus runner
release. Frozen source stays clean, canonical user changes remain unchanged and
CUDA stays uninitialized. Local comparison verifies 44 implementation/manifest
comparisons, 58 shared controller cases, 24 shared RoboCasa records and identical
four-provider numeric results.

The retained archive has SHA256
`1e994596820701660005f9e3c9938f321bed50e04cde2ecbbfcbfc6902e1080a`.
Evidence: `.local/work/gr00t-decoding-cpu-linux-20261009-verified/`.
No policy network, inference, simulator or control allocation executes.

### GR00T controller conversion

The [controller diagnostic](../../scripts/check-gr00t-actions-offline.py) calls the
same `native_action_record` used after online `Gr00tPolicy.get_action` in both
GR00T adapters. Original request/action identity and checkpoint/controller
compatibility pass through the production recorded-run audit before inspection.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONDONTWRITEBYTECODE=1 \
  PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-gr00t-actions-offline.py \
  --configuration /absolute/path/original-checkpoint-audit-inputs.json \
  --output .local/work/<new-gr00t-controller-check>
```

The configuration selects original BEHAVIOR and RoboCasa entries under
`conventional`, with `run`, `requests`, `serviceLog` and `manifest` paths. Each
report identifies its source field, restored float64 values, model horizon and
selected native prefix. Original BEHAVIOR `model_actions` retain concatenated
groups; legacy `actions` records retain only the native prefix. RoboCasa
`model_actions` retain mapped controller values. Their inverse grouping supports
checks on explicit controller derivatives; original category probabilities and
SDK array dtypes remain outside that record's scope.

Checks cover exact original native values, limits 1 and 512, full-record retention,
invalid count types/ranges, numeric group dtypes, batch/channel/horizon dimensions,
nonfinite values, ActionSpec ordering, RoboCasa category thresholds and bounds,
and BEHAVIOR native clipping with preserved model values. Supplied groups and
source files must remain unchanged. Model SDK imports, model calls, GPU jobs,
environment allocations and controls stay zero. Loaded-model and physical task
acceptance retain their native requirements.
The configured CPU campaign includes `gr00t-actions` when
`checkpointAuditConfiguration` is supplied, with its own source identities, report
digest and actual diagnostic process-group release.

Clean `30c50d4` passes 85 checks per CPU platform on 27 original records: three
legacy BEHAVIOR native prefixes and 24 mapped RoboCasa controller sequences.
Both platforms additionally pass the same 76 four-provider numerical output
checks. Linux independently passes 1,330 controller checks on 1,272 original
records, including 1,248 complete BEHAVIOR model outputs from run `96c0b983`.
That original task remains failed. Exact original native values and complete
model values match production conversion; no fresh inference executes.

Independent Linux verification matches 1,354 source/input comparisons, confirms
four actual runner/diagnostic releases and preserves clean frozen source and
canonical user changes. Local comparison verifies 24 implementation/manifest
comparisons, 31 original input identities, report identities and identical shared
85-case/76-case results. The retained archive has SHA256
`3dca434ae52b0c8272b51714b677918d80857d2b4cd0855fa5f9650f56889bfe`.
Evidence: `.local/work/gr00t-actions-cpu-macos-20261009-final/` and
`.local/work/gr00t-actions-cpu-linux-20261009-verified/`.

Clean `de9b7f2` includes this exact production conversion in the configured CPU
release campaign. Thirty-one components pass 548 admission/process/wire/resource
cases per platform on macOS and isolated Linux, alongside six visual-context
cases, twelve original context reads and four-provider readiness.
Independent checks verify 469 source/input comparisons, twelve context-source
comparisons and 31 actual diagnostic process-group releases per platform. Linux
also confirms campaign-runner release, clean frozen source and unchanged canonical
user changes. Three actual CLI output-admission checks reject existing, external
and external-linked outputs before component startup. Output parents resolve
through the actual filesystem within this checkout's `.local/work`.
Campaign evidence: `.local/work/gr00t-controller-cpu-campaign-macos-20261009-final/`
and `.local/work/gr00t-controller-cpu-campaign-linux-20261009-verified/`.
The Linux campaign archive retains SHA256
`eac2673d293afc6abeb5df8f4aac3af6fc3889e77a72e8ce0acd11d46826cc18`.
Local comparison verifies 190 production-source comparisons, ten original input/
context comparisons, 31 Linux process receipts and thirty component reports.
Original contexts, four-provider readiness and all shared controller cases match
between platforms; the Linux runner and 31 diagnostic process groups are absent.

## Perception model response admission

`perception/src/model-responses.ts` owns the SAM3.1/YOLO26 response schemas,
source checks and detached result construction. HTTP clients retain bounded stream
consumption, endpoint and deadline ownership. Cancellation is checked again before
completed response admission. Existing client type exports and tool result fields
remain available.

SAM admission checks its actual multiplex adapter, UUID, model/checkpoint/source
digests, source area, scores, unique object IDs and bounded mask boxes/areas. Empty
instance lists remain valid. YOLO admission checks requested camera calibration,
RGB/mask/ROI identity, complete unmasked region coverage, bounded mask coverage,
pixel counts, positive ordered quantiles and camera range against axial depth.
Arrays and binary outputs detach from response data; binary encoding is canonical,
nonempty and bounded to 32 MiB per output.

The diagnostic reads original service-check metadata and corresponding saved binary
outputs. It reconstructs their wire representation using those exact bytes and
compares every returned value. Three original SAM camera responses include two
empty-instance results. Six original YOLO outputs cover calibrated camera ranges
and uncalibrated mask/ROI predictions. All 143 response, cancellation and explicitly
invalid derivative cases pass without service calls, simulator allocation or GPU
jobs; source images, metadata, masks, overlays and NumPy arrays remain unchanged.

```sh
CUDA_VISIBLE_DEVICES='' pnpm exec tsx --tsconfig tsconfig.runtime.json \
  scripts/check-recorded-perception-responses.mjs \
  --captures .local/work/<original-camera-results> \
  --images .local/work/<original-camera-images> \
  --uncalibrated-captures .local/work/<original-uncalibrated-results> \
  --output .local/work/<new-perception-response-check>
```

The optional strict `perceptionResponseRecords` CPU campaign binding supplies
`capturesDirectory`, `imagesDirectory` and optional `uncalibratedDirectory`.
The `perception-responses` component uses the existing report/source identities and
process-group ownership. Original calibration and saved binary formats are checked
with NumPy/Pillow during independent inspection. Loaded inference, segmentation
accuracy and camera accuracy retain their native acceptance requirements.

Current original-response inspection verifies forty source/original identities,
fifteen PNG checks and all forty-eight depth-statistic fields. The configured
campaign passes all thirty-eight components and 1,328 cases. Independent reads
match 676 source/input comparisons and all thirty-eight absent diagnostic process
groups. Original journals/images remain unchanged; all diagnostic writers release
and model, simulator and GPU allocations remain zero. Evidence:
`.local/work/perception-response-cpu-campaign-20261012/perception-responses/independently-verified.json`
and `.local/work/perception-response-cpu-campaign-20261012/independently-verified.json`.

All nine response implementation/checker files and 148 campaign implementation
files match committed source `953abec`. Actual Ubuntu CI `38343498588` passes
fresh installation, complete source checks and 78 production runtime cases.
Downloaded artifacts match 89 exact-source comparisons and 41 inputs; independent
production reads preserve seven task-plan journals and all 338 events from 22
native retry Sessions. Their fifty-six genuine failed connections produce zero
provider responses; writers release and native allocations remain zero. Evidence:
`.local/work/perception-response-cpu-campaign-20261012/perception-responses/independently-verified-source.json`,
`.local/work/ci-perception-responses-inspection-20261012.json` and
`.local/work/ci-perception-responses-native-independent-20261012.json`.

## Prior verified CPU checkpoints

Clean `d3336fc` passes all twenty-eight configured components on macOS and isolated
Linux: 327 admission/process/wire/resource cases per platform, six visual-context
cases, twelve original context reads and four-provider readiness. Policy transport
includes four explicitly invalid execution-mode selectors and seven non-finite/
duplicate JSON inputs through the actual authenticated production WebSocket server.
Each invalid selector closes with code 1011 before its inference callback. Original
request recording, telemetry and genuine unavailable-upstream failure also pass.

Independent comparison verifies 327 component source/input hashes, twenty-one
diagnostic hashes and fifty-six process receipts. Fifty-seven actual OS checks
confirm diagnostic group/script absence; the Linux execution script exits zero.
Original files/outcomes remain unchanged, the canonical server preserves its exact
status and isolated source stays clean. Both platforms prepare four native cases
and eight planned task submissions through the production campaign, preserving
profile, task and prerequisite bindings. No GPU, model, environment or controls
execute. Current-source CPU preparation is complete; loaded native behavior and
task/configuration requirements retain their own acceptance gates. Evidence and
independent summaries: `.local/work/v1-cpu-policy-mode-macos-20261008/` and
`.local/work/v1-cpu-policy-mode-linux-20261008/`. The downloaded archive matches
server SHA-256 `4d6b9207b22b2654b01777bdf56569ccb3cb2613812e51325b99e7a3cd4485dd`.

Clean `416a38a` passes all twenty-eight configured components on macOS and isolated
Linux, with 323 admission/process/wire/resource cases per platform, six
visual-context cases, twelve original context reads and four-provider readiness.
Checkpoint checks include thirty-three original-record/wire/Gate/actual-WebSocket
cases and thirty-six configuration/factory/HTTP cases. Declared selection metadata
preserves original action values; unidentified/inconsistent service responses
fail before dispatch. Native policy entries obtain identity from their verified
artifact, and hybrid proposal clients validate the lower-policy request scope.

Independent comparison verifies 326 component source/input hashes, twenty-one
diagnostic hashes and fifty-six process receipts. Fifty-seven actual OS checks
confirm diagnostic group and execution-script absence. The Linux script exits
with status zero. All eighty-six transferred artifact files remain unchanged,
the canonical server preserves its exact status and the isolated source stays
clean. GPU jobs, model calls, environment allocations and controls remain zero.
Evidence and independent summaries:
`.local/work/v1-cpu-checkpoint-wire-macos-20261008-final/` and
`.local/work/v1-cpu-checkpoint-wire-linux-20261008/`. The downloaded archive matches
server SHA-256 `73abd103ac04dbd341a09083f59fdeb4f019a3340a09507df7742de06d4c98d8`.
Loaded native model/device/task requirements retain their own release gates.

Clean `6877ce3` passes all twenty-eight configured components on macOS and isolated
Linux: 290 admission/process/wire/resource cases per platform, six visual-context
cases, twelve original native context reads and four-provider readiness. The
optional `checkpointAuditConfiguration` includes sixteen original-record identity
checks and twenty actual four-provider configuration/factory/HTTP checks.
Independent comparison verifies twenty-one diagnostic hashes, 318 component
source/input hash comparisons and fifty-six component process receipts. All
eighty-six transferred original artifact files retain their verified bytes.
Original journals/configuration data remain unchanged,
the canonical server checkout preserves its status and the isolated source stays
clean. Sixty-one actual OS checks independently confirm absence of fifty-six
diagnostic process groups, four checkpoint-admission children and the execution
script. GPU/model/environment
allocation and controls remain zero.

The Linux source also validates selected digests and complete recorded identities
against all four original checkpoints and rejects mismatched digests. Both native OpenPI entry forms retain
their actual report-directory errors before SDK imports. All eighteen original
RoboDojo files and 12,440,992,402 checkpoint bytes retain their verified identity.
Eight original-file/declared invalid-input normalization cases and three source
hashes match across platforms; six installed SDK source hashes match their recorded
provenance. The actual native normalization identity matches its complete inventory.
Reports and independent source/process summaries:
`.local/work/v1-cpu-checkpoint-audit-macos-20261008-final/` and
`.local/work/v1-cpu-checkpoint-audit-linux-20261008/`.
The downloaded evidence matches server SHA-256
`7988e4d3e0877de503f4d1f1b65778bb6fdc7005de43d72a57bca9eb3d315eed`.
Loaded native service/device/task acceptance remains outside these CPU checks.

The complete macOS campaign and all twenty-six process receipts pass under
`.local/work/v1-cpu-campaign-owner-20261008/`. Three actual signal cases pass
under `.local/work/v1-cpu-campaign-shutdown-20261008/`, with complete source checks,
released groups, no subsequent Worker diagnostic and no final acceptance report.
Run the separate shutdown check with the same actual campaign configuration:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-cpu-campaign-shutdown.mjs \
  --config /absolute/path/cpu-release.json \
  --output .local/work/<new-cpu-shutdown-check>
```

Frozen `0000db5` passes all twenty-six components and three signal cases on
isolated Linux using Python 3.12.14, Node 24.21.0 and pnpm 11.19.0. Its frozen
lock passes all 305 supply-chain entries. Independent comparison with macOS
verifies six original input hashes, six original configuration hashes, nineteen
diagnostic hashes and 202 component source-hash comparisons. Every component's
process receipt and original report matches its digest. Signal-case source
hashes, exit outcomes and release receipts agree across platforms; the next
component and final acceptance remain absent. The canonical server checkout
retains its exact status and owned campaign processes terminate.
The downloaded evidence archive matches server SHA-256
`3651b500b1be0a40bafb55a2f791584ae8d66e6ce9317fab4982668eec52675f`.
Reports and the independently verified summaries are under
`.local/work/v1-cpu-campaign-owner-linux-20261008/linux/`, in `cpu-release/` and
`cpu-shutdown/`. GPU/model/environment allocation remains zero. Native loaded
workflows retain their separate campaign requirements.

The production native deployment and workspace factories are owned by
`apps/server/src/native-deployment.mjs` and `native-workspace.mjs`. After this
source relocation, all twenty-six macOS CPU components pass under
`.local/work/v1-native-deployment-ownership-20261008/`. The accompanying
`source-relocation.json` verifies original exports, root resolution, exact moved
logic and unchanged four-provider profiles/configuration. Formatting checks
cover production and example MJS entries; workspace dependency checks include MJS
sources. Native executable and CLI diagnostics hash the production owner files.

[run-cpu-release-campaign.mjs](../../scripts/run-cpu-release-campaign.mjs) executes
twenty-six existing source/production diagnostics sequentially and fails on the first
unsuccessful component. Each component retains stdout, stderr and its original
report; `completed.json` retains completed components even after a later failure.
The final `acceptance.json` records original-input hashes, diagnostic source hashes
and every original report digest. Source and input hashes are rechecked after
each component. Output requires a new directory beneath ignored `.local/work`.
Optional `checkpointAuditConfiguration` supplies actual original runs, policy
requests/logs and OpenPI retained/task sources for
[checkpoint record inspection](../../scripts/check-checkpoint-audit-offline.py).
Its identified reference digests feed the existing native factories and HTTP
[checkpoint profile checks](../../scripts/check-checkpoint-profiles-offline.mjs).
Selecting that configuration executes twenty-eight components under the same
process-group ownership, failure and interruption rules. These extra checks use
original evidence and explicitly declared diagnostic selection metadata, allocate
no models or simulators and preserve loaded custom-checkpoint acceptance gates.

Use the [configuration example](../../examples/deployments/cpu-release.example.json)
with actual original inputs. Paths resolve relative to that configuration. The
Python executable preserves its virtual-environment symlink and requires the base
package plus `policy`, `diagnostics`, `recording` and `robodojo` extras. Node/pnpm
use the project's installed dependencies. The process/group checks require POSIX.
`packageManagerCommand` is an explicit argument array: `["pnpm"]` uses PATH;
`["/absolute/node", "/absolute/pnpm.mjs"]` selects an isolated installation.
Arguments execute directly without shell interpolation. File inputs and Python
paths resolve against the configuration directory; command arguments retain
their declared values.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/run-cpu-release-campaign.mjs \
  --config /absolute/path/cpu-release.json \
  --output .local/work/<new-cpu-campaign>
```

The required workspace contains actual model/provider/Team configuration for all
four providers. The worker configuration is an original RoboTwin or BEHAVIOR
deployment for the unallocated source/observer checks; the canonical policy
request uses RoboDojo dual ARX X5 scope. Policy transport takes its own original
request and policy audit journal. Each original Agent journal must contain at
least one completed native assignment with three image-bearing surface groups,
an actual three-view user message and an actual text input. No record is generated
to satisfy an input requirement. Original journals are copied before writable
readers inspect them. All child commands receive CUDA invisibility and CPU-only
diagnostics; readiness allocates no provider and registers no successful response.

The command covers source checks; Worker transport/client and initialization;
configured scene/endpoint admission; device, Session, ActionGate, rollout and
inference ownership; policy/perception service admission; shared service startup;
unified and provider-specific CLI signals; original native context/visual reads;
and actual four-provider Console readiness. Repeated diagnostic entries share one
source digest while retaining each invocation's independent report and logs.

On 2026-10-08, the macOS source passes all twenty-six components: 222 configured
admission/process/wire/resource cases, six native visual-context cases, twelve
original native context reads and four-provider readiness. The admission/resource
count includes 108 configuration rejections, four Worker initialization cases and
25 Console CLI signal cases. Original inputs retain their hashes. There are no
model calls, policy results, simulator allocations or controls. Evidence:
`.local/work/v1-cpu-release-matrix-20261008-final-03/acceptance.json`.

Frozen `f3e373c` independently passes all twenty-six components on isolated Linux
with Python 3.12.14, Node 24.21.0 and the complete frozen package lock. The same
222 admission/process/wire/resource cases, six visual cases, twelve original
context reads and four configured profiles pass. Six original input hashes,
six original configuration hashes, nineteen diagnostic hashes and 188 component
source-hash comparisons match macOS. Source dictionaries compare each named file
and its digest independently of filesystem enumeration order. Every retained
report matches its recorded digest; the downloaded archive matches the server's
SHA-256. Reports verify original histories, scoped resource release and an
unchanged canonical server checkout. The archive SHA-256 is
`1ed919a586f530e52a93d8afad3225a73253bc804497e9b8075217c6e4811ceb`.
Local reports and the independently verified summary are under
`.local/work/v1-cpu-release-matrix-validated-linux-20261008/linux/`.
The archived revision identifies frozen source; its extracted workspace correctly
reports Git identity as unavailable. Actual native execution requires a clean
committed checkout and fresh readiness tied to that exact revision.
Loaded-model/device behavior and original task completion retain the
[native campaign](native-release-campaign.md) requirements.

## ActionGate stop ownership

[action_gate.py](../../harness/physical-runtime/src/physical_harness/execution/action_gate.py)
retains one stop task independently of caller cancellation. Concurrent and
repeated callers receive its original result. Action/resume failure handling
preserves the original operation error and every stop error together, including
their identities and complete receipt text. Unconfirmed stopping keeps its
boundary unavailable and its motion authority retained.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-action-gate-owner-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-action-gate-owner-check>
```

Four cases use an unallocated production RoboDojo device, actual OS resource
locks, original request scope/ActionSpec, source-file reads and OS pipes. They
cover cancelled/concurrent stop waiters, actual stop deadline expiry, original
FileNotFoundError with a closed-owner stop error and original FileNotFoundError
with a stop deadline error. Every boundary remains unconfirmed; diagnostic
leases release only after owner drain. The original input retains its SHA-256.
There are zero inference tickets, returned actions, stop acknowledgements,
model calls, native environment allocations and unobserved loop errors.
Evidence: `.local/work/v1-shared-failure-action-20261008-final-02/acceptance.json`.
These checks validate stop ownership and production failure aggregation;
loaded dispatch/resume/device confirmation remain native campaign gates.

Frozen `8fbd934` passes four ActionGate and four Session resource cases, ten
actual client/host processes and full project checks under isolated Linux
Python 3.12.14. All source hashes and complete ActionGate/Session reports match
their macOS originals; nested receipt text retains each original cause.
The canonical checkout status remains unchanged and GPU jobs remain zero.
Evidence: `.local/work/v1-cpu-source-20261008/linux-action-error/`; archive SHA-256
`4a7245bf6dba5e3b6b1bfd76c8728c354473561489f3e2d6af458d1d387a9e64`.
This identifies the verified source revision; shared failure handling
has its additional checks below.

## Shared rollout failure handling

`ActionGate.stop_after_failure` owns failure-time stopping for actual action,
resume, PolicyRollout and Worker paths. It preserves both original exceptions
when stopping fails, retains an already active stop reason and propagates an
existing error group when it already contains that same stop exception.
PolicyRollout shutdown attempts device stopping and policy closure, then
propagates their original single or grouped errors.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-rollout-failure-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-rollout-failure-check>
```

Three actual CPU cases use the original RoboDojo scope/ActionSpec, production
PolicyRollout/WebSocketPolicyClient/Worker, an unallocated production device,
OS resource leases and actual source-file/pipe operations. The policy cases
connect to a bound, non-listening local TCP port. The original connection
failure comes from the actual client and accompanies closed-owner or stop-deadline
failure. Operating systems may report ConnectionRefusedError or the client's
actual TimeoutError; the report retains its observed type and traceback.
The Worker case executes its original closed-owner path and publishes one scoped
background fault with both errors. Every boundary remains unconfirmed and motion
authority remains retained until diagnostic owner drain. All diagnostic threads,
sockets and leases release. The cases perform two actual connection attempts and
issue two admitted inference tickets; there are zero model/policy-server calls,
environment allocations, actions and stop acknowledgements.
macOS evidence: `.local/work/v1-rollout-failure-20261008-03/acceptance.json`.
The four ActionGate cases additionally verify repeated error-group identity.
Current resource/client/host reports are under
`.local/work/v1-shared-failure-session-20261008-final/`,
`.local/work/v1-shared-failure-client-20261008-final/` and
`.local/work/v1-shared-failure-host-20261008-final/`.
Loaded model, simulator observation/control and SDK stopping remain native gates.

Frozen `2ae6eaa` passes full project checks and all twenty-one affected cases
under isolated Linux Python 3.12.14: four ActionGate, four Session resource,
three rollout/Worker and ten actual client/host process cases. Thirty-eight
source-hash comparisons match macOS, with identical ActionGate/Session reports
and complete original fault receipts. Linux reports ConnectionRefusedError for
its two TCP attempts; macOS reports the client's actual TimeoutError. Both
preserve their original trace and stop error. Canonical checkout status remains
unchanged. Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-shared-failure/`; archive SHA-256:
`1f44d790a234c38307cc393fd96735f33201f40b43276449f0aa34d2f5c7e0dd`.
All GPU/model/policy-server/environment/action/stop-acknowledgement counts are zero.

## Native device owner lifecycle

[native_device.py](../../harness/physical-runtime/src/physical_harness/execution/native_device.py)
owns queued simulator operations and a single shared shutdown task. Caller
cancellation preserves the actual thread operation. Close rejects new admission,
drains existing work and publishes the closed state after executor shutdown.
Repeated or concurrent callers receive the same completion or original aggregate
error. Queued binding, stop and resume operations recheck closure after their
owner-thread barrier before publishing a result.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-native-device-owner-offline.py \
  --output .local/work/<new-native-device-owner-check>
```

The diagnostic uses the production RoboDojo adapter in its unallocated state,
actual source files and OS pipes. It performs no reset, SDK initialization,
observation, policy inference or control. Six cases verify original source reads,
cancelled operation/close waiters, three concurrent close callers, original late
FileNotFoundError propagation and shutdown during queued bind/stop/resume barriers.
Every case confirms an absent executor thread and empty operation records.
Closing barriers produce no stop acknowledgement. There are no unobserved loop
errors, GPU jobs or environment allocations. macOS Python 3.14 evidence is
`.local/work/v1-native-device-owner-20261008-final/acceptance.json`.
Loaded SDK lifecycle and device confirmation retain their separate native gates.

Frozen `3f2a7ee` passes the same six cases and full project checks under isolated
Linux Python 3.12.14. All four source hashes and complete result payloads match
macOS exactly. Canonical checkout status remains unchanged; GPU jobs remain zero.
Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-native-device/`; the archive SHA-256 is
`db37d77993a66fd1c6c2faaf01eee55bd5336077e91b687235c3b31e6d3af538`.

## Native Session resource closure

Native operation error receipts retain their existing `type` and `message`
fields. Grouped failures use Python's standard `TracebackException` formatter
with local-variable capture disabled and complete group depth/width. Every
original nested failure remains visible in the message. Single failures retain
their original text. The actual resource diagnostic also validates these
production receipts, JSON round trips and each original error type/message.
Current macOS receipt evidence:
`.local/work/v1-shared-failure-session-20261008-final/acceptance.json`.
Nine actual client-process cases retain their original scoped errors and release
outcomes in `.local/work/v1-shared-failure-client-20261008-final/acceptance.json`.

[worker.py](../../harness/physical-runtime/src/physical_harness/execution/worker.py)
owns a shared explicit Session-close operation. Cancellation of a caller leaves
task stop/drain and resource finalization owned by that operation. Communication
termination joins an existing Session close; otherwise it drains policy/stop/pump
work and checks motion-resource release before finalization. Device and recording
finalizers share a separate operation. Both execute, and every original failure
propagates. An uncertain motion boundary retains its resource authority.

The CPU check requires the package's `robodojo` and `recording` extras:

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-native-session-owner-offline.py \
  --output .local/work/<new-native-session-owner-check>
```

Four cases exercise the actual Worker, unallocated RoboDojo device, OS pipes and
empty recording journals: normal release, actual late FileNotFoundError, actual
IsADirectoryError during manifest publication and both original errors together.
Cancelled/concurrent close and disconnect callers retain shared result identity.
Every device thread and recording journal closes; failed manifest publication
remains failed. There are zero camera frames, model calls, controls or environment
allocations. This validates resource finalization without simulating an execution
or publishing device evidence. macOS evidence:
`.local/work/v1-native-session-owner-20261008-final/acceptance.json`.
The nine real client-process cases and the original RoboTwin missing-source host
path also pass against the current Worker. Native SDK/pump/device-boundary
integration still requires the consolidated loaded-provider campaign.

Frozen `8486afd` passes full project checks, four Session resource cases, six
device-owner cases, nine actual client processes and the missing-source host
path under isolated Linux Python 3.12.14. The complete Session/device reports
match macOS exactly; all sixteen client/host source hashes match their originals.
The canonical remote checkout retains its before/after status. No GPU, model,
policy or native environment starts. Verified reports are under
`.local/work/v1-cpu-source-20261008/linux-native-session/`; the archive SHA-256 is
`79cc8868d9d618ef941aacf5ecf57d97060dc598d7ebd4b0d97a38fececac53b`.

## Native Console process ownership

Workspace and single-provider CLI entries share
[console-process.ts](../../apps/server/src/console-process.ts). The workspace
installs signal handlers before asynchronous configuration; both CLI forms
install them before server initialization.
SIGINT/SIGTERM requests during initialization are retained until resource ownership
is established. Server shutdown and proxy disposal share one operation, including
repeated requests; startup errors retain their original cause after cleanup.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-startup-offline.mjs \
  --config /absolute/path/original-native-workspace.json \
  --output .local/work/<new-native-startup-check>
```

The diagnostic starts the actual configured native CLI with CUDA invisible.
Three writer-lock-triggered cases send SIGTERM, SIGINT and repeated signals after
observing the production journal's writer initialization. Their reports retain
whether the URL was observed before signalling and before exit. Two HTTP-ready
cases inspect actual configuration before single/repeated signals. The report
records the actual observed readiness at both milestones.
The file watcher remains attached throughout initialization. Startup waits use
the shared bounded cancellation helper, and diagnostic cleanup waits for child
exit. Every outcome preserves stdout/stderr before propagating the original
failure, including any process-release failure.
All five require exit status zero, released writer locks/listeners and absence
of both owned Node processes. Original configuration and implementation hashes
remain unchanged. No model call, policy call, Session or environment is admitted.
The workspace output is
`.local/work/v1-native-startup-owner-20261008-current/acceptance.json`.
Repeat with `--provider robodojo`, `robotwin`, `robocasa` or `behavior` and a new
output directory to exercise its actual standalone entry. All twenty provider
cases also pass. Their source-bound outputs are
`.local/work/v1-native-startup-<provider>-20261008-final/acceptance.json`.

Two additional actual CLI invocations encounter the running Console's occupied
writer or port. Both fail with exit status one, preserve the existing owner and
HTTP service, and leave no candidate process group. The port-conflict invocation
releases its own writer; closing the original Console releases its writer and
listener. Original configuration bytes remain unchanged. Evidence:
`.local/work/v1-native-startup-owner-20261008-current/conflicts/acceptance.json`.

Frozen `f52fc28` passes full project checks and all twenty-five entry cases on
isolated Linux with Node 24.21.0, pnpm 11.19.0 and the Python 3.12.14 CPU environment.
Each implementation/model/provider configuration hash matches its macOS source.
All six original configuration sources retain their bytes; only the
diagnostic workspace's path references identify the isolated source and private
output locations. The canonical server checkout's before/after status is identical.
No model, policy, environment or GPU work executes. Retained reports and the
verified summary are under `.local/work/v1-cpu-source-20261008/linux-startup/`.
The complete evidence archive SHA-256 is
`126e561418fc228d596a8c64e5c24edde06caf97e8842ef023cd7685d07a9b13`.

## Native scene and configuration ownership

Native deployment and workspace readers share `nativeConsolePortSchema` from
`native-deployment-configuration.mjs`. JSON ports are integer numbers from
1 through 65535, with omitted-provider defaults and mandatory workspace ports.
RoboCasa's nonblank numeric-string environment override uses the same range;
invalid configured fields reject before override selection or resource allocation.
The existing scene diagnostic additionally checks original four-provider Console
configuration and preserves all model, Team, checkpoint and worker bindings.

On 2026-10-13, eighty-one Console port cases pass: twenty-five admissions and
fifty-six rejections, including JSON type/range checks, defaults, workspace
requirements and provider-scoped environment overrides. Independent production
readers repeat every case, verify sixty-six declared JSON derivatives and compare
fifteen source identities. Derivative workspace paths resolve to the unchanged
original model/provider files. No worker, model, policy, environment or GPU starts.
The configured forty-component campaign passes 1,508 CPU cases and 858 independent
source/input comparisons, with original records unchanged and every owned process
group/writer released. Evidence:
`.local/work/native-console-port-cpu-final-20261013/scene-configuration/independently-verified.json`
and `.local/work/native-console-port-cpu-final-20261013/independently-verified.json`.

Exact source `88f1099` matches all 157 campaign production/checker files. Isolated
Linux executes the same original-file diagnostic and independently repeats all
eighty-one Console port cases, with sixty-six declared derivatives and fifteen
source identities. Every Console result matches macOS. Six original model/provider
input files retain their bytes, configuration paths relocate explicitly, the
runner exits, isolated source remains clean and canonical server changes remain
unchanged. Nine captured Linux production files match the commit. Evidence:
`.local/work/native-console-port-linux-verified-20261013/local-independent-verification.json`.
Its archive SHA-256 is
`5ae7a1a5a07d7dd50a436b240d0e4f4aba2690672098ab89db8b75826806b571`.

Ubuntu CI `38376212894` at the same source passes fresh installation, complete
source checks and 78 production runtime cases. Downloaded artifacts independently
match 89 exact-source comparisons, 41 inputs, fourteen distributions and thirteen
imports. Production readers preserve seven task-plan journals and 338 retry events
in 22 native Sessions, with 56 genuine failed connections, zero provider responses
and released writers. Fifteen previously executed installed-SDK sources match
this commit; their original-request/prepared-tensor scope remains unchanged.
Evidence: `.local/work/ci-native-console-port-inspection-20261013.json`,
`.local/work/ci-native-console-port-plans-independent-20261013.json`,
`.local/work/ci-native-console-port-native-independent-20261013.json` and
`.local/work/current-sdk-console-port-source-20261013.json`.

[native-worker-configuration.ts](../../apps/server/src/native-worker-configuration.ts)
owns the schema and its derived `NativeWorkerConfiguration` type. Scene parameters
use Zod's recursive JSON schema: finite scalars, arrays and objects. The environment
factory receives a detached, recursively frozen admission snapshot with its
validated task catalog and policy endpoint, before preparation or process creation.
The host's optional process-start callback remains outside scene data.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-scene-configuration.mjs \
  --config /absolute/path/original-native-workspace.json \
  --output .local/work/<new-native-scene-check>
```

Four original configured scenes preserve their parameters and JSON round trips.
Caller mutation of command, environment, scene and catalog leaves the admitted
snapshot unchanged; direct writes to that snapshot fail. Forty-eight scene cases
reject positive/negative numeric overflow, nested overflow, NaN and unsupported
JavaScript values through both the schema and production environment factory.
Every issue identifies `sceneConfiguration`. No Worker process, environment or
inference starts, and the production image context disposes. Original source
hashes remain unchanged. Local evidence:
`.local/work/v1-scene-json-owner-cpu-20261008-current/acceptance.json`.

The worker host diagnostic also accepts `--mutate-caller`. After invoking the
actual environment factory, it changes the caller's command, working directory,
Python environment, source path and scene before asynchronous startup resumes.
The actual CPU Worker still uses its original admission: its genuine missing-SDK
source error returns intact, close is confirmed and its process/image context
release. Both BEHAVIOR and RoboTwin pass with CUDA invisible in
`.local/work/v1-worker-host-caller-<provider>-20261008-current/acceptance.json`.
This checks initialization ownership without allocating a native simulator.

Frozen `f365135` passes the same scene/admission and caller-mutation checks,
four-provider readiness and full project checks on isolated Linux. Every original
scene, rejection and implementation/provider hash matches its macOS report; only
the private workspace's path references change. The canonical server checkout's
before/after status is identical. Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-scene-owner/`; the archive SHA-256 is
`880ce01308396e7691ee5733539d318df468e1e8849f4d04681cc5f308e1c01b`.

## Native Worker startup observer ownership

The transport's asynchronous `NativeWorkerTransport.create` establishes pipes,
listeners and process ownership before calling the configured host observer.
Initialization waits for synchronous or asynchronous observer completion. Observer
failure closes the actual Worker and confirms process-group release before the
original error returns. Cleanup failure retains both errors.

The [client diagnostic](../../scripts/check-worker-client-offline.mjs) exercises
eight actual CPU process cases: the existing communication/cancellation/deadline
cases, successful asynchronous startup-file publication and synchronous/asynchronous
startup reads of an absent file. The latter preserve actual ENOENT errors and
require the owned process/group to be absent when creation rejects. No initialize
request, SDK allocation, inference or controls execute in the observer cases.
Evidence: `.local/work/v1-worker-startup-observer-20261008-final/acceptance.json`.

The [host diagnostic](../../scripts/check-worker-host-offline.mjs) accepts
`--startup-file-error` and optional `--async-startup` to exercise the same file
failure through the production environment factory and configuration schema.
Both paths preserve the original error and release their actual process/group,
image context and empty policy-record directory. The local reports are under
`.local/work/v1-worker-startup-host-sync-20261008/` and
`.local/work/v1-worker-startup-host-async-20261008/`.

Frozen `4a3fc5d` passes the eight client cases, both observer-error host cases,
both caller-mutation host cases, finite-scene admission, four-provider readiness
and full project checks in isolated Linux dependencies. All forty-three
implementation/provider hash comparisons across the five process reports match
their macOS reports. The canonical checkout's before/after status is identical.
The reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-worker-observer/`; the archive SHA-256 is
`2c012c161e99f28c11300ba940f6b5c2c587c693d07034c8ccdbaac444e5285e`.

## Native finite-JSON request admission

The host transport validates request envelopes before serialization, timer
creation or pending-request publication. Operation names contain one to sixty-four
characters with nonblank content; arguments contain recursively finite JSON data.
Successful response values use the same JSON domain before request retirement.

The client diagnostic's ninth case rejects twelve unsupported argument values
and seven invalid operation values synchronously. Its actual CPU Worker remains
connected, returns the original error for a valid unknown operation and confirms
clean close. The other eight process cases continue to pass. Evidence:
`.local/work/v1-worker-finite-json-client-20261008/acceptance.json`.

The [initialization interruption diagnostic](../../scripts/check-native-worker-disconnect.ts)
waits for the actual process-start observer, signals that owned process and inspects
the original initialization/cleanup errors. It requires process/group absence;
device/resource confirmation remains unknown following the interrupted transport.
If initialization returns an environment, the diagnostic owns its close. Its
output retains configuration and implementation hashes and requires a new file.
Actual RoboTwin-configured CPU startup interruption passes in
`.local/work/v1-worker-initialize-interrupt-20261008/acceptance.json`: the owned
process/group is absent, original initialization and release errors retain their
shared identity and device/resource state remains unknown. The diagnostic
configuration disables CUDA and names an absent SDK source directory.

Frozen `f22f0af` passes all nine client cases, four host cases, initialization
interruption, finite-scene admission, four-provider readiness and full checks on
isolated Linux. Forty-seven implementation/provider comparisons match their
macOS reports; the interruption retains unknown device/resource state and absent
owned processes. Canonical checkout status remains unchanged. Reports and verified
summary are under `.local/work/v1-cpu-source-20261008/linux-worker-json/`.
Archive SHA-256:
`8d8b62d1a30b777c38b4c67287d2732f2a1b2cffe73c48f2b0d1f0cfc937da62`.

## Native diagnostic entries

All nine `scripts/**/*.ts` entries participate in the project TypeScript check,
and `format:check` includes TypeScript diagnostics. RoboCasa worker and metric
entries await the current `describeTasks({ signal })` API and select the configured
`nativeTaskId`. They own the image context and admitted environment throughout
startup, task checks and release. Results publish after all owned cleanup stages;
task/cleanup/output failures retain their original errors, and new output files
are required. A rejected allocation retains unconfirmed environment-resource state.

Both actual RoboCasa CLI entries pass their policy-endpoint preallocation failure
check with production configuration, an original recorded request and CUDA
invisible. They preserve field-specific Zod errors, dispose the image context,
publish failed results and exit with status one. No Worker, SAM service, model,
simulator or controls execute. Original input and entry-point hashes remain
unchanged. Evidence:
`.local/work/v1-casa-entry-admission-20261008-final/acceptance.json`.

The scene/configuration diagnostic additionally checks fifteen invalid policy
endpoint values across four original profiles. All sixty fail schema and factory
admission with `policyUri` issues and zero Worker starts; original valid endpoints
remain unchanged. URL syntax validation completes before protocol/credential/
fragment checks. The same invocation preserves its forty-eight finite-scene
rejections and admitted snapshot checks. Evidence:
`.local/work/v1-endpoint-scene-admission-20261008/acceptance.json`.

Frozen `9d15198` passes full project checks with all nine TypeScript diagnostics,
the forty-eight scene and sixty endpoint rejections, four-provider Console
readiness, both actual RoboCasa entry failures and all nine client process cases
on isolated Linux. Every scene/error result and all twelve CLI/client source
hashes match the macOS reports. Original scene/deployment/implementation hashes
also match; only private workspace path references change. Canonical server
checkout status is unchanged. No GPU/model/simulator work executes. The verified
summary and reports are under
`.local/work/v1-cpu-source-20261008/linux-diagnostic-entry/`.
Archive SHA-256:
`f77af3406c326a926aaee558f77ed5cf8bc020219556818a548896177f9df57a`.

## Native context and scope ownership

Selected DSH `token-meter` source belongs to `harness/agent-runtime/memory`,
alongside its context installer and compaction services. Native registration
scope primitives belong to `harness/agent-runtime/foundation`, shared by Agents,
Sessions and tools. Their original import names and all selected source hashes
remain unchanged. Type aliases, provenance destinations and workspace dependencies
describe the same ownership.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-context.mjs \
  --data-directory /absolute/path/original-native-journal \
  --data-directory /absolute/path/another-original-native-journal \
  --output .local/work/<new-context-check>
```

The reader opens private copies of actual simulation or hardware journals through
LocalStore and SessionAudits. The production DSH host installs context services
without model bindings. Independently scoped native Sessions retain each original
event prefix and provider usage. Full and prefix reads verify stable, detached
measurements, isolated replay state and the native usage/pressure/composition
projections. Creation and disposal events reach only their own registration scope;
every attached Session and scope releases before host disposal. Model-free image
pressure uses the native fixed heuristic, recorded explicitly in the result.

On 2026-10-08, two original RoboDojo/RoboTwin journals pass with nine native
assignments, 392 original events, 60 original tool calls and 24 prefix reads.
The source journals and restored events retain their hashes. No tool calls are
replayed, and no model, policy or environment is allocated.
Evidence: `.local/work/v1-context-ownership-cpu-20261008-02/acceptance.json`.
The original RoboDojo journal also passes nine interrupted-call recovery prefixes
through the selected DSH recovery functions without replaying physical dispatch.
Compaction summaries and route-specific image pricing keep their model-driven
acceptance requirements.

The configured four-provider Console also passes factory/Team/profile/model
readiness with this source organization. Its actual HTTP reader returns RoboDojo,
RoboTwin, RoboCasa and BEHAVIOR metadata, then releases its journal writer and
listener with zero managed service processes. Evidence:
`.local/work/v1-context-readiness-20261008/readiness.json`.

Frozen `4391298` source passes the same context/recovery readers and full project
checks on Linux with isolated Python 3.12.14, Node 24.21.0 and pnpm 11.19.0.
All nine assignments, 392 events, 60 original tool calls and 24 prefix reads
match the local source-journal hashes and measurement/projection values.
Implementation hashes match the current module sources. Both registration scopes
and every attached Session release; the original server checkout's before/after
status is identical. No model, policy or environment is allocated.
The server-retained complete archive has SHA-256
`df0f973f61c109bf566a033f157a4698277db5a57bcaa2dd2dc6db0da9656fdb`.
The downloaded check/source/ownership summary is under
`.local/work/v1-cpu-source-20261008/linux-context/`; its source archive
`cpu-context-summary.tar.gz` has SHA-256
`ddbe38fd5eb67286d20ab60fe975cba13ac60bd760db9305487322745fc1045c`.

## Native visual-context admission

[check-recorded-visual-context.mjs](../../scripts/check-recorded-visual-context.mjs)
reads private copies of original native journals through LocalStore and
SessionAudits. A production DSH host mounts its native loop, token meter and EDH
visual-history policy with automatic summaries disabled and no registered model.
Each case creates two independently scoped Agents with the same original history.
Only one Agent receives an exact original text or three-image message as follow-up.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-visual-context.mjs \
  --data-directory /absolute/path/original-native-journal \
  --data-directory /absolute/path/another-original-native-journal \
  --output .local/work/<new-visual-context-check>
```

Two original RoboTwin journals supply 226 events, nine/twelve retained original
image blocks and actual text/image messages. Six cases verify text-only
continuation, fresh observation and an over-budget fresh batch through native
pre-step admission. A six-image budget retains complete groups and reserves all
three incoming views. Each omitted group records its exact original attachment
IDs and source/replacement sequences. Original audit events and admitted incoming
messages remain unchanged. Restoring actual generated events reproduces the
surface and token measurements; each measurement identifies its own log revision.
A three-image batch under a two-image budget fails before surface changes.

The native driver retains its actual missing-provider/model error after otherwise
valid pre-step admission. No successful response is supplied. Every sibling context
remains unchanged, all twelve Agent/Session contexts release, source journal hashes
remain unchanged and original tools are never replayed. Source-bound event files
and reports are under `.local/work/v1-visual-context-20261008-final/`.
GPU/model/policy/environment allocations are zero. Model-driven summaries,
adapter image resolution and fresh tool-image delivery retain their native gates.

## Configured native startup

```sh
EDH_NATIVE_WORKSPACE_CONFIG=/absolute/path/native-workspace.json pnpm start
```

The production command loads the configured native workspace and its existing
factories. Missing configuration fails with the exact
`EDH_NATIVE_WORKSPACE_CONFIG` field before server allocation. On 2026-10-08,
the actual command starts the configured four-provider Console and serves its
profile/model/Team metadata with zero Sessions, model calls or managed services.
SIGTERM closes the journal writer, listener and both owned Node processes with
exit status zero. Evidence:
`.local/work/v1-native-start-cpu-20261008/acceptance.json`.
This is configured application startup/shutdown acceptance; task execution
retains the native campaign's requirements.

## Model-visible tool schemas

`harness/agent-runtime/tools/src/model-schema.ts` owns production parameter
generation and canonical domain projection. The server, role-workflow checker
and original plan reader use its public exports. Each assignment's parameters
are detached from canonical core fields and caller-supplied plan/role schemas.
Native DSH continues to register, dispatch and validate these tools.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json --test tests/runtime/model-tool-schema.test.ts

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-tool-schemas.mjs \
  --requests /absolute/path/original-model-requests \
  --descriptions /absolute/path/original-tool-source.json \
  --output .local/work/<new-tool-schema-check>

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-plan-writes.mjs \
  /absolute/path/original-replay-directory
```

Three CPU checks cover required canonical nested plan fields, isolated mutable
parameter results and decision-owner-only execution.query turn completion.
The recorded-request reader checks native DSH schema validity, original tool
descriptions, separate Planner/Verifier authority and exact canonical plan structure.
It also verifies independent parameter edits against each original planning header.
Original request, description and schema sources retain their hashes; implementation
hashes identify the production module and reader. No model call or physical effects
are replayed. The plan reader uses this same production parameter builder before
checking original calls, formal verdicts and versioned writes.

On 2026-10-08, 16 original Qwen requests pass with 344 checked schemas: twelve
Planner requests and four Verifier requests, including twelve canonical planning
headers. Evidence: `.local/work/v1-tool-schemas-cpu-20261008-final/acceptance.json`.
Original task histories `ef8f9d03`, `686c9767` and `7dfb663e` preserve ten accepted
object-valued plan writes, eight rejected string-valued writes and thirteen
read-only templates. Their new private journals are under `.local/checks/recorded-plans-*`.
The plan reader also applies production TaskGoals admission before each original
plan write and checks all seven original execution requests against the preceding
committed plan, ready dependencies, owner, per-goal attempt limit, criteria,
entities, capabilities and budget. Event/run source hashes remain unchanged.
These checks establish CPU schema/record behavior. Current-code model-driven
multi-goal and simulator completion require their actual native acceptance.

`TaskPlans` is exported from `planning/src/index.ts` and implemented in
`planning/src/plans.ts`. `PlanOwner` and `PlanWrite` describe its actual public
method inputs/results. Stored-plan reads validate the canonical PlanDocument,
requested task identity and record/document version before producing a result
or next write template.

On 2026-10-11, the original-record reader passes four task histories: RoboTwin
retry `686c9767`, custom-role task `ef8f9d03`, packaged Desktop task `bd3e1606`
and failed RoboCasa task `e7f385ad`. The current implementation admits thirteen
original plan writes and nine original execution requests, and verifies seventeen
read-only write templates. Each original first plan also supplies six private
storage cases: unchanged original, foreign task, document-version mismatch,
storage-version mismatch, unsupported schema version and duplicate goals.
All twenty-four read cases preserve their journals; invalid records reject both
plan reads and next-write templates. Three actual writer open/close cycles per
task check the final plan before and after compaction, preserving its version.
Six derivative writers per task also release their locks.

Independent inspection verifies 68 implementation/original-source/derivative-journal
digest comparisons, all four compacted plans against their original final plan
events and 28 released writer paths. Final-plan inspection leaves the compacted
journals unchanged. Original failed/passed verdicts remain unchanged. Nine source
identities per report bind the production service, goal admission, tool parameter
builder, canonical schema/validator, store and diagnostic. No model, simulator,
GPU or physical control allocates. Reports are under
`.local/checks/recorded-plans-E7D6Mv/`, `.local/checks/recorded-plans-phDYia/`,
`.local/checks/recorded-plans-rZOYwm/` and `.local/checks/recorded-plans-kGwjca/`.
Independent results:
`.local/work/plan-admission-independently-verified-20261011.json`.

The same schema tests, original request inspection and original custom-role plan
reader pass on Linux from committed `6488510` source. Its isolated Python 3.12.14
environment and Node 24.21.0/pnpm 11.19.0 workspace use frozen dependencies.
Full `pnpm check` passes, including 58 Python compilations, 19 base imports,
128 pinned DSH files, 25 source bindings, ten Teams and 868 documentation links.
The canonical server checkout has identical before/after Git status. No native
environment, model inference or controls are allocated. Retained output is
`.local/work/v1-cpu-source-20261008/linux-tools/`; the original
`cpu-tools-evidence.tar.gz` has SHA-256
`636f0b8a07a3d5763beabff7f68a0fe1807408080e4edbb1c3337db8785d18f7`.

The actual four-provider Console also passes readiness at that source revision
in `.local/work/v1-tools-readiness-20261008/`. Configured Teams, models, policies,
checkpoints and RoboDojo Tower prerequisite checks retain their original bindings.
Shutdown releases the journal writer and listener with zero managed processes.

## Policy transport

Install the `policy` and `diagnostics` extras in the isolated Python environment.
Supply an original canonical request and original policy audit journal:

```sh
.venv/bin/python scripts/check-policy-transport-offline.py \
  --request /absolute/path/original-policy-request.json \
  --telemetry /absolute/path/policy-audits/events.jsonl \
  --schema harness/contracts/schema/physical.schema.json \
  --output .local/work/<new-policy-check>
```

The check reads JSON Lines through its declared library. It checks the original
codec contents, telemetry scope/Session/sequence and source hashes. A production
EDH policy server forwards the actual request to an unavailable local endpoint;
the observed connection failure must reach the client as a generic inference
error. Authentication, discarded connections and listener shutdown are checked.
No action result is supplied by the diagnostic.
The production recorder also saves the exact original request, checks private
POSIX file permissions and rejects an actual second write without changing the
stored content. Recorder source and original record hashes remain unchanged.

The same production decoder serves client responses and server requests. Its
standard JSON numeric hooks reject NaN/Infinity constants and overflowing
floating-point tokens; duplicate-field rejection applies inside nested objects.
Seven malformed messages pass direct rejection and actual authenticated server
rejection with close code 1011, generic public errors and zero inference admission.
Each exact rejected wire body and SHA-256 remains in the diagnostic output.
The original finite request still round-trips and records exactly; all 95 original
telemetry events retain their scope and sequence. Current macOS evidence:
`.local/work/v1-policy-json-transport-20261008-bounded/acceptance.json`.
The report binds codec, server, recorder, diagnostic and original source hashes.
These checks return no policy actions or model results.
The finite codec's current source also passes four client-close cases, nine
inference-owner cases and three rollout/Worker cases under
`.local/work/v1-policy-json-client-20261008/`,
`.local/work/v1-policy-json-inference-20261008/` and
`.local/work/v1-policy-json-rollout-20261008/`. Full project checks pass.

Frozen `da0b17f` passes all twenty-three affected cases and full project checks
under isolated Linux Python 3.12.14. Thirty-one original/source hash comparisons
match macOS, including all seven exact rejected wire bodies. Actual service logs
retain seven decoder errors and one original TCP connection error with tracebacks.
Normal close, caller drain, thread ownership and resource release checks agree
across both systems; the original TCP exception retains its platform-specific type.
The canonical checkout status remains unchanged, with zero GPU/model/environment
allocation or control. Evidence and verified summary:
`.local/work/v1-cpu-policy-json-20261008/linux/`; archive SHA-256:
`ca8d6ae8b0548b11d2872f762746d5f03278031b72acb8a63fe67090ec4862a2`.

On 2026-10-07, 95 original telemetry events across three policy requests pass.
The actual upstream connection times out, both clients discard their connections,
the authenticated server rejects unauthorized admission and its listener closes.
Evidence: `.local/work/v1-policy-transport-offline-20261007-02/acceptance.json`.

## Policy service startup

Production startup and audit implementations belong to
[`physical_harness/policies/services`](../../harness/physical-runtime/src/physical_harness/policies/services/README.md).
Five example scripts import the corresponding production `main` functions;
the same services also run through `python -m physical_harness.policies.services.<module>`.
Direct source comparison verifies preserved service logic with declared import/
repository-root changes. Example and module functions have identical identities,
root resolution is unchanged, and original schema/manifest bytes remain exact.
Base import checks include all six service-package modules without SDK imports.

All twenty-four actual macOS startup cases and nine inference-owner cases pass
after this migration. Both entry forms preserve help, occupied-port rejection
before model loading, the named missing-checkpoint error, original listener
ownership and reusable bound ports. Actual listener checks retain their original
request and network error. Original-source/module verification covers all five
services. Evidence: `.local/work/v1-policy-service-ownership-20261008/`,
`.local/work/v1-policy-service-startup-20261008/` and
`.local/work/v1-policy-service-inference-owner-20261008/`. No model SDK, model result,
environment or GPU is supplied. Loaded startup/inference and device/task behavior
retain their native release requirements.

Clean `441b17e` passes the same twenty-four startup cases, nine inference-owner
cases, original-source/module comparison and full project checks on isolated
Linux using Python 3.12.14, Node 24.21.0 and the complete frozen lock. Independent
comparison verifies thirty-two source/input hashes and matching CLI admission,
exit, listener and thread-closure results. Every platform preserves its actual
network errors. Original source/schema/manifest data and five function identities
match. The canonical server checkout retains its exact status and the isolated
source remains clean. Evidence and independent summary:
`.local/work/v1-policy-service-ownership-linux-20261008/`; archive SHA-256:
`3a4a292da43576b4b855cbd7d01d8219aea70fab76c3ebef9bef4a1442a5849d`.

The four EDH JSON service entries reserve their configured port before checkpoint
or upstream initialization and before importing their optional model SDKs.
They use `serve_policy(..., start_serving=False)` and the actual WebSocket Server's
asynchronous context manager. `policies/listener.py` reserves exclusive TCP
listeners with a backlog of 100 while WebSocket handlers remain unstarted.
A queued TCP connection provides no completed WebSocket handshake or inference.
`server.start_serving()` opens WebSocket admission
after the selected policy is ready. Startup failure closes the bound listener;
normal shutdown closes connections/listeners and drains the inference owner.
The OpenPI JSON bridge also closes its actual upstream connection. Ready metadata
reports the actual bound port, including a deployment-selected ephemeral port.
The default `start_serving=True` remains available for ready inference callbacks.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-policy-startup-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --python .venv/bin/python \
  --output .local/work/<new-policy-startup-check>
```

Install the base package and `policy` extra in the isolated Python environment.
Fifty-six actual subprocess cases cover ten example/module help commands,
ten occupied ports, ten initializing-policy ports, eight missing-checkpoint failures, two native missing-inventory
failures, six native invalid-port rejections and ten malformed selected-digest
rejections. Existing listeners retain actual connection
acceptance after each candidate exits; failed-startup ports become reusable.
Help completes without optional SDK imports, including the native OpenPI producer.
The native producer validates its fixed port in `1..65535` and reserves its
exclusive listening loopback socket before checkpoint/SDK startup. The actual OpenPI
server uses that same socket after readiness, retaining its inherited inference
handler, codec and health check. Startup errors release the reserved port.
The producer verifies the complete
pinned checkpoint and writes the verification report before SDK imports. The
diagnostic checks named missing-file errors and exit status 2 for invalid ports,
with no verification report after rejection. Loaded producer readiness and model
inference retain their native requirements. Six actual reservation cases cover
JSON/native cross-service ownership, two concurrent JSON starts and original
native source-file failure. The production JSON server also restarts on its
original port after actual request traffic. Ready checks require HTTP JSON or a
completed WebSocket handshake; the reserved TCP backlog supplies no readiness result.

On 2026-10-13, macOS passes all fifty-six CLI processes and six reservation cases,
with nineteen executable/schema source identities, the unchanged original request,
rejected pre-readiness handshake and actual same-port restart after request traffic.
Evidence: `.local/work/policy-listener-startup-cpu-20261013-03/acceptance.json`.
This scope allocates no model, environment or GPU.

The current configured macOS campaign passes forty-five components and 1,623
cases. Independent inspection verifies 1,030 source/input/link comparisons,
unchanged original journals/images and release of every diagnostic process group.
Full source checks compile 75 Python files, import 30 base modules and verify
1,433 local documentation links. Evidence:
`.local/work/policy-listener-foundation-cpu-20261013-02/independently-verified.json`.

Exact source `1c632ba` matches all 196 campaign production/checker/package files.
CI `38415631866` passes complete source/installation checks, 97 runtime cases and
the Team admission matrix. Downloaded evidence independently matches fourteen
distributions, fourteen import origins, 41 input identities and 99 exact-source
comparisons. Uploaded/reconstructed fields and all input/checker hashes match.
Fifteen previously executed policy processor files retain their exact source
bytes without reruns. Evidence:
`.local/work/policy-listener-foundation-cpu-20261013-02/committed-source-verification.json`,
`.local/work/ci-policy-listener-consolidated-independent-20261013.json` and
`.local/work/current-sdk-policy-listener-source-20261013.json`.

The same sixty-two policy and three Console startup outcomes pass on isolated
Linux at `1c632ba`. Independent raw-file inspection checks 29 distinct committed
sources, 76 source comparisons and fifteen archived Console source/input files.
Original request bytes and canonical server changes remain unchanged, isolated
source stays clean and the actual runner is absent. Linux preserves its actual
upstream ConnectionRefusedError, alongside the pre-readiness handshake timeout.
Complete Linux source checks pass with no model, simulator or GPU allocation.
Evidence: `.local/work/policy-listener-platforms-independent-20261013.json` and
`.local/work/policy-listener-linux-receipt-20261013-02/`.

All forty-four entry cases pass on macOS and isolated Linux from clean `43ad63c`.
The report records eighteen executable/schema hashes, including the original
checkpoint provenance and native inventory readers. Named admission outcomes
precede SDK imports and rejected native startup publishes no verification report.
Evidence: `policy-startup/acceptance.json` under the two current campaign directories
listed above.
The [checkpoint binding diagnostic](checkpoint-bindings.md#cpu-validation) uses
actual original artifacts to check computed identity and mismatched-digest
rejection; loaded custom-checkpoint and physical task acceptance remain native gates.

Clean `18b513b` passes all 46 current actual CLI cases on macOS and isolated
Linux. Both native entry forms reject an occupied endpoint before checkpoint/SDK
access and preserve the existing listener. Actual missing-checkpoint/inventory
errors release their selected reserved ports. The same clean Linux source passes
complete original checkpoint identities for all four providers and four native
selected-digest/report-path failures, each confirming its reserved port is reusable.
No model SDK imports during the checkpoint identity check.

The 87 actual installed OpenPI transform cases on twelve original request/native-action
derivatives also pass on that source. Independent verification matches 155
production/checkpoint/input comparisons and confirms 54 actual process releases,
including the startup/native-checkpoint children, diagnostic groups and runner.
Complete checkpoint bytes, original sources and canonical user changes remain
unchanged; frozen source remains clean. JAX stays CPU-only, CUDA stays uninitialized,
and model loads/calls, GPU jobs, simulator allocations and controls remain zero.
Loaded producer connections, model execution and device/task behavior retain
their native requirements.
Local verification matches 39 implementation/manifest comparisons and all report/
archive identities. All 46 CLI admission outcomes match between CPU platforms;
the 87-case actual SDK results and twelve original-request-derived input/control
records remain unchanged after native endpoint integration.

Evidence: `.local/work/openpi-port-cpu-macos-20261009/` and
`.local/work/openpi-port-cpu-linux-20261009-verified/`.
Retained Linux archive SHA256:
`91ea5fdd98625f49388692d4d0b8fc6cd2d701bc640438d712fbd5611bcd7c51`.

The native producer additionally validates its saved ARX X5 state/actions
normalization before optional SDK imports and verification-report publication.
The required fourteen-entry mean/std/q01/q99 arrays contain finite numbers,
nonnegative standard deviations and ordered quantiles. Normalization bytes/hash
match the complete checkpoint inventory. Its recorded identity accompanies the
verification report. The JSON bridge validates its selected digest syntax before
listener/client allocation. See [normalization provenance](../provenance/openpi-normalization.md).

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-openpi-normalization-offline.py \
  --checkpoint /path/to/original/arx-x5-checkpoint \
  --expected-sha256 "$EDH_NORMALIZATION_SHA256" \
  --output .local/work/<new-normalization-check>
```

Eight actual file-admission checks pass on macOS and isolated Linux. The accepted original 3,407-byte
file matches SHA256
`ad7dea3e3d2bcdb348945fe03422ab1adccd03baf67318b1a1d153dfe8694db5` from
the complete original checkpoint inventory. Explicitly declared invalid copies
exercise missing groups/quantiles, incorrect dimensions, boolean/nonfinite
values, negative standard deviations and reversed quantiles; an actual missing
directory exercises file admission. Original input bytes remain unchanged.
Evidence: `.local/work/v1-openpi-normalization-macos-20261008-final/acceptance.json`.
Linux's report is `linux/normalization/acceptance.json` under
`.local/work/v1-cpu-openpi-normalization-linux-20261008/`; its original identity,
declared invalid-copy hashes and source hashes match macOS.
No model SDK, environment or action allocates. These file checks provide no
complete-checkpoint, loaded-policy or physical-task acceptance.

All thirty-four cases and full project checks pass on macOS. The actual original
request/network failure, listener closure and zero-model/device scope retain their
own assertions. Sixteen executable/schema hashes and the original request digest
identify this check. Evidence:
`.local/work/v1-openpi-preallocation-startup-20261008/acceptance.json`.

The clean `653a3ea` consolidated campaign repeats all thirty-four startup cases
on macOS and isolated Linux alongside the other twenty-five CPU components.
Source hashes, actual admission/exit states, listener closure and original input
digests match. On Linux, both native entry forms additionally verify the actual
original eighteen-file checkpoint and fail at a real directory selected as the
verification-output file. The unchanged checkpoint digest is
`fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7`.
Those two cases preserve `IsADirectoryError` before SDK imports and their actual
child processes exit. Evidence:
`.local/work/v1-cpu-openpi-preallocation-linux-20261008/linux/checkpoint-preallocation/acceptance.json`.
This confirms filesystem admission and report failure; no loaded policy result,
service readiness or physical control is supplied.

Actual production listener checks cover bound-but-unstarted admission, explicit
`start_serving`, context-managed source-file failure and an occupied listener.
The started Server forwards the exact original PolicyRequest to an unavailable
endpoint. Its actual network error remains in the log and its generic public
error reaches the client. All connections close and ports become reusable.
macOS observes TimeoutError for both unstarted handshake and upstream access.
No model inference result or action is supplied. Evidence:
`.local/work/v1-policy-startup-20261008-final/acceptance.json`.
The report records ten executable/schema source hashes and the original request
SHA-256 `147d6c1fc75af0589138d1bdd60746a7a45a2876a79e1a78d91cc9df9ccff57d`.
Current-source inference-owner, connection-close and policy-wire checks retain
separate reports. GPU/model/environment allocation and controls remain zero.
Loaded checkpoint initialization, native producer service readiness and complete
task execution require the consolidated native campaign.

Frozen `9b3b4a8` passes all twelve startup cases, four connection-owner cases,
nine inference-owner cases, seven malformed-wire cases, 95 original telemetry
events and full project checks in isolated Linux Python 3.12.14. Thirty-two
original/source hash comparisons match macOS. Linux preserves its actual
ConnectionRefusedError for the unstarted listener and unavailable endpoint;
macOS preserves TimeoutError. All compared admission, release and failure fields
agree. The canonical server checkout retains its exact before/after status.
GPU/model/environment allocation and controls remain zero. Verified summary:
`.local/work/v1-cpu-policy-startup-20261008/linux/verified-summary.json`;
archive SHA-256:
`e4b80ba4ca0865f37c8cd4474ef0aa8d4754f7b257f11ad6513d965fb72335a2`.

Current-source production readiness for all four configured providers and
preparation of eight actual task definitions pass under
`.local/work/v1-policy-startup-readiness-20261008/` and
`.local/work/v1-policy-startup-campaign-20261008/`. These paths perform no task,
model or simulator execution.

## Policy client connection ownership

[`WebSocketPolicyClient`](../../harness/physical-runtime/src/physical_harness/policies/client.py)
owns one actual connection-close operation and one full shutdown operation.
Cancelled waiters preserve those operations. Concurrent callers wait for their
original result; pending or failed connection closure rejects new inference.
Full shutdown drains the captured inference caller and attempts connection
closure, retaining every original failure. Caller-local cleanup may join the
connection operation while external shutdown awaits that caller's complete exit.
Closing from a policy event/tool callback stops subsequent response handling.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-policy-client-owner-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-policy-client-owner-check>
```

Four POSIX cases use real WebSocket connections and a production policy server
in a diagnostic-owned child process. The OS pauses that peer while the client
sends its close frame. Three concurrent close waiters, including one cancelled
waiter, retain the actual closure until the peer resumes. Idle, active inference,
repeated inference cancellation and caller-local cleanup all finish with normal
close code 1000, no retained caller/connection and server exit code zero.
Production recording preserves three original requests and the input SHA-256.
It returns zero policy responses and allocates no model, native environment,
GPU job, control or stop acknowledgement. macOS evidence:
`.local/work/v1-policy-client-owner-20261008-final/acceptance.json`.
Client source SHA-256:
`f5914bd09782e7e18462099265b15ba10a77257a70ed756edb40775f2c4f6266`.

The same client source passes nine actual inference-owner cases in
`.local/work/v1-policy-client-inference-20261008/`, three actual rollout/Worker
failure cases in `.local/work/v1-policy-client-rollout-20261008/`, and production
transport with 95 original telemetry events in
`.local/work/v1-policy-client-transport-20261008/`.
Loaded-policy cancellation and physical stopping retain native acceptance gates.

Frozen `d720790` passes these four client cases, nine inference-owner cases,
three rollout/Worker cases, 95 original telemetry events and full project checks
under isolated Linux Python 3.12.14. Twenty-eight original/source hash comparisons
match macOS. Actual OS-specific TCP failures retain ConnectionRefusedError on
Linux and TimeoutError on macOS; all other compared ownership/release fields match.
The canonical server checkout remains unchanged. Evidence and verified summary:
`.local/work/v1-cpu-policy-client-20261008/linux/`; archive SHA-256:
`84dd96926afda9433806d1ed9b63fecf5e3b33d2651d013962e76b32c3255f29`.
No GPU, model, native environment, control or stop acknowledgement is allocated.

## Policy inference ownership

All four native policy service entry points use production `ThreadedInference`
and `recorded_inference` from `physical_harness.policies.inference`. One thread
owns model execution and its audit writes. Concurrent admission fails; caller
cancellation leaves that operation and its records owned until completion.
Original errors propagate after their scoped failure record. Close drains the
thread, rejects new admission and remains shared across concurrent or cancelled
waiters. Standard `asyncio.wait` retains the operation independently of its caller.

```sh
PYTHONPATH=harness/physical-runtime/src \
PYTHONDONTWRITEBYTECODE=1 PYTHONASYNCIODEBUG=1 CUDA_VISIBLE_DEVICES='' \
.venv/bin/python scripts/check-policy-owner-offline.py \
  --request /absolute/path/original-policy-request.json \
  --output .local/work/<new-policy-owner-check>
```

Install the `policy` and `diagnostics` extras in the isolated environment.
Nine actual CPU cases pass on 2026-10-08 with Python 3.14. Original request recording
uses production exclusive file creation. A second write raises FileExistsError
and releases its owner for an actual source read. OS-pipe operations establish
concurrent rejection, caller cancellation with retained ownership, an original
late recorder failure and cancelled-close thread draining. The production server
and two actual WebSocket clients also check concurrent rejection and a real server
deadline while the operation remains owned. Both clients discard their connections;
the late recorder failure drains and the listener closes. A strict JSON Lines reader
verifies all five original recorder/admission/deadline failure records, including
three complete execution/task/observation scopes and their tracebacks.
No unobserved asynchronous errors or owned threads remain. Source bytes,
failure-log digest and service/helper implementation hashes are retained in
`.local/work/v1-policy-owner-transport-cpu-20261008-final/acceptance.json`.
No model result, environment or control is supplied by the diagnostic. Loaded-model
cancellation and physical task acceptance require the subsequent native campaign.
Full source checks compile 59 physical-runtime files and all seven policy service
and diagnostic entry points; 20 base modules import without loading model SDKs.

The same nine cases and full project checks pass on Linux from committed
`870806e` source in isolated Python 3.12.14 and Node 24.21.0/pnpm 11.19.0
environments. Helper, diagnostic, transport and service-entry source hashes match
the local source. Five original failures preserve the same classifications and
three full scopes; both clients, listener and owner threads close. The canonical
server checkout's before/after status is identical. CUDA remains invisible,
with no model, simulator or control allocation. Retained output is
`.local/work/v1-cpu-source-20261008/linux-policy-owner/`; its downloaded
`cpu-owner-evidence.tar.gz` has SHA-256
`bef0237d5ad37ea56fdefe5edd17093467f0d54f8264ac1764ded1abb44f89cf`.

## Worker process transport

The worker remains runnable through `python -m physical_harness.execution.worker`.
`execution/worker.py` owns NativeWorkerSession operations,
`execution/worker_transport.py` owns the host connection and request tasks, and
`execution/policy_records.py` owns original policy request/control recording.
BEHAVIOR and RoboTwin source directories are checked before importing their
optional SDK providers. [Source entry points](../development/code-map.md) identify
these files alongside the upper runtime and Console.

```sh
node scripts/check-worker-transport-offline.mjs \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-transport-check>

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-worker-host-offline.mjs \
  --config /absolute/path/original-deployment.json \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-host-check>
```

The first check starts actual EDH worker subprocesses with CUDA invisible. It
verifies 24 scoped responses, 20 batched close requests, task-identity rejection,
unknown-operation and invalid-argument errors, enabled diagnostics, the exact
32-MiB input boundary, oversized input, invalid UTF-8/JSON/constants, overflowing
numeric values, duplicate JSON fields at envelope/nested argument levels, malformed
envelopes, duplicate active identities and a disconnected response channel.
Failure cases retain an open input pipe until the worker exits independently.
Every child reaches process close without forced termination or an unobserved
Task/Future exception. Source hashes and original stderr remain preserved.
JSON decoding uses the standard library's object/number validation hooks.

The host check reads an original configured BEHAVIOR or RoboTwin deployment and
uses the production TypeScript environment factory and native transport. Its CPU
binding selects an actually absent SDK source directory. Initialization returns
the original FileNotFoundError; the existing close protocol confirms shutdown,
the worker process is absent, the recording probe is removed and the native image
context closes. No simulator or model is allocated. The original configuration,
wire schema and implementation sources retain their hashes.

On 2026-10-08, all 13 process cases pass, together with both provider host checks.
Evidence: `.local/work/v1-worker-transport-cpu-20261008-final/`,
`.local/work/v1-worker-host-behavior-cpu-20261008-final/` and
`.local/work/v1-worker-host-robotwin-cpu-20261008-final/`.
The original policy request also passes exclusive recording, duplicate-write
rejection and transport checks in
`.local/work/v1-policy-recording-cpu-20261008-final/`.
Active native SDK interruption and physical stopping retain their separate
actual-environment acceptance requirements.

The expanded sixteen-case check passes locally on 2026-10-08, including decimal
overflow and both duplicate-field cases, in
`.local/work/v1-worker-json-cpu-20261008/acceptance.json`. Invalid input terminates
the actual Worker while the caller retains its input pipe; all sixteen children
close at the process boundary without forced signals or unobserved exceptions.
No native environment, model inference or controls are allocated.

The expanded sixteen-case check and original-plan admission also pass on Linux
from frozen `6031766` source with isolated Python 3.12.14 and frozen Node
24.21.0/pnpm 11.19.0 dependencies. Two original histories preserve four execution
requests, six accepted plans and eight read-only templates. Full `pnpm check`
passes with 58 Python compilations, 19 base imports and 869 documentation links.
The canonical remote checkout's status is unchanged. Source-bound reports and
complete check output are retained under
`.local/work/v1-cpu-source-20261008/linux-json/`; the downloaded
`cpu-json-evidence.tar.gz` has SHA-256
`3f4e98cd5ab8a88346be64784f17f1d93467a78d2aeb4ce4e43baac9c492b10f`.

The host connection implementation is
`apps/server/src/native-worker-transport.ts`. It owns worker pipes, pending requests,
publication delivery and confirmed process-group release. The Session/task/image
implementation remains in `native-worker.ts`. Complete response validation precedes
request retirement, with Python error text preserved and input-pipe errors observed.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-worker-client-offline.mjs \
  --config /absolute/path/original-deployment.json \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-client-check>
```

Five actual production-client cases cover 20 concurrent original operation errors,
bounded request admission, read cancellation followed by the original response,
a real request deadline, actual child SIGTERM and an absent executable's ENOENT.
Every pending request completes, repeated close calls share one Promise and each
owned child/process group is absent at completion. Faulted cases preserve unknown
device state and reject clean-close acceptance. These checks allocate no environment
and perform no inference or controls. Local evidence:
`.local/work/v1-worker-client-cpu-20261008-final/acceptance.json`.

The same five client cases and both provider host checks also pass on Linux from
frozen `5a4a605` source, using the isolated Python 3.12.14 environment and a newly
installed frozen-lockfile Node 24.21.0/pnpm 11.19.0 workspace. Full `pnpm check`
passes with 58 Python compilations, 19 base imports and 857 documentation links.
The original server checkout's before/after status is identical. CUDA remains
invisible and no environment, inference or controls are allocated. The archive
under `.local/work/v1-cpu-host-20261008/` retains source-bound client/host reports,
full check output and installed Python versions. Its SHA-256 is
`6762e806aaee23b92eedbd0ebddf6c7db5af41a73efc12074f6c4743f3708bb3`.

The same 13 process cases and both TypeScript host checks also pass on `jd_B300`
with Python 3.12.14, Node 24.21.0 and pnpm 11.19.0. The frozen `feb8cc9` source
is installed in its own CPU Python environment and its own frozen-lockfile Node
workspace. Full `pnpm check` passes: 58 Python files, 19 base modules, 128 pinned
DSH files, 25 source bindings, 10 Teams, 36 core tool descriptions and 850 local
documentation links. CUDA is invisible throughout; no SDK environment is allocated.
Source and outputs are under
`.local/work/v1-cpu-source-20261008-final/source/` on that host. The retained
`cpu-evidence.tar.gz` SHA-256 is
`50a3b2ab28b0718381405f917308369f5c9a10a654489bcc8abd700e661255f0`.
The archive includes original process stderr, host/source hashes, complete check
output and the installed Python dependency versions.

## Managed foreground service

The production service manager supports an actual foreground service with its
configured HTTP/WebSocket readiness check. A CPU-only Console process can verify
ownership and cleanup without model inference:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-service-lifecycle.mjs \
  --provider <provider> --config /absolute/path/deployment.json \
  --models examples/models/qwen38-vllm.yaml --id <configured-service> \
  --output .local/work/<new-service-check> --port <unused-console-port>
```

Two leases share one actual process. Releasing the first retains the process;
releasing the last stops it. Restart creates a new process. An observed unexpected
process exit aborts its lease and rejects admission until that failure is handled.
The separate `--close-held` invocation closes the server while one lease remains
and requires that process to terminate, with zero final leases and owned PIDs.

Both paths pass on 2026-10-07 using the actual four-provider EDH native workspace
Console as the configured foreground service. Evidence:
`.local/work/v1-cpu-service-lifecycle-20261007/` and
`.local/work/v1-cpu-service-close-held-20261007/`.

## Managed service startup ownership

The production ManagedServices owner starts the actual configured four-provider
Console as its foreground service. Three cases exercise operator cancellation
during startup, global close during startup and cancellation of one of two
simultaneous startup admissions.
Shutdown waits for both the leader's exit and complete owned process-group absence
under the configured graceful deadline. Forced termination also has a bounded
drain and retains the original graceful/release errors. Confirmed group release
clears PID ownership; an uncertain boundary retains it.
Graceful shutdown signals the complete group even after the leader has ended.
Original unexpected-exit errors remain visible after confirmed resource release.
Endpoint availability uses Node's URL-to-HTTP hostname conversion, including
IPv6 literals admitted by the existing readiness schema.
An EPERM group probe retains ownership and waits within the same bound; it does
not establish absence. Only ESRCH confirms that no group remains. These meanings
follow the [Apple kill(2) reference](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kill.2.html).

```sh
CUDA_VISIBLE_DEVICES='' pnpm exec tsx --tsconfig tsconfig.runtime.json \
  scripts/check-service-startup-owner-offline.mjs \
  --workspace /absolute/path/original-workspace.json \
  --output .local/work/<new-service-startup-owner-check>
```

The diagnostic requires POSIX process groups. It preserves the actual model and
provider bindings, selects a new private writer directory and unused Console
port, and starts the production workspace CLI. It observes original writer
creation before the OS suspends the owned process. Cancellation/closure stays
with its actual process owner; resuming allows the installed signal handler to
complete closure. Two startup admissions share one PID. Cancelling the first
retains the second's lease, and that second admission receives the actual Console
readiness response before release.

Writer admission checks the current file through the operating system before
startup and on every directory notification. Original file errors other than
absence propagate. On 2026-10-13, all three actual Console process cases pass
with final PID/lease absence, released writers and reusable listener ports:
`.local/work/policy-listener-console-startup-cpu-20261013/acceptance.json`.

The configured package-entry diagnostic exercises both `pnpm start` and
`pnpm demo` with normal shutdown and actual leader termination while their
Console descendants remain available. Each case retains compatible profile
metadata, idle model/policy services and empty Sessions. Shutdown requires the
complete group, HTTP listener and writer to release; unexpected-exit outcomes
remain unchanged. Two additional cases use an actual occupied IPv6 loopback
listener with HTTP and WebSocket readiness declarations. Both reject before
spawning a candidate and preserve the original listener. This diagnostic
requires POSIX process groups and available IPv6 loopback.
On macOS, all six cases pass:
`.local/work/service-group-console-cpu-20261013/acceptance.json`.
The complete configured campaign passes forty-five components and 1,627 cases.
Independent inspection repeats 1,032 source/input/link comparisons, confirms
release of all forty-five process groups and preserves original journal/image
bytes. This scope allocates no model, simulator or GPU. Evidence:
`.local/work/service-group-foundation-cpu-20261013/independently-verified.json`.
Exact source `42dcb39` matches all 196 campaign production/checker/package files.
The same six package Console and three startup-ownership cases pass on isolated
Linux using Node.js 24.21.0 and Python 3.12.14. Independent inspection verifies
sixteen distinct committed files, 46 source comparisons, nineteen archived source/
input files, eight unchanged journal reads and sixteen matching configured profile
snapshots. The actual runner and Console groups release; isolated source stays
clean and canonical server status/change bytes remain unchanged. Evidence:
`.local/work/service-group-platforms-independent-20261013.json` and
`.local/work/service-group-linux-receipt-20261013/`.
CI `38421987639` passes complete source/installation checks, 97 runtime cases
and the three-platform Team admission matrix. Downloaded runtime/installation
artifacts independently match fourteen distributions, fourteen import origins,
41 inputs and 99 exact-source comparisons. All seven uploaded/reconstructed
evidence fields, input hashes and checker identity match:
`.local/work/ci-service-group-consolidated-independent-20261013.json`.
The fifteen previously executed installed-policy processor files match this
source without reruns: `.local/work/current-sdk-service-group-source-20261013.json`.
These checks supply no model output, native environment or GPU allocation;
loaded-policy and complete native task acceptance retain their release gates.

Each case requires the original cancellation outcome, absent owned process group,
zero final leases/PIDs, released writer lock and successful listener-port reuse.
Configuration and executable source hashes remain unchanged. macOS evidence:
`.local/work/v1-service-group-owner-20261008-release/acceptance.json`.
These actual process/HTTP cases make no Session, model, policy, simulator or GPU
allocation. Loaded model-service startup interruption remains a native gate.
The same current source also passes shared lease release, actual service restart,
unexpected process exit and server closure with an active lease in
`.local/work/v1-service-group-lifecycle-20261008-release/` and
`.local/work/v1-service-group-close-held-20261008-release/`.

Frozen `1192be3` passes these three startup cases, both actual shared-service
lifecycle scenarios, the eight perception CLI cases below and full project checks
under isolated Linux Python 3.12.14 and Node 24.21.0. Six original configuration
hashes and nine executable hashes match macOS. Startup reports require owned
process-group absence; shared release, actual restart, unexpected process exit
and active-lease server closure retain their original outcomes. The canonical
server checkout's before/after status is identical. No model, policy, simulator
or GPU is allocated. Reports and the verified summary are under
`.local/work/v1-cpu-service-group-20261008/linux/`; archive SHA-256:
`6d2ad725331512f382dbc8949ff64cadd22e93c23173f7a6dd733fb0d044bcc0`.

## Perception service arguments

Standalone SAM3.1 and YOLO26 service CLIs handle argument help, required fields and
port/checkpoint paths before importing their optional model/HTTP SDKs. Valid service
startup imports its required libraries directly and retains original source and
checkpoint verification, model initialization and request schemas. The independently
runnable SAM service retains its MIT notice and imports no EDH runtime or YOLO.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-perception-startup-offline.py \
  --python .venv/bin/python --output .local/work/<new-perception-startup-check>
```

Eight actual subprocess cases cover help, missing required arguments, invalid
ports and absent checkpoints for both services. Each process exits with its
original argparse/field error before SDK admission. No model, checkpoint, SDK,
perception result, environment, GPU or control is supplied by the diagnostic.
Source hashes and complete original stdout/stderr remain in
`.local/work/v1-perception-startup-20261008/acceptance.json`.
Loaded model startup, source/weight validation and segmentation/depth results
retain their native acceptance requirements.
The same eight CLI cases and all three executable hashes also match the isolated
Linux run from frozen `1192be3`; its reports are under
`.local/work/v1-cpu-service-group-20261008/linux/perception-startup/`.

## Native admission and interrupted driver

The [admission diagnostic](../../scripts/check-native-admission-offline.mjs)
starts the production four-provider Console and a production native deployment.
The selected profile requires that Console's occupied endpoint as its managed
service. The existing service owner remains active while native admission rejects
the ownership conflict before starting a worker or loading a model.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-admission-offline.mjs \
  --provider <provider> --config /absolute/path/deployment.json \
  --workspace /absolute/path/workspace.json --models examples/models/qwen38-vllm.yaml \
  --profile <configured-profile> --service <console-service> \
  --output .local/work/<new-admission-check>
```

Repeat with `--interrupt` to send SIGTERM to the actual acceptance driver at
environment admission. Its native factory still performs its original service
checks. The driver retains the submitted response and closes the matching Session.
Both paths require released resources, zero task admissions, zero service leases
or child PIDs, unchanged configuration hashes and released listeners/writer locks.
They pass on 2026-10-07 in
`.local/work/v1-cpu-admission-failure-20261007-02/` and
`.local/work/v1-cpu-admission-interrupt-20261007/`.

## Native campaign cancellation

[check-native-campaign-shutdown.mjs](../../scripts/check-native-campaign-shutdown.mjs)
executes the actual native release campaign, its live driver and production
Console factories. It requires a clean committed checkout, a configured
owner workspace, a probe workspace and a one-case manifest that
selects the probe's original native task. The selected profile must require
exactly one managed service with HTTP readiness at `127.0.0.1:<port>/api/config`.
The owner Console occupies that configured endpoint before admission begins.
No service command or Worker starts; the original managed-service ownership
check rejects environment creation before allocation.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-campaign-shutdown.mjs \
  --config /absolute/path/probe-workspace.json \
  --owner /absolute/path/owner-workspace.json \
  --manifest /absolute/path/one-native-task-campaign.json \
  --output .local/work/<new-native-campaign-shutdown-check>
```

Four cases cover ordinary admission failure, SIGTERM, SIGINT and repeated
SIGTERM/SIGINT/SIGTERM. Signal cases suspend the known owned live driver at actual
environment admission while the campaign receives its signals, then resume it
before calling the unchanged native factory. This requires the campaign to
remain active until its driver and matching Session finish closure. The
diagnostic also retains driver ownership during its own cleanup.

Each case checks original request-to-Session identity, closed/released Session
state, zero task admissions, the actual occupied-service error, absent campaign
and driver processes, zero service leases/PIDs, released listeners/writer locks
and absent final workflow acceptance. Original driver logs and configuration/
executable hashes remain in the new output directory. Every signal path exits
with failure after cleanup; it preserves the original environment admission
failure and does not generate a task outcome.

All four macOS cases pass from committed `80cb025` under
`.local/work/v1-native-campaign-owner-20261008-verified/`. GPU jobs, model calls,
managed service starts and environment allocations remain zero. Cancellation
with loaded inference, physical controls and native device stopping retains its
separate actual release requirement.

The same four cases and full source checks pass on isolated Linux from a clean
`80cb025` checkout with Python 3.12.14, Node 24.21.0 and the complete frozen lock.
Independent comparison verifies thirteen matching model, campaign, executable
and original four-provider configuration hashes. Original request/closed-Session
identities, driver exits, failure logs and zero-admission/resource results verify
on both platforms. The canonical server checkout retains its exact status and
the isolated source remains clean. The evidence archive matches server SHA-256
`b35a3b759776f1f63d933ee1f313751fcb37e79388107cb29f071af38011e3cd`.
Reports and the independently verified summary are under
`.local/work/v1-native-campaign-owner-linux-20261008/`.

## Native geometry and role records

### Numeric geometry admission

Native back-projection, camera range and camera/world coordinate reductions use
NumPy's scoped arithmetic checks. Overflow, invalid floating-point operations and
division by zero raise at their calculation site before a measurement is returned.
The original equations, units, output fields and source identities remain unchanged.

Clean `27b3950` passes 39 CPU checks per platform on macOS and isolated Linux:

| Provider | Original captures | Original recomputation | Invalid calibration checks |
| --- | --- | --- | --- |
| RoboCasa | 4 | 4 | 8 |
| RoboTwin | 3 | 3 | 6 |
| RoboDojo | 6 | 6 | 12 |

The explicitly declared derivatives contain finite float64 camera intrinsics or
world translations and check range/centroid overflow. They retain original RGB,
mask and depth files. Every original measurement passes the existing recorded
float64 accumulation allowance. Each diagnostic report includes hashes of its
four original capture files and two production source files. Independent checks
match 78 input/source hashes per platform, original identities, numeric admission
and report/archive digests. The actual Linux runner/diagnostic processes release;
frozen source stays clean and canonical server status remains unchanged.
No model, simulator, GPU or physical controls allocate.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  python scripts/check-recorded-metric.py \
  --record /absolute/path/to/original-native-measurement \
  --check-numeric-admission --output .local/work/<new-numeric-check>.json
```

Evidence: `.local/work/metric-numeric-cpu-macos-20261008-verified/` and
`.local/work/metric-numeric-cpu-linux-20261008-verified/`. The Linux archive matches
SHA256 `cbbe852fe6b0583c38c39c7f8868241e14bb50dad9a647631a5c7a8be5fac374`.
These checks use stored native capture data. New semantic masks, physical camera
calibration accuracy and complete loaded-provider tasks require native acceptance.

### Native metric receipt admission

`perception/src/metric-measurement.ts` owns measurement request admission and
native RGB-D receipt decoding. NativeTaskBackend captures a detached immutable
request before transport and retains cancellation, current task and closure
checks. Receipt admission preserves the existing BackendObjectMeasurement shape
and numeric values while binding observation, camera, RGB/mask and provider
identities. Geometry checks require consistent pixel counts/coverage, bounded
meter-valued depth statistics, source-image centroid bounds, matching intrinsic
parameters/matrices, homogeneous rigid proper camera transforms and consistent
camera/world surface centroids. World-coordinate comparison uses the recorded
float64 accumulation allowance with the original valid-pixel count.

Thirteen original native captures pass 416 CPU cases:

| Provider | Original captures | Admission and snapshot cases |
| --- | --- | --- |
| RoboCasa | 4 | 128 |
| RoboTwin | 3 | 96 |
| RoboDojo | 6 | 192 |

Requests preserve their original values after caller mutation; decoded arrays
and calibration metadata remain detached from the input payload. Declared
invalid derivatives reject for foreign source/frame identities, invalid encoding,
nonfinite/statistically inconsistent fields, singular/inconsistent intrinsics,
nonrigid/reflected transforms and inconsistent camera/world centroids. Independent
NumPy inspection matches 44 original/source file identities and all 494 decoded
fields against the actual payloads, with unchanged original RGB/mask/JSON files.
The reader supports all four native provider identities; these supplied original
records establish RoboCasa, RoboTwin and RoboDojo coverage.

```sh
CUDA_VISIBLE_DEVICES='' pnpm exec tsx --tsconfig tsconfig.runtime.json \
  scripts/check-recorded-metric-measurement.mjs \
  --record /absolute/path/to/original-native-measurement \
  --require-provider robotwin --output .local/work/<new-metric-admission>
```

Repeat `--record` and `--require-provider` for the selected original capture
corpus. Every source file retains its captured digest. This diagnostic performs
no model inference, simulator allocation, GPU allocation or physical controls.
Evidence: `.local/work/metric-measurement-admission-current-20261012/acceptance.json`
and its `independently-verified-source.json`. All five captured implementation
files match committed source `c942b63` exactly. The same native backend source additionally
passes all thirty-seven configured CPU components and 1,185 cases. Independent
inspection matches 634 source/input comparisons, unchanged original journals and
all thirty-seven released diagnostic process groups, with zero native allocations.
Campaign evidence:
`.local/work/metric-measurement-cpu-campaign-20261012/independently-verified.json`.
Native BEHAVIOR receipt coverage and additional live camera/calibration workflows
retain their native acceptance requirements. Original masked depth recomputation
retains the separate geometry evidence above.

Actual Ubuntu CI `38339782470` passes fresh installation, source checks and all
78 production runtime cases at `c942b63`. Downloaded artifacts independently match
89 exact-source comparisons, fourteen installed distributions, thirteen imports
and 41 input identities. Production readers verify seven unchanged task-plan
journals and all 338 immutable events from 22 native retry Sessions with released
writers. Actual transient-failure checks retain 56 refused connections and zero
provider responses. These checks allocate no models, simulators or GPUs. Evidence:
`.local/work/ci-metric-measurement-inspection-20261012.json`,
`.local/work/ci-metric-measurement-independently-verified-20261012.json` and
`.local/work/ci-metric-measurement-native-independent-20261012.json`.

### Original measurement and role inspection

`scripts/check-recorded-metric.py --record DIRECTORY --output .local/work/<new-file>.json`
recomputes original RGB-D measurements through production geometry. Source hashes,
mask/image identity, calibration, pixel counts and original metadata remain exact.
Derived range and camera/world surface coordinates use a reported float64
accumulation allowance: `8 × (n × epsilon / (1 − n × epsilon)) × scale`, where
`n` is the number of valid pixels and `scale` is at least one meter and includes
the original/recomputed coordinate magnitudes. Each coordinate reports its actual
drift and allowance. This numerical allowance represents arithmetic precision;
sensor accuracy and semantic object selection require separate native evidence.
RoboTwin's recorded camera centroid differs by `2.44e-19` m on this host;
the original depth, calibration and PNG sources remain unchanged.

Actual RoboCasa, RoboTwin and RoboDojo records pass recomputation. The production
communication reader also checks all 141 original events of run `04823dd4`,
same-context explicit continuation, report versions, acknowledgement and context-
pending cancellation with released resources. Native DSH recovery readers preserve
original tool results and recover interrupted prefixes without replaying controls.
The actual BEHAVIOR journal verifies a retained two-task Session and its unchanged
failed outcomes through the production history, catalog and verdict readers.
These are CPU checks of original records.

The [RoboTwin action reader](../../scripts/check-robotwin-recorded-actions.py)
uses the actual production Torch converter on recorded model/native action pairs.
`--conversion-only` checks the recorded checkpoint revision, finite action rows,
native horizon, unchanged joint targets and gripper conversion on CPU. The
separate `--request` and `--schema-path` arguments additionally require the exact
original request and verify its identity, channel ranges and action budget.
Reports explicitly state whether that original request was checked.

```sh
python scripts/check-robotwin-recorded-actions.py \
  --record /absolute/path/robotwin-pi05-recorded-actions.json --conversion-only \
  --output .local/work/<new-conversion-check>.json
```

On `jd_B300`, the current 56 Python files and 16 base modules pass compilation
and imports in `edh-lerobot-pi05-py312` with `CUDA_VISIBLE_DEVICES` empty. The
original recorded Pi0.5 action passes production CPU conversion without new
inference or controls. That conversion-only check does not certify request
identity or checkpoint bytes. Its original checkpoint revision is retained.

The [recorded-input endpoint driver](../../scripts/check-recorded-policy-inference.py)
is available for the subsequent actual policy validation. It supports bearer
credentials through a named environment variable, preserves the request hash,
validates the canonical response and requires a new private output file. It
issues an actual inference request when invoked; this CPU phase does not invoke
it against a model service. Its response still requires independent checkpoint
and simulator source acceptance.

## Native configuration and original histories

The [workspace readiness check](native-workspace.md#offline-readiness) validates
all four factories, profile-specific Teams, model/checkpoint/mode bindings and
HTTP projections without environment allocation. The
[campaign reader](native-release-campaign.md#inspect-retained-task-histories-without-gpu-work)
checks original terminal task histories, Planner recovery, native tools,
independent Verifiers, completed plans and Session closure.

`pnpm check` validates formatting, generated schema, role workflows, exact DSH
source provenance, TypeScript, module/document structure, Python compilation/base
imports and SVG XML. These checks establish their declared CPU boundaries.

## Native reference graph equivalence

`scripts/check-native-reference-graph.mjs` uses an actual retained journal and
the immutable prior production retention factory from Git. The installed
TypeScript compiler loads that factory in memory; the report retains its commit,
original bytes, compiler version and compiled-source digest. Sixteen common
production sources must still match the baseline. Nineteen current source
identities bind the new graph, complete namespace owners and checker.

For every original record, the check admits both complete production owners,
compares mandatory retention flags, requires every current direct edge to exist
in the original graph, and requires every removed original edge to have a
current direct or two-edge path through an existing source. These conditions preserve every record
selection's crossing dependencies. Partial Run selections reject. Optional
Session retirement exercises actual request archival, equivalent old/current
previews, single-use retirement and reopening. Unselected record values and
revisions must remain identical. The original journal is never modified.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-reference-graph.mjs \
  --data-directory /absolute/path/to/retained-history \
  --baseline-revision 0c14399 \
  --retire-session-id <actual-closed-session-id> \
  --output .local/work/<new-reference-graph-check>
```

On 2026-10-12, RoboTwin (2,991 records), BEHAVIOR (141), RoboDojo (6,541)
and grounding (859) pass all four phases: original, archived, retired and
reopened. Direct references total 44,667; every original dependency remains
reachable. Seventy-seven declared checks also preserve request protection,
preview identity, source digests and released copied writers. The four-Session
grounding history retires 455 selected records and preserves all 404 original
records in three other Sessions. Final reopened graphs contain 414 records,
including ten retained archived request identities. Per-owner timing fields
describe these diagnostic calls only.

Evidence: `.local/work/native-identity-sources-{robotwin,behavior,robodojo,grounding}-final-20261012/acceptance.json`.
Independent production readers repeat the original and reopened graphs, verify
all 404 preserved records and match 76 source identities, original/compiler
digests and unchanged reports. Evidence:
`.local/work/native-identity-sources-independently-verified-20261012/acceptance.json`.
The complete current-source campaign separately passes 37 components and
1,185 cases. Independent inspection matches 634 source/input comparisons,
original journal/image digests and all 37 absent diagnostic process groups.
The actual native retry reader reopens 22 Sessions and verifies all 338 durable
events with unchanged sources and released writers. Complete source checks pass.
No model, simulator or GPU allocation occurs during this acceptance.

Committed v5 source `ebf8e76` independently matches 156 production/checker files.
Actual Ubuntu run `38302136882` passes fresh frozen installation, complete source
checks, seven SKILL tests, eight request-option tests, thirteen failure tests,
fifteen retry-configuration tests and 78 production runtime cases. Downloaded
artifacts independently verify fourteen installed distributions, thirteen imports,
41 input digests and 89 exact-commit source comparisons. Production readers
verify all 338 native event bodies and seven unchanged task-plan journals with
released writers. Three JUnit reports preserve all case names with zero failures
or skips. Evidence:
`.local/work/ci-native-identity-sources-inspection-20261012.json`,
`.local/work/ci-native-identity-sources-independently-verified-20261012.json` and
`.local/work/ci-native-identity-sources-native-independently-verified-20261012.json`.

Committed `63054e2` independently matches 156 production/checker files across
the full campaign and graph checks. Actual Ubuntu run `38297182234` passes fresh
frozen installation, complete source checks, seven SKILL tests, eight request-option
tests, thirteen failure tests, fifteen retry-configuration tests and 78 production
runtime cases. Independent downloaded-artifact inspection verifies fourteen
installed distributions, thirteen imports, 41 input digests and 89 exact-commit
source comparisons. Production readers verify all 338 immutable native event
bodies and seven unchanged task-plan journals with released writers. Three JUnit
reports preserve every declared case name with zero failures or skips. Evidence:
`.local/work/ci-native-reference-inspection-20261012.json`,
`.local/work/ci-native-reference-independently-verified-20261012.json` and
`.local/work/ci-native-reference-native-independently-verified-20261012.json`.

## Native deployment module ownership

`native-deployment-configuration.mjs` owns provider settings, Team/model bindings,
task/checkpoint admission, managed-service references, camera banks and native
context defaults. `native-policy-environment.mjs` owns learned-worker allocation
and RoboDojo direct/hybrid gateway, independent DSH host, demonstrations, ordered
audit writes and cleanup. `native-deployment.mjs` assembles model/perception/profile
factories, managed-service leases and runnable Console startup. Its original
configuration/root exports remain available to every existing entry point.

Actual TypeScript parser/printer inspection against committed source `f4317f5`
matches five complete function bodies, parameters and five constant initializers.
Actual module imports check all five public exports, repository-root resolution
and shared configuration function identity. Evidence:
`.local/work/native-deployment-move-source-20261012.json`.

The complete configured CPU campaign passes thirty-nine components and 1,372
cases. Independent inspection matches 715 source/input comparisons and thirty-nine
released diagnostic process groups. Four configured native profiles and both
camera configuration derivatives preserve their exact values; eighteen calibration
source/implementation identities match. Original journals and image sources remain
unchanged, writers release, and model/simulator/GPU allocations remain zero.
Evidence: `.local/work/native-deployment-modules-cpu-campaign-20261012/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.
These checks establish code ownership and CPU configuration/lifetime boundaries;
loaded model/policy and complete native task gates retain their release requirements.

All 153 captured production/checker files match `2ef31d7`. Actual Ubuntu CI
`38348086492` passes fresh installation, complete source checks and 78 runtime
cases. Downloaded evidence independently verifies 89 exact-source comparisons and
41 inputs. Production readers preserve seven task-plan journals and all 338 retry
events in 22 native Sessions, with unchanged journals, released writers and no
native allocation. Evidence:
`.local/work/ci-native-deployment-modules-inspection-20261012.json`,
`.local/work/ci-native-deployment-modules-native-independent-20261012.json` and
`.local/work/native-deployment-modules-cpu-campaign-20261012/committed-source-verification.json`.

## Profile camera calibration admission

`perception/src/request-inputs.ts` owns camera-bank admission. Native configuration
and deployment preparation resolve each profile's default or explicit complete
bank. UpperRun snapshots the selected Session bank for YOLO requests. Banks and
individual camera values are detached and immutable, with a null-prototype bank.
Only an omitted deployment field selects an empty default. Explicit `null`,
arrays and text reject during configuration loading at deployment and profile
scope. An explicit `{}` remains a valid complete empty bank.
The native configuration digest retains these bindings, and public launch metadata
keeps them private. Shared SAM/YOLO endpoints can serve different profile banks.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-depth-calibrations-offline.mjs \
  --config /absolute/path/native-workspace.json \
  --calibration /absolute/path/original-camera/intrinsics.json \
  --calibration /absolute/path/original-native-capture/measurement.json \
  --output .local/work/<new-calibration-check>
```

Supply at least two original files with different calibration identities. The
checker reads either saved snake-case intrinsic fields or a native measurement's
`intrinsics` object; the camera name comes from the native receipt or original
camera directory. Standard JSON readers preserve these values. Original workspace,
model and provider configuration files remain unchanged and have captured digests.
Explicit configuration derivatives exercise inherited, supplied and empty banks
through the actual native factories and `prepareDeployment`. The production idle
HTTP server preserves profile/checkpoint/model metadata, excludes private banks,
keeps services idle and closes its listener and journal writer. Invalid calibration
values reject and caller mutation preserves prepared snapshots.

The four-provider diagnostic passes sixty-six cases. Its
`configurationAdmissions` manifest records twenty-two declared runtime JSON
derivatives, each original configuration path, derivative digest and exact
Zod rejection issues when applicable. Thirteen invalid banks reject; nine
omitted/empty banks preserve exact worker, checkpoint, model and service
bindings. Independent production readers repeat these outcomes and compare
each derivative with its original configuration after only the declared bank
change. Eighteen original/source identities match; both original camera values
and the reopened empty journal remain unchanged. Writers/listeners release and
native allocations remain zero. Evidence:
`.local/work/calibration-configuration-admission-20261013/independently-verified.json`.

The complete configured campaign passes thirty-nine components and 1,394 cases.
Independent inspection matches 737 source/input comparisons, all thirty-nine
released diagnostic process groups, unchanged original journals/images and
released writers. The calibration component's twenty-two derivative files also
match their source configurations through independent production readers.
Separate NumPy/Pillow inspection checks forty source identities, fifteen PNG
checks and forty-eight depth-statistic fields. Native allocations remain zero.
Evidence: `.local/work/calibration-configuration-cpu-campaign-20261013/independently-verified.json`,
its `depth-calibrations/independently-verified.json` and
`.local/work/calibration-perception-independent-20261013.json`.

All 153 captured production/checker files independently match `f9016c4`.
Actual Ubuntu CI `38349877123` passes fresh installation, complete source checks
and 78 runtime cases. Downloaded evidence independently verifies fourteen
distributions, thirteen imports, 41 input identities and 89 exact-source
comparisons. Production readers preserve seven task-plan journals and all 338
retry events in 22 native Sessions, with released writers and no native
allocation. Evidence:
`.local/work/calibration-configuration-cpu-campaign-20261013/committed-source-verification.json`,
`.local/work/ci-calibration-configuration-inspection-20261013.json` and
`.local/work/ci-calibration-configuration-native-independent-20261013.json`.

The configured four-provider check passes 44 cases with original RoboCasa and
RoboDojo camera values. Evidence:
`.local/work/depth-calibration-binding-final-20261012/acceptance.json`.
This admission/propagation scope makes zero provider calls and allocates no
model, worker, simulator or GPU. Source-camera/resolution accuracy and actual
learned-depth decisions retain their native acceptance requirements.

CPU campaign configuration accepts optional `depthCalibrationRecords`, a list
of two to sixteen original file paths. The campaign adds `depth-calibrations`
with the common workspace and isolated diagnostic process ownership. The original
file list and implementation digests are retained with its report.

The configured CPU campaign passes thirty-nine components and 1,372 cases.
Independent checks match 694 source/input comparisons and thirty-nine released
diagnostic process groups. Calibration inspection checks sixteen source identities,
four profile identities and both configuration derivatives against their original
native configuration files, with only declared calibration banks added. Original
camera values remain exact and the empty production journal reopens unchanged.
Evidence: `.local/work/depth-calibration-cpu-campaign-20261012/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.

All 151 captured production/checker files independently match `38c0a3e`.
Actual Ubuntu CI `38346569166` passes fresh installation, complete source
checks and 78 runtime cases. Downloaded evidence verifies 89 exact-source
comparisons and 41 inputs. Production readers preserve seven task-plan journals
and all 338 retry events in 22 native Sessions, with released writers and no
native allocations. Independent saved SAM/YOLO inspection also verifies fifteen
PNG checks, forty-eight depth-statistic fields and nine exact committed sources.
Evidence: `.local/work/ci-depth-calibrations-inspection-20261012.json`,
`.local/work/ci-depth-calibrations-native-independent-20261012.json` and
`.local/work/depth-calibration-cpu-campaign-20261012/committed-source-verification.json`.

## Native policy gateway configuration

`scripts/check-native-policy-inputs-offline.mjs` is the versioned CPU entry for
selected-profile file preparation and service ordering. Supply a strict JSON
manifest with the following fields. Input paths resolve relative to that manifest;
the original native deployment retains its production path rules.

| Field | Required source |
| --- | --- |
| `schemaVersion` | `edh.native_policy_inputs.v1` |
| `deploymentConfiguration` | Existing RoboDojo native deployment JSON |
| `profileId` | Existing direct/hybrid GPT profile in that deployment |
| `modelEndpoint` | Endpoint bound to that profile's selected policy model |
| `demonstrationText` | Nonempty original UTF-8 text; a saved task snapshot can check text admission only |
| `demonstrationImages` | Exactly two original stored RGB PNG paths, in their declared order |
| `workspaceConfiguration` | Valid native workspace JSON whose model configuration permits idle CPU Console startup |

```sh
CUDA_VISIBLE_DEVICES='' TSX_TSCONFIG_PATH=tsconfig.runtime.json node --import tsx \
  scripts/check-native-policy-inputs-offline.mjs \
  --config .local/work/native-policy-input-records.json \
  --output .local/work/native-policy-input-check
```

The output directory must be new and inside the repository's `.local/work`.
The diagnostic stores original source digests, declared private configuration
derivatives, exact file failures, prepared attachment references and observed
Console process/listener/journal release. It replaces only the selected endpoint's
address/authentication in a declared derivative, using a genuinely closed local
port without issuing model requests. Other original model, Team, task, worker and
checkpoint bindings remain unchanged. Its separate production Console reaches
readiness and closes without creating a task. Add `nativePolicyInputRecords`, a
path to this manifest, to `edh.cpu_release.v1` to include the `native-policy-inputs`
component and its process-group receipt in the consolidated campaign. No policy
gateway, native worker, simulator or GPU starts in this scope.

The manifest-bound diagnostic at `8c75a65` passes thirty-three original-profile
checks on macOS and isolated Linux on 2026-10-13. Independent production readers
repeat twenty-eight file checks per platform, match twenty-two source identities
and thirty-one configuration derivatives, and verify fifteen stored-image fields.
All thirty-three outcomes and prepared image identities match across platforms.
Linux uses eleven unchanged original input files with declared configuration-path
relocations; ten loaded production files match the commit. macOS also reads the
unchanged repository model example, matching eleven production files. Each actual
Console starts and closes with its process group, listener and writer released.
The isolated source stays clean and canonical server changes remain unchanged.

The complete configured macOS campaign with `nativePolicyInputRecords` passes
forty components and 1,427 cases, with 792 independently matched source/input
comparisons, 157 exact-commit production/checker files and forty released process
groups. Original journals/images stay unchanged and writers release. Its sixty-nine
saved model-output receipts and two original image contexts retain their recorded
inspection scope. Actual Ubuntu CI `38369131528` at the same commit independently
passes fresh installation, complete source checks and 78 runtime cases. Downloaded
artifacts match fourteen distributions, thirteen imports, 41 original inputs and
89 exact-source comparisons. Production readers preserve seven task-plan journals
and 338 retry events in 22 native Sessions, including 56 genuine failed connections
and zero provider responses. Previously executed Linux SDK checks retain their
recorded input/preparation scope; fifteen loaded sources match this commit.
No new model inference, native worker, simulator or GPU execution occurs.

Evidence:

- `.local/work/native-policy-checker-cpu-20261013/independently-verified.json`
- `.local/work/native-policy-checker-cpu-20261013/committed-source-verification.json`
- `.local/work/native-policy-checker-cpu-20261013/native-policy-inputs/committed-source-verification.json`
- `.local/work/native-policy-checker-linux-verified-20261013/local-independent-verification.json`
- `.local/work/ci-native-policy-checker-inspection-20261013.json`
- `.local/work/ci-native-policy-checker-plans-independent-20261013.json`
- `.local/work/ci-native-policy-checker-native-independent-20261013.json`
- `.local/work/current-sdk-cpu-linux-20261013-verified/committed-policy-checker-source-verification.json`

The independently checked Linux evidence archive has SHA-256
`c276b5a5157643edb139519f5764ce9d845f3c950128c6ab479794ac714f7eb6`.

`readNativeGptPolicyInputs` in `native-policy-environment.mjs` prepares the selected
profile's trusted instructions, nonempty demonstration text and native DSH PNG
attachments. The deployment factory awaits preparation before managed-service
acquisition; the independent policy host/gateway/worker consume those values.
File reads receive the caller's cancellation signal and completed preparation
rechecks that signal. Existing DSH image byte/count/pixel limits and full decoding
remain authoritative. Missing/mismatched prepared modes reject at environment entry.

Thirty-three CPU cases use an original direct profile, a saved task snapshot and
two original camera PNGs. Four valid preparations preserve text and ordered native
references. Twelve declared invalid inputs pass both reader and factory rejection:
missing or directory text/image paths, empty/blank text, non-image/truncated bytes,
an invalid second batch member and byte/count/pixel limits. No invalid batch
publishes images or starts managed services. Two caller cancellation cases and
two environment-entry checks preserve idle service state. The real production
Console separately starts and closes; its process group and listener release,
its empty journal stays unchanged and its writer releases.

The diagnostic explicitly changes only endpoint/authentication in its model
configuration derivative to a closed local address and `none`. It makes no model
request, supplies no provider response and preserves the original model/Team/
worker/checkpoint bindings. Its saved task snapshot exercises text admission,
and its original camera images exercise attachment preparation; it does not
establish demonstration effectiveness. Independent production readers repeat
twenty-eight file checks, compare all thirty-one configuration derivatives with
their original input, match nineteen source identities and verify fifteen
stored-image fields. Console process/listener absence and journal/writer release
are inspected again. No model, gateway, worker, simulator or GPU allocates.
Evidence: `.local/work/native-policy-inputs-final-20261013/independently-verified.json`.

The same source passes the complete thirty-nine-component CPU campaign and
1,394 cases. Independent inspection matches 737 source/input comparisons,
unchanged original journals/images and all thirty-nine released diagnostic
process groups. Camera configuration repeats sixty-six cases and twenty-two
declared derivatives; all writers release. Evidence:
`.local/work/native-policy-inputs-cpu-20261013/independently-verified.json`.

Source `b3de927` matches all 153 campaign production/checker files and the nine
selected-file preparation sources. Actual Ubuntu CI `38366929341` passes fresh
installation, complete source checks and 78 production runtime cases. Downloaded
artifacts independently match fourteen distributions, thirteen imports, 41 input
identities and 89 exact-source comparisons. Production readers preserve seven
task-plan journals and 338 retry events in 22 independent native Sessions, with
released writers. The fifteen previously executed Linux SDK processor sources
also match this commit; their 72-case/46-original-request evidence retains its
recorded `5b26a5a` execution source. Original-perception inspection matches forty
source comparisons, fifteen PNG checks, forty-eight depth-statistic fields and
nine exact-commit sources. These scopes allocate no model, simulator or GPU.
Evidence:
`.local/work/native-policy-inputs-final-20261013/committed-source-verification.json`,
`.local/work/native-policy-inputs-cpu-20261013/committed-source-verification.json`,
`.local/work/ci-native-policy-inputs-inspection-20261013.json`,
`.local/work/ci-native-policy-inputs-plans-independent-20261013.json`,
`.local/work/ci-native-policy-inputs-native-independent-20261013.json`,
`.local/work/current-sdk-cpu-linux-20261013-verified/committed-policy-input-source-verification.json`
and `.local/work/native-policy-input-perception-independent-20261013.json`.

Direct/hybrid profiles admit `worker.sceneConfiguration.control_mode` as
`0-shot`, `textual-1-shot` or `visual-1-shot`; omission selects `0-shot`.
The native reader and GPT policy share `GPT_CONTROL_MODES` and the 64-image
`MAX_GPT_DEMONSTRATION_IMAGES` capacity from `execution/src/gpt-policy.ts`.
A supplied `demonstration` is a strict object with nonblank `textFile` and optional
`imageFiles`, an array of nonblank paths bounded by that capacity. One-shot modes
require demonstration text, and visual one-shot requires at least one image path.
Admission occurs during configuration loading before service acquisition.

Thirty-six declared metadata derivatives of an original direct Astra profile
pass independent production-reader inspection. Thirty invalid modes/types/paths/
capacities/fields reject with exact admitted failure details; six valid inputs
cover default/omitted, textual and visual modes and the 64-path capacity.
Every derivative differs only in its declared mode/demonstration fields. Original
model, Team, worker, checkpoint and service bindings remain unchanged, along with
all ten original/source identities. The selected paths reference existing retained
text and camera files; the capacity check repeats the same original image path
and does not claim a 64-frame demonstration or one-shot model effectiveness.
No model, gateway, worker, simulator or GPU allocates. Evidence:
`.local/work/native-demonstration-final-20261013/independently-verified.json`.
File availability/content and actual one-shot tasks retain startup/native checks.

The same source passes all thirty-nine configured CPU components and 1,394
cases. Independent inspection matches 737 source/input comparisons, unchanged
original journals/images and all thirty-nine released diagnostic process groups.
Camera configuration repeats sixty-six cases and twenty-two declared derivatives;
all writers release. Twenty-four port/endpoint derivatives additionally pass
independent production-reader checks with original bindings unchanged.
Evidence: `.local/work/native-demonstration-cpu-final-20261013/independently-verified.json`,
`.local/work/native-demonstration-port-20261013/independently-verified.json` and
`.local/work/native-demonstration-uri-20261013/independently-verified.json`.

Checkpoint `b69d927` independently matches all 153 campaign production/checker
files, six demonstration sources, five gateway/configuration sources for each
port/endpoint check and fifteen installed-processor sources. Actual Ubuntu CI
`38362872636` passes fresh installation, full source checks and 78 runtime
cases. Downloaded artifacts match fourteen distributions, thirteen imports,
41 input identities and 89 exact-source comparisons. Production readers preserve
seven task-plan journals and 338 retry events in 22 independent native Sessions
with released writers. Original-perception inspection matches forty source
comparisons, fifteen PNG checks, forty-eight depth-statistic fields and nine
exact-commit sources. All native allocations remain zero. Evidence:
`.local/work/native-demonstration-cpu-final-20261013/committed-source-verification.json`,
`.local/work/native-demonstration-final-20261013/committed-source-verification.json`,
`.local/work/ci-native-demonstration-inspection-20261013.json`,
`.local/work/ci-native-demonstration-native-independent-20261013.json` and
`.local/work/native-demonstration-perception-independent-20261013.json`.

`apps/server/src/native-deployment-configuration.mjs` validates the optional
RoboDojo direct/hybrid `policyGatewayPort` during configuration loading, before
managed-service acquisition or gateway/worker allocation. Supplied values must
be integers between 0 and 65535. Omission and zero select an ephemeral gateway
port. `native-policy-environment.mjs` retains gateway, independent DSH host,
native worker, audit and confirmed cleanup ownership.

An optional `workerPolicyUri` passes the existing native endpoint schema during
the same configuration admission. Supplied endpoints use `ws:` or `wss:`, have
a hostname and contain no embedded credentials or fragment. Omission uses the
allocated gateway address. Twelve declared derivatives of the original direct
profile verify admission of the saved URI, omission, secure WebSocket and
localhost values; explicit `null`, arrays, objects, empty text, booleans, numbers,
HTTP URLs and fragments reject. Independent production readers preserve every
original binding and source file, verify five production source digests and
match the exact Zod issues. Twelve gateway-port cases repeat on the same source.
These twenty-four configuration cases allocate no gateway, model, worker,
simulator or GPU. Evidence:
`.local/work/native-gpt-worker-uri-admission-20261013/independently-verified.json`
and `.local/work/native-gpt-worker-port-admission-20261013/independently-verified.json`.

The same endpoint-admission source passes the complete thirty-nine-component
CPU campaign, 1,394 cases and 737 independent source/input comparisons.
All thirty-nine diagnostic process groups release, original journals/images remain
unchanged and writers release. Calibration readers repeat sixty-six cases and
twenty-two declared configuration derivatives with unchanged original values.
Evidence: `.local/work/native-gpt-endpoint-cpu-campaign-20261013/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.

Endpoint-admission checkpoint `33ae4e2` independently matches all 153 captured
campaign production/checker files and all five gateway/configuration sources
for both twelve-case port/endpoint checks. Actual Ubuntu CI `38358983308` passes
fresh installation, full source checks and 78 production runtime cases. Downloaded
artifacts match fourteen distributions, thirteen imports, 41 inputs and 89 exact-
source comparisons. Production readers preserve seven task-plan journals and
338 retry events in 22 native Sessions, with released writers and zero native
allocation. Separate original-perception inspection matches forty source
comparisons, fifteen PNG checks, forty-eight depth-statistic fields and nine
exact-commit sources. Evidence:
`.local/work/native-gpt-endpoint-cpu-campaign-20261013/committed-source-verification.json`,
`.local/work/ci-native-gpt-endpoint-inspection-20261013.json`,
`.local/work/ci-native-gpt-endpoint-native-independent-20261013.json` and
`.local/work/native-gpt-endpoint-perception-independent-20261013.json`.

An original Astra direct profile passes twelve declared runtime configuration
derivatives through the production reader. Explicit `null`, arrays, objects,
text, booleans, negative values, fractional values and values above the TCP port
range reject. The original port, omission, zero and 65535 admit. Independent
production readers compare every derivative with its original configuration,
repeat the exact Zod rejection issues and preserve complete model, Team, worker,
checkpoint and managed-service bindings. Four production source digests and both
original configuration/model files remain unchanged. This scope starts no
gateway, model service, native worker, simulator or GPU job. Evidence:
`.local/work/native-gpt-profile-admission-20261013/independently-verified.json`.
Allocated direct/hybrid tasks and selected endpoint connectivity retain their
native acceptance requirements.

The same configuration-reader source passes the complete thirty-nine-component
configured CPU campaign and 1,394 cases. Independent inspection matches 737
source/input comparisons, unchanged original journals/images and thirty-nine
released diagnostic process groups. The camera component repeats sixty-six
cases and twenty-two declared configuration derivatives with released writers.
Evidence:
`.local/work/native-gpt-configuration-cpu-campaign-20261013/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.

Port-admission checkpoint `e49ee3c` independently matches all 153 campaign
production/checker sources. Actual Ubuntu CI `38357884320` passes fresh
installation, complete source checks and 78 production runtime cases. Downloaded
artifacts match fourteen distributions, thirteen imports, 41 input identities and
89 exact-source comparisons. Production readers preserve all seven task-plan
journals and 338 retry events in 22 native Sessions, with released writers and
zero native allocation. Evidence:
`.local/work/native-gpt-configuration-cpu-campaign-20261013/committed-source-verification.json`,
`.local/work/ci-native-gpt-gateway-inspection-20261013.json` and
`.local/work/ci-native-gpt-gateway-native-independent-20261013.json`.

## Current installed policy processors

The production [processor diagnostic](../../scripts/check-policy-processors-offline.py)
reads original requests and actual checkpoint preprocessing in isolated installed
SDK environments. Select `--provider` from `robotwin`, `robocasa`, `behavior` and
`robodojo`; supply the original record configuration through `--configuration`.
RoboTwin requires its saved checkpoint and tokenizer; GR00T providers require
their selected checkpoint. RoboDojo prepares the actual OpenPI codec without
allocating a policy network.

On 2026-10-13, clean isolated Linux source `5b26a5a` passes seventy-two CPU cases
on forty-six original requests: RoboTwin 7/21, RoboCasa 24/30, BEHAVIOR 3/9 and
RoboDojo 12/12 requests/cases. LeRobot 0.6.1 and GR00T/OpenPI 0.1.0 retain their
actual checkpoint/SDK sources. CUDA stays uninitialized, model allocations/calls
and physical controls remain zero. Invalid prepared-input derivatives reject
before model inference. Canonical server changes remain unchanged.

Independent remote inspection verifies 418 original input/checkpoint/SDK/source
identities and release of all four diagnostic process groups and the runner.
Fifteen loaded production/checker files match the current source. Local archive
inspection matches every provider report and all 282 prepared tensor/codec
metadata fields against their saved original processor records: request and
observation identities, instruction digest, tensor paths/shapes/types/digests,
and RoboDojo packed byte count/digest. Mapping fields are compared by their
exact tensor paths; indexed image order remains part of those paths.
The archive SHA256 is
`4e62d37123b915726330c07e4c326c8cfd54b5fd5fcc3d50296d949f5597f906`.
Evidence:
`.local/work/current-sdk-cpu-linux-20261013-verified/independently-verified.json`.
Its separate `committed-endpoint-source-verification.json` matches all fifteen
loaded production/checker files against `33ae4e2` without re-running processors
or allocating any additional service.
These checks establish original-request preparation, source identity and CPU
process ownership. Current loaded-policy and complete native task behavior retain
their separate release requirements.

## Watchdog thread ownership

`execution/watchdog.py` serializes startup and disarming with its lifecycle lock.
Close before startup or repeated close creates no thread; startup after closure
fails before allocation. Active close joins the original thread, and notification
can disarm from that thread. Deadline/lease-loss fencing preserves callback order
and its original reason. Worker stopping and native device confirmation retain
their existing owners.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-watchdog-owner-offline.py \
  --output .local/work/<new-watchdog-owner-check>
```

Seven actual thread and ResourceArbiter OS-lease cases verify early/active/repeated
close, repeated start, deadline, lease loss, same-thread disarming and concurrent
startup/close. Notifications require prior diagnostic lease fencing; final
readmission confirms actual OS lock availability. The source-bound report records
the installed filelock version. These cases enter the configured CPU campaign and
the source CI's seven-diagnostic, 104-case evidence set. The v6 evidence reader
requires the watchdog report and exact committed source identities before publication.

The macOS configured campaign passes forty-six components and 1,634 cases, with
1,036 independently verified source/input/link comparisons and release of all
forty-six diagnostic process groups. Original journals/images remain unchanged.
Full source checks compile 75 Python files and 58 diagnostics, import 30 base
modules and verify 1,436 local documentation links. Evidence:
`.local/work/watchdog-lifecycle-foundation-cpu-20261013/independently-verified.json`.
No model, simulator, device action or GPU allocates; loaded-policy and native
stop/task acceptance retain their release requirements.

## Required native release evidence

Current-code multi-goal task execution, native stop/timeout races, policy/model
inference, semantic geometry and complete simulator action/video acceptance use
the actual installed models and environments. Evolver remains paused and
SceneState remains deferred. The consolidated campaign must use at most one
physical GPU from GPUs 2–4 on `jd_B300`, with every EDH compute/render component
assigned to that same device.
