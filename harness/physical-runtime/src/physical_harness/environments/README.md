# environments

`NativeEnvironment` defines the synchronous methods called by one simulation owner
thread. `reset` initializes a session scene; `bind_task` validates each later upper
task without resetting that scene. `describe` declares native action, observation,
check and active-view capabilities. `step` reports whether one admitted command
began and completed, plus actual internal simulation steps. Its `should_stop`
callback lets a provider interrupt a longer native command. Unknown check or view
requests fail in the provider.

`NativeObservation` carries bounded camera bytes and selected state channels. It
contains no simulation ground truth. Formal `check` is called only for a confirmed
stopped boundary by the execution worker. The shared wire schema remains in
`harness/contracts/schema/physical.schema.json`. Importing this interface does not
load simulator SDKs.

[factory.py](factory.py) selects the configured native provider and constructs its
adapter. Provider-specific imports occur only after their existing source-root
checks. RoboTwin construction selects its installed working directory; BEHAVIOR
construction retains its native process owner. RoboCasa and RoboDojo reject a
worker source-root override. The Worker calls this factory after its recording,
transport, policy, schema and resource configuration admission, then binds the
adapter to the same NativeActionDevice and owner-thread reset/description flow.

| Entry | Responsibility |
| --- | --- |
| [factory.py](factory.py) | Configured provider selection and native adapter construction |
| [behavior](behavior/README.md) | BEHAVIOR source, native process and R1Pro mapping |
| [robotwin](robotwin/README.md) | RoboTwin installed source and Aloha AgileX mapping |
| [robocasa](robocasa/README.md) | RoboCasa SDK and PandaOmron mapping |
| [robodojo](robodojo/README.md) | EDH-owned RoboDojo RPC, server lifecycle and Dual ARX X5 mapping |

The [factory CPU diagnostic](../../../../../scripts/check-native-environment-factory-offline.py)
uses an original Worker configuration, actual path errors and two uninitialized
RoboDojo adapter instances. It verifies provider admission, independent local state,
pre-reset operation rejection and repeated closure without RPC reset, SDK provider,
model, simulator or device allocation. Loaded native providers keep their release
acceptance requirements.
