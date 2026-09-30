# RoboDojo and Litchi execution integration

Reference: LitchiAgent `6432afc381dce530eb7107d6885ce51fbd2d9334`, inspected through
authorized repository access. The [MIT notice](../../licenses/LITCHI-MIT.txt)
is retained. Selected numerical and sensor mechanisms are adapted into EDH's
physical runtime. EDH's deployed service entry point imports the installed simulator
SDK and contains no LitchiAgent or GPT-as-Policy runtime imports.

| Reference | EDH adaptation |
| --- | --- |
| `litchi_agent/session.py`, `client.py`, `server.py` | EDH `robodojo/session.py`, `server.py` and existing client: exact episode/step identities, native reset/check registration, current RGB-D and owned process lifetime |
| `litchi_agent/joint_motion.py`, `geometry.py` | EDH `robodojo/motion.py`, `geometry.py`: numerical IK, anchored joint deltas and velocity-limited target preparation |
| `litchi_agent/hybrid.py`, `hybrid_schema.py` | Complete local plan, dual-arm intent, FK-reviewed proposal and bounded approved prefix |
| `litchi_agent/demonstration.py` and prompts | Explicit zero-shot, textual one-shot and visual one-shot configuration |
| `litchi_agent/runner.py`, `launch.py` | GPT action-policy role using native EDH DSH sessions and tools; credential remains in the process environment |

The installed external RoboDojo reference is
`726e9aabfaa642203722eb126f5eaf0f37f3e1ad`, with Isaac Sim 5.1 and IsaacLab 2.3.2.
Its source, datasets and simulator assets retain their upstream research license
and are not distributed here. Provider-specific runtime and GPU selection are
deployment configuration. The EDH worker does not import Isaac Sim.

High-level Planner owns subgoals and recovery. The GPT policy owns the local
execution plan. Both EEF and joint motion advance exclusively through ActionGate.
Formal Verifier runs after an eligible confirmed execution end. Simulator GT and
RGB-D are permitted, with source and simulator revision recorded in the run.
Hardware uses provider observations and grounding through the same interfaces.

GPT-as-Policy revision `8f3d362b077d8efb77e2a7274d5b2c20e2243846`
provides the reference optical pose transforms and dual-arm FK validation semantics.
Its MIT notice has the same authors, year and terms as the retained notice above.
EDH `robodojo/kinematics.py` uses the installed `yourdfpy` parser and validates
its calculated poses against native measurements. EDH uses its existing RPC array
codec and its own service process. Framework source retains EDH's AGPL-3.0 license
and the original MIT notice for adapted mechanisms.

See [independent deployment](../implementation/robodojo-standalone.md) for explicit
source, asset, environment, GPU and service configuration. Real independent-service
acceptance is recorded separately from earlier external-service evidence.

Type checks, Python compilation and configuration-selection checks establish
implementation consistency. Actual task acceptance requires the named simulator,
real model endpoint, camera evidence, committed controls and native verdict.
