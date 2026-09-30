# robocasa

`RoboCasaEnvironment` binds RoboCasa 1.0.1, robosuite 1.5.2 and MuJoCo 3.3.1 to
PandaOmron's `HYBRID_MOBILE_BASE` controller. It validates the native 12-channel
layout, normalized limits and 20 Hz control frequency after the actual scene reset.
The last channel is `base_mode`. Session configuration selects a seed and split or
explicit layout/style IDs, plus texture and camera randomization settings. Unknown
or conflicting fields fail. A later upper task must use the same native task ID;
`bind_task` preserves the current scene.

Three 256 × 256 RGB cameras and the five proprioception arrays used by the official
PandaOmron GR00T mapping are captured as native observations. The only registered
formal check is RoboCasa's task success predicate under `task_success`. The adapter
does not expose active camera movement. `step` calls one actual robosuite control
step and reports the measured MuJoCo internal step count. A manually specified
neutral control action passed one step with 25 internal steps in the isolated GPU
environment. That check did not execute a learned policy or complete the task.

Simulator calls must stay on the execution worker's owner thread. The adapter alone
does not publish upper agent updates, image references or formal verdicts.

On 2026-09-30, the GPU1 native gate check passed reset, three-camera capture,
manual control, confirmed pause/resume, a second execution on the retained scene,
and a stable simulator clock after an in-flight stop. A separate worker check used
the checkpoint-backed GR00T-N1.6 policy on GPU6. Its first task executed seven
admitted controls and 175 MuJoCo steps, published native camera frames, and
returned `task_success=false` at a confirmed boundary. The worker opened and
closed a second task on the same scene, then exited. The local report is
`.local/work/robocasa-agent-worker/result.json`; the remote gate report is
`.local/work/robocasa-agent-gpu1-gate/result.json`. These checks establish
policy-to-simulator control and Session task lifecycle for this deployment.
Successful OpenCabinet completion and recovery remain unverified.

A subsequent native console run, `eb163146-9971-4fa2-b040-7a65fcf2424c`, used the
configured Astra Responses model, the same GR00T checkpoint and the environment's
exact `Open the cabinet door.` instruction. The first attempt executed 1,050
controls, 132 policy calls and 26,250 MuJoCo steps. It ended with
`budget_exhausted` at a confirmed device boundary. An independent Verifier read
the native `task_success=false` result and submitted a failed verdict. The
Planner explicitly requested a retry on the retained scene, and an independent
Evolver recorded that recovery. The second attempt executed 1,002 controls, 126
policy calls and 25,050 MuJoCo steps before a confirmed `backend_error` boundary.
The worker's ten-second `writer.drain()` deadline expired while publishing an
execution update. No successful recovery verdict or recovery SKILL was produced.

SAM requests in that run reached the real service, while the native DSH tool's
ten-second deadline expired before a segmentation result could be published.
The segmentation schema now uses DSH-supported string fields and preserves the
128/128/1,024-character domain limits separately. Provider-specific segmentation
timeout wiring and the SAM-enabled deployment remain uncommitted work in progress.
Successful cold and warm segmentation publication through DSH, native task success
termination, and same-Session success-predicate lifecycle checks remain pending.

A separate cancellation run, `7e9ef306-42c3-4511-a831-65c3aee5431d`, invoked the
segmentation tool and closed its Session two seconds later. The native tool call
was cancelled, resources were released, and no segmentation completion for that
call appeared during the following 45 seconds. The SAM service's first
`add_prompt` log followed the Session close, so this check covers cancellation
during the request/startup path; cancellation during an already-running cold
inference remains unverified. Both Sessions were closed, and the owned console,
GR00T, SAM and port-forward processes were stopped.

The local evidence directory is `.local/work/robocasa-sam-20260930/`, including
`run-final.json`, `backend-failure.json`, `server-repaired.log`, `sam.log`,
`sam-cancel.log`, `session-closed.json` and `cancellation-result.json`. These are
private run records and are excluded from Git. The schema tests, TypeScript
checking, formatting checks and `git diff --check` passed at this checkpoint.
