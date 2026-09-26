# Third-party provenance

## EDH licensing scope

Copyright (c) 2026 Embodied DeepSeek Harness contributors.

Except for separately identified files and upstream materials, EDH-authored
framework code is licensed under GNU Affero General Public License version 3
only (`AGPL-3.0-only`), provided in [LICENSE](LICENSE). It is distributed without
any warranty; see the license for the complete terms.

These two independently runnable EDH-authored files retain the
[MIT license](licenses/EDH-MIT.txt):

- `harness/physical-runtime/src/physical_harness/perception/sam31.py`
- `examples/perception/check_sam31.py`

The SAM HTTP client and the rest of the EDH-authored framework remain under the
framework license. The MIT service uses a separate installation of SAM. Meta's
SAM source, weights and other SAM materials retain the SAM License; the MIT
permission for EDH's service grants no additional rights to those materials.
The service's source and checkpoint revisions are independently recorded.

Ultralytics YOLO26 source and models retain their upstream AGPL terms. Model
checkpoints and simulator datasets are separately obtained and are excluded from
this repository. The [integration license review](docs/provenance/v1-license-review.md)
records inspected versions and distribution checks.

Operators of modified network-accessible versions must provide the corresponding
source as required by AGPL section 13. Source offers must cover the running version,
including applicable modifications and build instructions. Model-service separation
does not, on its own, establish the licensing status of a combined distribution.

## Absorbed runtime source

EDH is an independent project and is not an official DeepSeek product.
It selectively incorporates DeepSeek Harness source from commit
`d347e703908d0406b7a7ef80e3a0e594d86b2215` into its agents, models, tools, storage
and foundation modules. The [file map](docs/provenance/dsh-imports.json) records
original paths, EDH destinations, exact hashes and every local modification.

The DSH MIT notice is retained in [licenses/DSH-MIT.txt](licenses/DSH-MIT.txt).
The included Cordis, Cosmokit and Schemastery sources carry Shigma's MIT notices:
[CORDIS](licenses/CORDIS-MIT.txt), [COSMOKIT](licenses/COSMOKIT-MIT.txt),
[SCHEMASTERY](licenses/SCHEMASTERY-MIT.txt). Their DSH baseline already contains
upstream-local changes; EDH records that exact baseline rather than asserting an
unmodified copy of the separate library repositories.

DSH module identifiers are retained internally for source/declaration compatibility;
they resolve only to pinned local files. No external DSH product installation or
upstream CLI is used. JavaScript dependencies retain their own licenses. Model
weights, simulator assets and datasets are not included and have separate terms.
