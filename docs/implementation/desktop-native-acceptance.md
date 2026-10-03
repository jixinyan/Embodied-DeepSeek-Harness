# Packaged Desktop native task acceptance

The packaged macOS Electron application executes the saved native RoboTwin
deployment through the existing EDH service and Console. Actual DOM actions select
the compatible configuration, create one Session, submit two tasks, select earlier
task context for the second submission and close the Session and owned service.
No browser screenshots or substituted API responses participate in this check.

## Configuration and original sources

The service and remote worker use immutable EDH source `d1dc4ab`. All 751 original
source files match the Git archive on both hosts. The remote inventory separately
identifies its read-only WebSocket readiness helper. RoboTwin source is
`bf44be51cf5717a5595ce59447f2cf5263d2aa95`; the selected task is `adjust_bottle`,
`demo_clean`, seed zero, with its original native success predicate.
Qwen3.8-27B supplies independent Planner, SceneAnalyst and Verifier contexts.
The Pi0.5 checkpoint is
`SidneyXie/pi05_robotwin@e49e2ab6c11f07511573b67261bd129e88d0a416`.
The identified service verifies its original checkpoint files and implementation.

Session `30d91ef8-8ee2-4a25-be91-0aeb50dca166` retains the same native environment
between the two task submissions. The complete original HTTP exchanges, DOM text,
closed journal, worker wire stream, action receipts, policy records and native
camera videos remain in ignored private evidence directories.

## First task: learned execution and retained-scene retry

Run `bd3e1606-3430-47f1-ae0d-df234052ec9e` has 724 original events and four independent
role Sessions. SceneAnalyst reports selected-schema evidence and Planner explicitly
acknowledges it. The first execution completes 64 controls and four learned requests,
reaches its confirmed budget boundary and receives a failed formal verdict.
Planner supplies an explicit recovery decision and continues the retained scene.
The second execution completes 37 controls and three learned requests, reaches
native episode termination and receives a fresh passed formal verdict.

The complete audit verifies 101 action receipts, seven identified inferences,
10,070 reported native physics steps, 493 validated sensor samples and six native
camera videos containing 386 frame groups. Every original video fully decodes and
matches its recorded timestamps. All nine owner TODOs complete, all four assignments
retire, and terminal tool receipts precede completed native turns. Tool errors and
post-terminal model steps are zero.

## Second task: explicit historical context and current verification

Run `9f81a1ec-a38b-42cc-b464-9d278505b1a9` explicitly selects the first task as context.
It has 170 original events, three fresh independent roles and eight completed owner
TODOs. Its already-ended native episode receives a new confirmed
`episode_terminated` boundary and a fresh formal passed verdict. Original worker
publication and policy records show zero additional controls or inference requests.
All nine recorded camera comparisons match the previous terminal state.

Production Session/history readers check ordered membership, distinct role Sessions,
original goal criteria, verdict scope and completed plans against a copy of the
closed journal. The original journal remains unchanged with SHA-256
`7956b5c7d2b05e23796077a53709782cad9598a7ecb7ebc177c7901fdde7374c`.
This source records reported zero additional physics steps; independent native
terminal-source verification is unavailable because its original provider did not
retain the native terminal snapshot.

## Cleanup and recorded demo

The actual **End session** receipt confirms `closed` and `resources=released`.
**Stop service** confirms child exit, writer-lock release and a closed loopback
listener. The renderers retain sandbox and context isolation with no Node access
or JavaScript errors. The owned remote Pi0.5 service also exits and closes its port.

The synchronized first-task MP4 contains 24 original model-analysis events,
SceneAnalyst communication, tools, plans, TODOs, both formal verdicts and all three
recorded camera views. It has 2,004 frames at 12 fps, lasts 167 seconds and fully
decodes. Every rendered text boundary and original source hash passes validation.
MP4 SHA-256:
`d0dbef0d82661fcdb8d35014dd25dffd8bc7aad89690965db316727e0ae252fa`.

Local evidence: `.local/work/native-desktop-frozen-twin-20261003/`.
Native evidence: `.local/work/v1-robotwin-desktop-20261003/` on the simulator host.
The complete transferred native archive matches SHA-256
`f2163a47a11beeb76284cd6a6d4510d2e659826cdd769597e2926a42e7f71d36`.
Generated media, model requests and native data remain outside Git.

Use the [native workspace guide](native-workspace.md) for grouped compatible
profiles and [release validation](release-validation.md) for additional installed
task/configuration acceptance. Signing and distribution have their own release gates.
