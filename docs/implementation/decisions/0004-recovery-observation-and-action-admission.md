# 0004: Recovery observation and interruptible action admission

Status: accepted, 2026-09-08. Recovery observation is implemented in the upper
application. Action admission is a required physical-provider design, not a
connected policy/controller implementation.

## Evolver activation

A failed formal verification does not itself start learning. The decision owner
first decides to replan or retry that failed subgoal. At that decision, it provides
an explicit attempt summary and proposed changes. The harness supplements these
with the immutable failed request, budget, execution outcome and accepted verdict.
It creates one independent Evolver assignment for the recovery. Subsequent retry
calls reuse this recovery instead of creating a second Evolver.

The Evolver receives ordered, bounded batches of explicit planner/tool, execution
and verification events. The host persists the full selected trace. The Evolver
records those messages in its private recovery file; it never reads a sibling's
session or hidden reasoning. This subscription is granted by the decision owner's
recovery request and remains confined to that recovery's public domain events.
Success delivery follows the already admitted progress messages. Only a passed,
current-attempt formal verdict for the original subgoal permits SKILL publication.
Unknown, cancellation, an unrecovered failure and completion of a prerequisite do
not qualify. A routine plan edit before failure does not start a recovery.

Example: a placement attempt fails the cup-inside check. The planner requests a
replan with its failed instruction and proposed access check. The Evolver begins
recording before the revised attempt starts, receives observation and execution
records, then summarizes after the original placement predicate passes.

## Policy output and action execution

[VoLo, section 4.2 and Appendix B](https://arxiv.org/html/2606.07723v1#A2) describes
a proxy between an evaluation client and a policy server, with asynchronous,
interruptible policy rollouts and hold behavior during recovery. EDH adopts that
separation; the following admission rules are EDH design requirements, not claims
that VoLo implements these exact fields or guarantees.

The physical provider must implement this path:

`Policy inference -> Action gate -> Device execution`

The gate is a deterministic execution service, not another reasoning agent. Every
chunk carries execution/attempt identity, a policy request ID, a control generation,
an expiry and the observation reference used for inference. The gate checks current
execution authority, resource ownership, clock/freshness and remaining budget before
each dispatchable segment. A chunk awaiting inference never reserves permission to
move indefinitely.

Pause closes admission and advances the control generation. Queued actions from the
old generation are dropped; a late policy response is rejected, even after resume.
The device adapter then cancels/drains its own buffer and reports its confirmed
boundary and last executed action. A robot-specific hold controller may be needed.
Resume requires the decision owner, a reconciled stopped state and fresh inference.
User stop bypasses model reasoning. Switching to an action primitive uses the same
motion gate and resource accounting.

A 16-action chunk stopped after action 5 leaves actions 6-16 unissued or explicitly
cancelled in the controller. Closing the software gate alone cannot retract actions
already committed inside hardware. A provider must declare its maximum committed
segment, cancellation granularity, buffering and measured stop latency. If stop is
unconfirmed, report uncertainty and retain the resource lease; never report a
confirmed pause or let another motion tool take over.

## Implementation sequence and acceptance

1. Define the canonical chunk, gate state and stop acknowledgement alongside the
   physical provider transport. Keep units, frames and action-space bindings explicit.
2. Implement the provider gate with generation invalidation and budget accounting.
3. Test pause during inference, pause during a chunk, late responses after retry,
   resume with old queued actions, expired observations and conflicting motion tools.
4. Test cancellation acknowledgements and hold behavior against the selected simulator.
5. Measure actual controller stop latency before making hardware guarantees.

This phase implements and tests upper pause/stop/verification behavior using a CPU
fixture. It does not claim sub-chunk interruption on a VLA or device. The console
must label this distinction and later show gate state separately from device state.

## Failure knowledge in skills

A published recovery skill includes both failure and success knowledge. Required
sections are When to use, Failure signals, Possible causes, Avoid, Planning guidance,
Verification guidance, Limits and Source. The metadata retains evidence from the
failed attempt as well as the accepted successful verdict. Observed failure
conditions must be distinguished from suspected causes; a changed retry succeeding
does not alone establish causality. Unsuccessful corrections and counterexamples
belong in the recovery trace and summary. Recoveries that never succeed retain
failure records, without being relabeled as successful recovery skills.
