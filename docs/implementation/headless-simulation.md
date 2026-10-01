# Headless simulation and Agent trace

The console displays role activity, actual model output, tool calls, plans, TODO
states, control counters, device boundaries, formal verdicts and recovery records.
Simulator cameras are recorded on the simulator host. The console does not request
camera image assets. Model-facing observation tools retain image attachments.

## Native worker configuration

Set these fields on the deployment's `NativeWorkerConfiguration`:

```json
{
  "publishRunningImages": false,
  "recordSimulationFrames": false,
  "simulationVideoDirectory": "/absolute/worker-local/ignored/videos"
}
```

Running publications retain observation identity, timestamps, task scope, control
receipts, policy request identity, counters and device state. They contain no image
payload. Metadata evidence has a distinct immutable identity containing the
observation ID and status version. Active captures and confirmed boundary
publications contain the complete camera group. Independent Planner and Verifier
contexts continue to receive authorized image references through DSH.

`recordSimulationFrames: true` explicitly enables recorded frame publication for
an operator export. It is independent of running-image publication and worker-local
recording. Deployment owners select the required recording path and transport mode.

Install the physical package's `recording` extra in the isolated simulator
environment. PyAV encodes each native camera into its own MP4 using native simulator
timestamps. Each execution has an exclusive directory containing camera MP4 files,
`frames.jsonl` and `manifest.json`. The journal identifies each frame's execution,
task scope, policy request, ActionSegment, observation and native physics step.
The recorder flushes when the task closes or the worker disconnects. The directory
is local to the worker; remote hosts transfer the completed files after execution.

The action device, ActionGate, budgets and policy service retain their existing
responsibilities. Recording never supplies task success. A fresh Verifier is assigned
after an eligible confirmed execution end and checks the unchanged native criterion.

## Recorded acceptance

Export the actual task events and model-facing image references with
`scripts/export-run-replay.js`. For learned execution, retain the original policy
requests, native action receipts, identified policy service log and pinned policy
manifest. `scripts/audit-recorded-run.py --simulation-videos DIRECTORY` additionally
requires the worker-local video journal, matching executed segments, decoded frame
counts and native MP4 timestamps. It fully decodes every camera video with FFmpeg.
Success acceptance still requires independent formal verification and Planner finish.

For an actual completed run, transfer the worker's execution directories and retain
the policy log, requests and native sensor samples. Export and render with:

```sh
node scripts/export-run-replay.js --base-url "<console-origin>" \
  --run-id "<actual-run-id>" --output .local/work/recorded-task \
  --policy-log "<identified-policy-log>" --simulation-videos "<worker-video-root>"
"<isolated-render-environment>/bin/python" scripts/render-run-video.py \
  --export .local/work/recorded-task --output .local/work/recorded-task/task.mp4 \
  --simulation-videos .local/work/recorded-task/native-videos \
  --font "<installed-font-file>" --wall-speed 16 --fps 10
```

The exporter retains the original MP4 files, journals and manifests under
`native-videos/`, with file hashes and matching policy request identities.
The composite joins actual model outputs, plans, tools and verification with
worker-recorded frames by their original wall timestamps. Reading holds and
wall-time compression are labeled. The renderer requires Pillow and FFmpeg;
decoded frames use the original media time base without frame duplication.
The native audit still requires the original requests and sensor samples and
independently verifies every camera's decoded simulator timestamps.

Use `--require-clean-role-completion` with the native audit to require completed
Planner TODOs, successful native tool receipts and zero subsequent model steps in
the same turn after each terminal tool. This additional gate reads original DSH
events; ordinary recorded-source audits preserve their existing evidence scope.

Native task results and the exact delivery boundary are recorded in
[implementation progress](progress.md).

Saved source-only records can also be prepared without restarting a console with
`scripts/prepare-recorded-replay.mjs`. The offline path validates immutable
attachments, retains source hashes and supports an explicitly labeled pre-motion
grounding snapshot. `scripts/check-run-video.py` verifies full composite decoding,
encoded frame counts, source hashes and all recorded formal verdicts. See
[recorded demos](recorded-demos.md) for commands and actual delivered outcomes.
