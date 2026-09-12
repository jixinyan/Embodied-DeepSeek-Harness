# Policies

`SubgoalPolicy` defines `infer(request)` and `close()`. `WebSocketPolicyClient` implements
one in-flight inference with bounded requests, cancellation and connection discard on
failure. `serve_policy` wraps a deployment-owned async inference callback. Neither owns
a device or retries physical actions.

The default wire encoding is EDH JSON. Replace the codec for alternate serialization;
implement the policy port for server-specific handshakes or session protocols. No
learned policy or universal existing-server compatibility is claimed. Install the optional
`policy` extra and follow the [adapter guide](../../../../../docs/implementation/model-policy-adapters.md).
