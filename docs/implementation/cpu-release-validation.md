# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).
The base Python package includes Pillow for PNG observation encoding; WebSocket
inference and original-journal inspection use the `policy` and `diagnostics` extras.

## Consolidated CPU campaign

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

## Core tool evidence selection

`coreToolEvidenceIds` in the tools module owns model-facing evidence selection.
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

The four EDH JSON service entries bind their configured port before checkpoint
or upstream initialization and before importing their optional model SDKs.
They use `serve_policy(..., start_serving=False)` and the actual WebSocket Server's
asynchronous context manager. `server.start_serving()` opens connection admission
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
Forty-four actual subprocess cases cover ten example/module help commands,
eight occupied ports, eight missing-checkpoint failures, two native missing-inventory
failures, six native invalid-port rejections and ten malformed selected-digest
rejections. Existing listeners retain actual connection
acceptance after each candidate exits; failed-startup ports become reusable.
Help completes without optional SDK imports, including the native OpenPI producer.
The native producer validates its fixed port in `1..65535`, verifies the complete
pinned checkpoint and writes the verification report before SDK imports. The
diagnostic checks named missing-file errors and exit status 2 for invalid ports,
with no verification report after rejection. Loaded producer readiness and model
inference retain their native requirements.

All forty-four entry cases pass on macOS and isolated Linux from clean `43ad63c`.
The report records eighteen executable/schema hashes, including the original
checkpoint provenance and native inventory readers. Named admission outcomes
precede SDK imports and rejected native startup publishes no verification report.
Evidence: `policy-startup/acceptance.json` under the two current campaign directories
listed above.
The [checkpoint binding diagnostic](checkpoint-bindings.md#cpu-validation) uses
actual original artifacts to check computed identity and mismatched-digest
rejection; loaded custom-checkpoint and physical task acceptance remain native gates.

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

## Required native release evidence

Current-code multi-goal task execution, native stop/timeout races, policy/model
inference, semantic geometry and complete simulator action/video acceptance use
the actual installed models and environments. Evolver remains paused and
SceneState remains deferred. The consolidated campaign must use at most one
physical GPU from GPUs 2–4 on `jd_B300`, with every EDH compute/render component
assigned to that same device.
