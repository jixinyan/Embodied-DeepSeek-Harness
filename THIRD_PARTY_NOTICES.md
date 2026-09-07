# Third-party provenance

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
