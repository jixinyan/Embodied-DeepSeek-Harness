"""Execution-mode contracts shared by GPT direct and hybrid policies.

These helpers deliberately validate *proposals* before they reach ActionGate;
they never dispatch an action and therefore cannot create a second control loop.
The vocabulary is based on the local LitchiAgent implementation:
``gpt_only`` maps to ``direct`` and ``pi05_plus_gpt`` maps to ``hybrid``.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import math
from copy import deepcopy
from typing import Any, Mapping, Sequence


class ExecutionMode(StrEnum):
    POLICY = "policy"
    DIRECT = "direct"
    HYBRID = "hybrid"

    @classmethod
    def parse(cls, value: object) -> "ExecutionMode":
        if not isinstance(value, str):
            raise ValueError("Execution mode must be a string.")
        try:
            return cls(value)
        except ValueError as error:
            raise ValueError(f"Unsupported execution mode: {value!r}.") from error


@dataclass(frozen=True)
class HybridReview:
    """A model review that authorizes a bounded prefix of a lower-policy proposal."""

    decision: str
    reason: str
    confidence: float
    safe_steps: int
    grounding_refs: tuple[str, ...] = ()
    subtask_ids: tuple[str, ...] = ()


def _finite_action(action: Sequence[object], channels: Sequence[Mapping[str, object]]) -> tuple[float, ...]:
    if not isinstance(action, (list, tuple)):
        raise ValueError("Action must be a list or tuple of numbers.")
    if len(action) != len(channels):
        raise ValueError("Action dimension does not match the admitted ActionSpec.")
    values: list[float] = []
    for value, channel in zip(action, channels):
        if type(value) not in (int, float) or not math.isfinite(float(value)):
            raise ValueError("Action values must be finite numbers.")
        number = float(value)
        minimum, maximum = channel.get("minimum"), channel.get("maximum")
        if not isinstance(minimum, (int, float)) or not isinstance(maximum, (int, float)):
            raise ValueError("ActionSpec channel limits must be numeric.")
        if number < float(minimum) or number > float(maximum):
            raise ValueError("Action value exceeds the admitted ActionSpec limits.")
        values.append(number)
    return tuple(values)


def validate_direct_action(action: Sequence[object], action_spec: Mapping[str, object]) -> tuple[float, ...]:
    """Validate one direct EEF/joint command after its transform to canonical actions."""

    channels = action_spec.get("channels")
    if not isinstance(channels, list) or not channels:
        raise ValueError("ActionSpec has no channels.")
    return _finite_action(action, channels)


def validate_hybrid_proposal(
    proposal: Sequence[Sequence[object]],
    action_spec: Mapping[str, object],
    review: HybridReview,
    *,
    max_safe_steps: int = 15,
) -> tuple[tuple[float, ...], ...]:
    """Return only the reviewed prefix; the caller submits it through ActionGate."""

    if type(max_safe_steps) is not int or not 1 <= max_safe_steps <= 512:
        raise ValueError("Hybrid safe-step bound must be between 1 and 512.")
    if review.decision not in ("allow", "intervene"):
        raise ValueError("Hybrid review decision must be allow or intervene.")
    if not review.reason.strip() or not math.isfinite(review.confidence) or not 0 <= review.confidence <= 1:
        raise ValueError("Hybrid review reason and confidence are invalid.")
    if type(review.safe_steps) is not int or not 1 <= review.safe_steps <= max_safe_steps:
        raise ValueError("Hybrid review safe_steps is outside the admitted bound.")
    if review.decision == "intervene":
        raise ValueError("Intervened hybrid proposals must be replaced by a direct correction.")
    if not proposal or any(not isinstance(action, (list, tuple)) for action in proposal) or review.safe_steps > len(proposal):
        raise ValueError("Hybrid review asks for more actions than the proposal contains.")
    channels = action_spec.get("channels")
    if not isinstance(channels, list) or not channels:
        raise ValueError("ActionSpec has no channels.")
    return tuple(_finite_action(action, channels) for action in proposal[: review.safe_steps])


def execution_mode_from_policy_config(config: Mapping[str, object]) -> ExecutionMode:
    """Read the optional profile key without changing the v1 profile schema."""

    value = config.get("execution_mode", ExecutionMode.POLICY.value)
    return ExecutionMode.parse(value)


def _identity(request: Mapping[str, object], response: Mapping[str, object]) -> None:
    request_id = response.get("request_id")
    if request_id != request.get("request_id"):
        raise ValueError("Mode policy response does not match the current request.")


def _canonical(request: Mapping[str, object], actions: Sequence[Sequence[object]]) -> dict[str, object]:
    """Build an ActionChunk from a mode-specific proposal after validation."""

    return {
        "schema_version": "physical.action_chunk.v1",
        **{
            key: deepcopy(request[key])
            for key in (
                "request_id", "execution_id", "task_scope", "generation", "observation_id",
                "valid_until", "action_spec",
            )
        },
        "actions": [list(action) for action in actions],
    }


def _review(value: object) -> HybridReview:
    if not isinstance(value, Mapping):
        raise ValueError("Hybrid response has no review object.")
    refs = value.get("grounding_refs", ())
    subtasks = value.get("subtask_ids", ())
    decision, reason = value.get("decision"), value.get("reason")
    confidence, safe_steps = value.get("confidence"), value.get("safe_steps")
    if not isinstance(decision, str) or not isinstance(reason, str):
        raise ValueError("Hybrid review decision and reason are required strings.")
    if type(confidence) not in (int, float) or type(safe_steps) is not int:
        raise ValueError("Hybrid review confidence and safe_steps have invalid types.")
    if not isinstance(refs, (list, tuple)) or not all(isinstance(item, str) and item for item in refs):
        raise ValueError("Hybrid grounding_refs must be nonempty strings.")
    if not isinstance(subtasks, (list, tuple)) or not all(isinstance(item, str) and item for item in subtasks):
        raise ValueError("Hybrid subtask_ids must be nonempty strings.")
    return HybridReview(
        decision=decision,
        reason=reason,
        confidence=float(confidence),
        safe_steps=safe_steps,
        grounding_refs=tuple(refs),
        subtask_ids=tuple(subtasks),
    )


def normalize_mode_response(
    response: object,
    request: Mapping[str, object],
    mode: ExecutionMode | str,
) -> dict[str, object]:
    """Normalize Litchi-style direct/hybrid envelopes into one ActionChunk.

    The lower worker still sends exactly one canonical chunk to ActionGate. A
    direct envelope contains one already-transformed canonical action. A hybrid
    envelope contains a bounded lower-policy proposal and a GPT review; an
    intervention must carry a direct replacement action. This function does not
    call a device or create another loop.
    """

    selected = ExecutionMode.parse(mode)
    if not isinstance(response, Mapping):
        raise ValueError("Mode policy response must be an object.")
    if selected is ExecutionMode.POLICY:
        return dict(response)
    if response.get("mode") != selected.value:
        raise ValueError(f"Policy response mode must be {selected.value!r}.")
    _identity(request, response)
    action_spec = request.get("action_spec")
    if not isinstance(action_spec, Mapping):
        raise ValueError("Policy request has no ActionSpec.")
    if selected is ExecutionMode.DIRECT:
        action = response.get("action")
        return _canonical(request, [validate_direct_action(action, action_spec)])

    proposal = response.get("proposal")
    if not isinstance(proposal, (list, tuple)) or not proposal or len(proposal) > 512:
        raise ValueError("Hybrid proposal must contain 1 to 512 actions.")
    review = _review(response.get("review"))
    if review.decision == "intervene":
        intervention = response.get("intervention")
        return _canonical(request, [validate_direct_action(intervention, action_spec)])
    return _canonical(request, validate_hybrid_proposal(proposal, action_spec, review))
