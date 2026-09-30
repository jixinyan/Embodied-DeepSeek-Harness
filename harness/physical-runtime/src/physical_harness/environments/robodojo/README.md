# RoboDojo native service

This module owns the EDH simulator service, current RGB-D capture, calibrated
pixel grounding, measured-state FK checks, numerical IK and velocity-limited
dual-arm target preparation. `RoboDojoEnvironment` is the worker-side RPC client.
`server.py` is the simulator-side entry point. Both use the existing bounded
msgpack/zlib transport and exact episode/step identities.

The simulator process imports a separately installed RoboDojo SDK, IsaacLab,
Isaac Sim and cuRobo. Its source packages and assets have explicit independent
locations. The service has no LitchiAgent or GPT-as-Policy imports. Upper roles
and the execution policy remain native EDH DSH Sessions; each actual control is
admitted by the worker's ActionGate before reaching this service.

`kinematics.py` uses `yourdfpy` to read the robot URDF. Native reset validates
its FK against both measured EEF poses before permitting tools or actions.
`geometry.py` uses the optical camera's actual intrinsics and USD world pose.
`motion.py` anchors a joint delta once at preparation and limits every proposed
tracking step by the measured native velocity limits. FK/IK preparation advances
zero physical steps. Collision-free trajectories are not certified.

The native task registers its original success conditions after reset. The service
never changes its step limit or task criterion. Camera recordings retain initial
and post-action observations. Disconnect ends the owned simulator and closes its
recorders; uncertain native operations invalidate the episode.

Start with [the deployment launcher](../../../../../../examples/deployments/start_robodojo.py)
and an explicit JSON configuration. See [deployment instructions](../../../../../../docs/implementation/robodojo-standalone.md)
and [source provenance](../../../../../../docs/provenance/litchi-robodojo.md).
