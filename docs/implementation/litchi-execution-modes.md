# GPT policy execution modes

EDH supports three policy selections through `policy.config.execution_mode`:

| EDH mode | LitchiAgent reference | Control contract |
| --- | --- | --- |
| `policy` | Learned policy only | A WebSocket policy returns canonical `ActionChunk` values. |
| `direct` | `evaluation_method=gpt_only` | GPT selects a direct EEF or joint command; the gateway transforms it to the admitted `ActionSpec` and submits it through ActionGate. |
| `hybrid` | `evaluation_method=pi05_plus_gpt` | A lower policy proposes a finite action horizon; GPT reviews the proposal and only the reviewed prefix is admitted. An intervention replaces the proposal with a direct correction. |

`direct` and `hybrid` are policy-gateway modes, not a second agent loop. DSH still
owns the model stream, tool dispatch and durable conversation. The physical worker
still owns one simulator thread, and ActionGate remains the only action admission
boundary. The Python validators in
[`execution/modes.py`](../../harness/physical-runtime/src/physical_harness/execution/modes.py)
reject non-finite values, wrong dimensions, unsafe prefixes and unreviewed
interventions before a device call.

The local LitchiAgent checkout was inspected at `/mnt/data/users/jixin/workspace/code/LitchiAgent`.
Its direct path uses grounded EEF/joint tools and its hybrid path uses
`pi05_infer → review_pi05 → pi05_execute`. EDH adopts the contracts and provenance
of those boundaries; it does not import LitchiAgent, Codex app-server code or its
RoboDojo sources. Litchi's `0-shot`, `textual-1-shot` and `visual-1-shot` values are
prompt/context variants of the direct mode and are passed to the selected policy
gateway without changing ActionGate semantics.

The EDH WebSocket policy client accepts these mode envelopes and converts them to
the canonical action contract before admission:

```json
{"mode":"direct","request_id":"...","action":[0.0,0.0]}
```

```json
{
  "mode":"hybrid", "request_id":"...", "proposal":[[0.0,0.0]],
  "review":{"decision":"allow","reason":"grounded","confidence":0.9,"safe_steps":1}
}
```

An intervention uses the same hybrid envelope with `decision: "intervene"` and
an `intervention` action. The resulting reviewed prefix or correction is the only
value sent to ActionGate; the lower device never receives a proposal that the
review did not authorize.

For a native DSH model deployment, [`DshGptPolicy`](../../harness/agent-runtime/execution/src/gpt-policy.ts)
implements the same direct/hybrid sequence using the existing DSH session,
tool schema, image attachment and cancellation services. It exposes only a
proposal callback to the transport; device dispatch remains in the worker.

For an installed profile, select a mode as provider-owned configuration:

```json
{
  "id": "gpt6-astra-robodojo",
  "provider": "openai-responses",
  "modelFamily": "gpt-6-astra",
  "transport": "responses",
  "config": {
    "execution_mode": "hybrid",
    "control_mode": "visual-1-shot"
  }
}
```

The profile remains schema-v1 compatible because `PolicyProfile.config` is
provider-owned extensible metadata. A deployment validator must reject a mode it
does not implement, and the native worker echoes the selected mode during
initialization so a mismatched worker cannot start.

## GPT-6 Astra transport

The model configuration endpoint accepts `protocol: responses`. The
`OpenAIResponsesAdapter` sends the DSH conversation and tool schemas to the
Responses API, translates streamed text/reasoning/function calls back to DSH
`StreamChunk` values, and leaves tool execution to DSH. It supports durable image
attachments through the existing image resolver, so visual direct mode does not
grant a model arbitrary filesystem or URL access.

The official model documentation identifies the model as `gpt-6-astra` and
requires the Responses API for tool calling:
<https://developers.openai.com/api/docs/models/gpt-6-astra>.
The local Litchi runtime configuration was used for a live EDH text smoke and
direct/hybrid policy rounds on 2026-09-30. No repository credential or runtime
response is stored here; a deployment must provide its private environment
credential and run its own endpoint and physical-task checks.
