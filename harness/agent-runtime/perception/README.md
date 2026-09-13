# Perception tools

The Planner calls capture/active observation directly and receives images as native
DSH image content. `admitSensorSample` validates bounded metadata and immutable image
references supplied by an EmbodiedBackend. `sensorImages` assembles only explicitly
granted samples. Neither function creates an independent perception agent.

Custom perception tools remain ordinary native DSH tools. Real camera bytes and
normalization belong to the deployment attachment store and model resolver; SAM,
depth/localization and simulator providers still require actual integration.
See the [Planner loop and image path](../../../docs/implementation/model-policy-adapters.md).
