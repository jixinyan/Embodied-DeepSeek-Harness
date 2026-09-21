# README status badges

The repository README reuses the console's original logo. Its GitHub Actions badge
reports the `Framework checks` workflow on `main`; private-repository access requires
a signed-in collaborator. A failed or running workflow keeps its actual GitHub status.

The local SVG badges summarize maintained project milestones:

- `development.svg`: release maturity, from the [project status](../../implementation/progress.md).
- `models.svg`: implemented adapter families, from [model configuration](../../implementation/model-configuration.md).
- `physical-runtime.svg`: provider integration, from the [capability map](../../implementation/features.md).

Update each milestone badge together with its source document when that capability
changes. Adapter availability does not certify live-model or physical acceptance.
CI status is supplied by GitHub and is never copied into a static passing badge.
