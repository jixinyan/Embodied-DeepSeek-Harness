# Capabilities and acceptance

Updated: 2026-10-03. Implementation and native task evidence are recorded separately.
The [v1 acceptance register](v1-delivery.md) contains outstanding delivery gates.

![Framework architecture](../architecture/assets/framework-overview.svg)

## Agent runtime

| Capability | Implementation | Native evidence and limits |
| --- | --- | --- |
| DSH runtime | Selected upstream loop, tool validation and dispatch, private Sessions, follow-ups, cancellation and context management are absorbed into EDH modules with source provenance. | Actual Qwen Planner and independent Verifier run through the production server and physical worker. [Runtime details](current-agent-loop.md). |
| Replaceable upper models | OpenAI-compatible cloud APIs and local vLLM endpoints; configurable models, modalities, context budgets, authentication and image transport. | Actual local Qwen and retained cloud API runs exist. Current task experiments use Qwen with learned execution policies. |
| Composable roles | YAML Teams, Markdown role instructions, explicit model/tool bindings, optional output schemas and independent delegation contexts. | Clean native SceneAnalyst communication and formal task recovery pass. Actual run `04823dd4` verifies same-assignment insufficient-context continuation, versioned reports, caller acknowledgement and cancellation of an independent waiting role. |
| Perceive, plan, decide, act | Planner sees authorized images, maintains versioned plans and TODOs, selects admitted goals and starts bounded jobs. `planning.read.planWrite` returns complete structured write arguments with actual identities and criteria. | RoboTwin verifies formally failed execution followed by explicit retained-scene retry and success. Multi-goal physical acceptance remains pending. |
| Formal verification | Fresh Verifier only after eligible confirmed execution end. It checks admitted criteria and returns a scoped passed, failed or unknown verdict. | Native RoboTwin and RoboDojo successes; truthful failed RoboCasa and BEHAVIOR attempts. A normal pause does not create a Verifier. |
| Retry and replanning | Planner owns every retry, replan and resume. Failed attempts retain scene state, original criteria, evidence and an explicit adjustment record. | RoboTwin native recovery succeeds. RoboCasa and BEHAVIOR record exhausted retries and unsuccessful outcomes. |
| Experience retrieval | SKILL metadata search and selective section loading on demand; source identities and applicability accompany reads. | Keyword retrieval is implemented. Semantic ranking and validated experience transfer require separate acceptance. Evolver development is paused; SceneState implementation is deferred. |

## Physical runtime

| Capability | Implementation | Native evidence and limits |
| --- | --- | --- |
| ActionGate | Identified inference tickets, action generations, bounded chunks, cumulative budgets and confirmed device boundaries between policy and embodiment. | Actual learned action receipts and simulator frame journals preserve request, execution, observation and segment identities. |
| Watchdog and resource leases | Independent deadline/connection watchdog and OS-backed resource arbitration. Device calls finish on their owner thread before lease release. | A genuine stalled native SDK confirms watchdog fencing and owner-thread stopping. A delayed actual RoboCasa learned response admits zero stale controls with unchanged native state. Native concurrent budget/review and repeated stopping preserve the original boundary. [Safety interface](physical-safety.md). |
| RoboTwin | Native task/configuration adapter, Aloha action mapping, learned-policy WebSocket transport and worker-local recordings. | Qwen/Pi0.5 `adjust_bottle` verifies formal failed-attempt recovery and task success. Packaged Desktop submits two actual tasks with explicit historical-context selection and confirmed cleanup. Additional checkpoint-compatible tasks retain separate acceptance. |
| RoboCasa | Native environment, PandaOmron action mapping, RGB-D capture and authorized native task checks. | Qwen/GR00T performs actual controls and retries with zero tool errors. Successful task acceptance remains pending. |
| BEHAVIOR-1K | Native OmniGibson environment, R1Pro mapping, task/scene configuration and scheduled yaw/pitch observation. | Native rotation and Qwen camera workflows pass. Learned-policy task success remains pending. Installed task assets constrain admissible configurations. |
| RoboDojo | EDH-owned dual ARX X5 integration, native simulator service, learned OpenPI bridge and configured direct/hybrid execution paths. | Clean Qwen/Pi0.5 run `897f215d` verifies 58 controls, four learned requests and formal retry success with zero tool errors. Its second task verifies the unchanged ended episode without new actions/inference. Native source/action/video checks and cleanup pass. Original build_tower completion has separate acceptance. [Standalone integration](robodojo-standalone.md). |
| Perception | SAM3.1 segmentation, YOLO26 detection with model-derived depth, immutable source images/masks and calibrated native RGB-D measurement. | Actual model calls and source-bound RoboCasa masked geometry pass. All four providers pass original calibrated three-camera stationary-region measurements. Additional semantic-mask workflows and camera accuracy require their own evidence. |
| Hardware interface | Capability discovery, connection identity, ActionSpec and confirmed stop acknowledgement through the same device boundary. | Interface and scheduling checks exist. Physical robot experiments need a selected device and independent acceptance, as agreed. |

## Console, persistence and demos

The unified console selects compatible environment, embodiment, execution mode,
checkpoint, model and Team configurations. It displays actual role output, tool
inputs/results, plans, TODOs, execution counters, verification and errors. Model
reasoning is displayed only when returned by the selected model.

Simulator frames remain in worker-local recordings for headless deployments.
The console displays Agent trace; source-verified MP4s combine that trace with all
recorded camera views and preserve separate wall-clock and simulator timelines.
[Replay instructions](../../scripts/REPLAY.md) describe export and full decoding checks.

Storage retains private Session histories, immutable sensor/image references,
plans, reports, files, SKILL sources and native audits. Explicit ownership enables
request-identity archival and closed-Session record retirement with restart checks.
Unknown or externally owned reference formats require declared inspection and
resource leases before destructive maintenance is available.

Native deployment factories expose compatible profile selection and complete
default maintenance bindings. Unified four-provider configuration and packaged
Desktop native task execution have production evidence. Installed configuration
switching and the remaining provider/task gates continue under release acceptance.
README presents the framework architecture;
[progress](progress.md) retains evidence and continuation details.
