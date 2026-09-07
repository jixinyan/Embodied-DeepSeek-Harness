# Third-party provenance

EDH is an independent project and is not an official DeepSeek product.
The runtime design targets selected implementations from DeepSeek Harness.
This bootstrap contains **no copied DSH runtime implementation**. Its exact
source baseline, manifest dependency closure and intended module mapping are
recorded in [the provenance directory](docs/provenance/README.md).

The DSH source license is retained in [licenses/DSH-MIT.txt](licenses/DSH-MIT.txt)
for provenance; its presence does not mean the runtime has been integrated.
When importing source, retain applicable notices and record each original
path, revision, destination and modifications. Third-party packages used by
that source must be reviewed separately; they do not all inherit DSH's license.

JavaScript development dependencies retain their own licenses. Model weights,
simulator assets and datasets are not included and have separate terms.
