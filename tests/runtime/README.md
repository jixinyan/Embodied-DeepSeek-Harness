# DSH runtime acceptance

Run `pnpm test:runtime` from the repository root. Nine tests assemble the actual EDH
host and original DSH loop with a scripted model. They check structured tool results,
later host input, sibling isolation, direct out-of-scope dispatch, cancellation,
creation rollback and shutdown draining. Every physical-looking value is synthetic.

The model fixture only emits stream chunks and records requests. It does not decide
when to call tools or implement an agent loop. Tests require no API key, ports, GPU,
policy or simulator. See [the integration guide](../../docs/implementation/dsh-integration.md)
for the exact seams and their limits. Physical recovery acceptance belongs to later steps.
