# Contributing

Start with [development setup](docs/development/setup.md),
[module responsibilities](docs/architecture/modules.md), and
[implementation progress](docs/implementation/progress.md).

Implement a bounded step with its acceptance evidence. Contract changes update
the JSON Schema and regenerate types. Add behavior tests when behavior exists;
scaffold checks do not substitute for lifecycle, policy or adapter verification.

Every contribution should explain the problem, resulting behavior, validation
commands/results and material limitations. Keep private run data and model
weights outside the repository. Use SVG for architecture figures.

Commit small, coherent changes frequently after relevant checks, rather than
accumulating a whole implementation phase in one commit. For example, commit a
protocol update with its fixtures separately from the provider that consumes it.
Inspect and stage only the intended changes, use descriptive messages, and push
completed checkpoints at delivery or handoff. Preserve published history and
leave unrelated work intact. See [AGENTS.md](AGENTS.md) for the full policy.

Use English for all public repository content, including SVG labels and examples.
Internal planning discussions may use Chinese.
