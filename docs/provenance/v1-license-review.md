# v1 integration license review

Review date: 2026-09-26. The user approved an AGPL-3.0 integrated release subject
to dependency compatibility review. The repository currently retains its MIT
license while the implementation and distribution checks below are completed.
This is a source and packaging review, not a legal opinion about every deployment.

## Reviewed components

| Component | Inspected terms | Required handling |
| --- | --- | --- |
| EDH-authored harness code | Current MIT; user authorized AGPL-3.0 migration | Update the root license, package metadata, README and visible source/license information consistently |
| Absorbed DSH, Cordis, Cosmokit and Schemastery | Retained MIT notices and source maps | Preserve notices, authorship and exact upstream provenance |
| Ultralytics YOLO26 integration | Official AGPL-3.0 offering | Preserve upstream notices and provide corresponding source for the covered integrated distribution |
| Mermaid 12.0.0 | MIT package with bundled ELK 0.9.3 | Build its core entry with the reviewed ELK version; the existing prebuilt browser bundle includes the older ELK |
| ELK 0.12.0 | EPL-2.0 with GPL-3.0-or-later secondary notice | Select the documented GPL-compatible route and retain notices/source availability; validate the actual browser build inputs |
| khroma 2.1.0 | Installed `license` file is MIT | Retain its copyright notice; the package inventory's unknown label is insufficient by itself |
| SAM 3.1 source and checkpoint | Custom SAM License dated 2025-11-19 | Preserve its terms and attribution; do not label SAM materials as AGPL or include checkpoint files in the repository |

The installed JavaScript inventory also contains Apache-2.0, BSD, ISC,
Python-2.0, BlueOak-1.0.0, Unlicense, an MPL-2.0/Apache-2.0 choice and an
LGPL-3.0-or-later libvips binary package. Their notices remain applicable.
Binary distribution must account for the LGPL component's source and replacement
requirements. The installed development inventory does not establish the contents
of every operating system's final application package.

## SAM service publication boundary

The current SAM service is a standalone HTTP program. It imports SAM and general
Python libraries, and does not import EDH runtime modules or Ultralytics. The EDH
client sends an image and a text prompt and receives segmentation results over its
explicit protocol. Providers and checkpoints are selected outside the service.

Proposed publication scope, awaiting user decision: retain MIT for the standalone
EDH-authored SAM service and its independent invocation example; license the
EDH-authored harness and YOLO integration under AGPL-3.0. Enumerate the exact MIT
files and include their notices. SAM code and weights retain the SAM License.
Keep the separately installed SAM service independently runnable and documented.

This scope does not grant rights to relicense Meta's materials or assert that an
HTTP boundary by itself resolves every combined-distribution question. A package
that combines providers must be reviewed for its actual included code and terms.

## Release evidence still required

1. Rebuild Mermaid using ELK 0.12.0 and inspect the build dependency manifest.
   An override in the package manager alone does not change Mermaid's prebuilt
   JavaScript. Verify real browser graph rendering from the resulting assets.
2. Apply the selected EDH/SAM publication scope and preserve all source notices.
3. Include the complete AGPL text and a source offer appropriate to the deployed
   version. A public link must identify the running source and local modifications.
4. Verify the final application packages and provider installation manifests,
   including their operating-system-specific dependencies. Model weights, datasets
   and simulator assets retain independent upstream terms.

## Primary sources inspected

- [Ultralytics licensing](https://www.ultralytics.com/license)
- [GNU AGPL version 3](https://www.gnu.org/licenses/agpl-3.0.txt), especially sections 5, 7, 10 and 13
- [ELK 0.12.0 license](https://raw.githubusercontent.com/kieler/elkjs/0.12.0/LICENSE.md)
- [ELK 0.12.0 source notice](https://raw.githubusercontent.com/kieler/elkjs/0.12.0/src/js/elk-api.js)
- [SAM license at the selected source revision](https://raw.githubusercontent.com/facebookresearch/sam3/2345a4ad/LICENSE)

The exact installed package files and dependency graph were inspected in addition
to these sources. Local inventory evidence is retained under
`.local/work/v1-license-inventory.json`; it contains host-specific paths and is
excluded from source control.
