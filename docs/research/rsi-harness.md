# RSI harness research boundary

The research scope for this repository is the harness component of recursive
self-improvement (RSI): how a frozen model, tools, policy selection, memory and
physical execution produce an auditable trajectory, and how a later experiment
may propose a new harness configuration. Model-weight training is outside EDH.

PhysicalRSI 1.0 describes a System 1 that executes through skills and physical
APIs and a System 2 that analyses trajectories and proposes harness changes:
<https://mmlab.hk/research/PhysicalRSI>. This maps naturally onto EDH's existing
Planner/Verifier ownership and recovery records. The harness must preserve the
original task contract and device boundary while allowing a research run to
compare prompt, tool, policy-mode and memory revisions.

Every future RSI experiment should therefore retain:

- a run and episode identity, immutable task/goal/attempt scope and all random
  seeds;
- exact simulator, embodiment, policy, model, mode and prompt revisions;
- observation and action identities, ActionSpec, generation, stop boundary and
  uncertainty state;
- model/tool events, policy proposals, hybrid reviews, committed prefixes and
  formal verification results;
- a replayable artifact index with source provenance and explicit limitations.

The existing EDH event store, observation references, policy request recording,
ActionGate receipts and recovery lineage provide these hooks. The RoboDojo
adapter adds native episode/step identities and no-rollback semantics. A research
evolver may write a candidate profile or prompt revision only as a versioned
proposal; the decision owner and formal verifier remain authoritative, and a
failed or uncertain physical outcome cannot be converted into a successful
training example.

This separation keeps the open-source runtime useful to ordinary deployments
while making RSI comparisons reproducible. Synthetic CPU fixtures can verify
identity and admission invariants, but they must never be reported as physical
RSI improvement or successful simulator control.
