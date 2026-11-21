# gdock

**Information-driven protein-protein docking using a genetic algorithm**

[![License](https://img.shields.io/badge/license-0BSD-blue)](https://codeberg.org/rvhonorato/gdock/src/branch/main/LICENSE)
[![DOI](https://zenodo.org/badge/264535556.svg)](https://doi.org/10.5281/zenodo.18863556)

[![ci](https://codeberg.org/rvhonorato/gdock/badges/workflows/ci.yml/badge.svg)](https://codeberg.org/rvhonorato/gdock/actions?workflow=ci.yml)
[![py](https://codeberg.org/rvhonorato/gdock/badges/workflows/py.yml/badge.svg)](https://codeberg.org/rvhonorato/gdock/actions?workflow=py.yml)
[![Crates.io Version](https://img.shields.io/crates/v/gdock)](https://crates.io/crates/gdock)
[![PyPI Python Version](https://img.shields.io/pypi/pyversions/gdock)](https://pypi.org/project/gdock/)


<img src="https://codeberg.org/rvhonorato/gdock/raw/branch/main/imgs/gdock_logo.png" alt="gdock_logo" width="350">

> **The main source repository has moved to
> [Codeberg](https://codeberg.org/rvhonorato/gdock).** GitHub remains available
> as a mirror; please open issues and pull requests on Codeberg.

gdock is a fast protein-protein docking tool written in Rust that uses
restraints and energy components to guide the docking process. It combines a
genetic algorithm with physics-based scoring to find optimal protein-protein
complexes.

A web interface is available at [gdock.org](https://gdock.org) for running
docking jobs without installing anything locally.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Command reference](#command-reference)
- [Input Format](#input-format)
- [Output](#output)
- [Algorithm](#algorithm)
- [Python](#python)
- [WebAssembly](#webassembly)
- [Website](#website)
- [Repository layout](#repository-layout)
- [Contributing](#contributing)
- [Citation](#citation)
- [License](#license)

## Features

- **Fast**: Genetic algorithm with early stopping and elitism
- **Information-driven**: Uses residue restraints to guide docking
- **Flexible scoring**: Configurable energy weights (VDW, electrostatics,
  desolvation, restraints, clashes)
- **Clash penalty**: Poses with overlapping atoms get a worse score
- **Quality metrics**: Optional DockQ calculation when reference structure is
  provided
- **Clustering**: FCC-based clustering to group similar solutions
- **Sampling**: Collect a large pool of unique diverse conformations with `--sampling`
- **Bindings**: Use gdock from [Python](#python) (`pip install gdock`) or in the browser
  ([WebAssembly](#webassembly))

## Installation

```bash
cargo install gdock
```

Or build from source:

```bash
git clone https://codeberg.org/rvhonorato/gdock
cd gdock
cargo build --release
```

Requires [Rust](https://www.rust-lang.org/tools/install) 1.85 or later.

## Quick Start

```bash
# Prepare some input data
curl -sL https://files.rcsb.org/download/2OOB.pdb -o 2OOB.pdb
awk '/^ATOM/ && substr($0,22,1)=="A"' 2OOB.pdb > 2oob_A.pdb
awk '/^ATOM/ && substr($0,22,1)=="B"' 2OOB.pdb > 2oob_B.pdb

# Run docking
gdock run \
  --receptor 2oob_A.pdb \
  --ligand 2oob_B.pdb \
  --restraints 933:6,936:8,940:42,941:44,946:45,950:46
```

Most docking runs complete in ~15 seconds on standard hardware.

## Usage

`gdock` has three subcommands: `run`, `score`, and `restraints`.

### Docking (`run`)

Run the full genetic algorithm docking:

```bash
gdock run \
  --receptor receptor.pdb \
  --ligand ligand.pdb \
  --restraints 933:6,936:8,940:42
```

With a reference structure for DockQ calculation:

```bash
gdock run \
  --receptor receptor.pdb \
  --ligand ligand.pdb \
  --restraints 933:6,936:8,940:42 \
  --reference native.pdb
```

See the [Command reference](#command-reference) for all options.

#### Sampling mode

Use `--sampling N` to collect a large pool of diverse conformations from a single
GA run. This is useful when you need more than the default 5 output models — for
example, to feed a downstream selection step:

```bash
gdock run \
  --receptor receptor.pdb \
  --ligand ligand.pdb \
  --restraints 933:6,936:8,940:42 \
  --sampling 500
```

The poses are written to the `sampling/` directory (see [Output](#output)).
The normal `model_*.pdb` / `ranked_*.pdb` output is still produced.

### Scoring (`score`)

Calculate energy components without running the GA:

```bash
gdock score \
  --receptor receptor.pdb \
  --ligand ligand.pdb \
  --restraints 933:6,936:8,940:42
```

### Generate restraints (`restraints`)

Generate restraints from interface contacts in a native structure:

```bash
gdock restraints \
  --receptor receptor_ref.pdb \
  --ligand ligand_ref.pdb \
  --cutoff 5.0
```

The command prints the pairs to the standard output, in the format that
`--restraints` accepts. There are two modes:

- `--mode ambig` (default): each interface residue of the receptor is paired
  with each interface residue of the ligand.
- `--mode unambig`: each interface residue of the receptor is paired with its
  closest ligand residue only.

## Command reference

```
$ gdock -h
Fast information-driven protein-protein docking using genetic algorithms

Usage: gdock <COMMAND>

Commands:
  run         Run the genetic algorithm docking
  score       Score structures without running the GA
  restraints  Generate restraints from interface contacts in a reference complex
  help        Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

```
$ gdock run -h
Run the genetic algorithm docking

Usage: gdock run [OPTIONS] --receptor <FILE> --ligand <FILE> --restraints <PAIRS>

Options:
  -r, --receptor <FILE>     Receptor PDB file
  -l, --ligand <FILE>       Ligand PDB file
      --restraints <PAIRS>  Comma-separated restraint pairs receptor:ligand (e.g., 10:45,15:50)
      --reference <FILE>    Reference PDB file for DockQ calculation
      --debug               Debug mode: use DockQ as fitness (requires --reference)
  -o, --output-dir <DIR>    Output directory for results (default: current directory)
      --no-clust            Disable clustering, output best_by_score and best_by_dockq only
  -n, --nproc <NUM>         Number of processors to use (default: total - 2)
      --sampling <NUM>      Collect up to NUM unique poses sorted by fitness into sampling/
      --epoch               Write the full per-generation, per-individual trace to epoch.tsv.gz
      --w_vdw <WEIGHT>      Weight for VDW energy term
      --w_elec <WEIGHT>     Weight for electrostatic energy term
      --w_desolv <WEIGHT>   Weight for desolvation energy term
      --w_air <WEIGHT>      Weight for AIR restraint energy term
      --w_clash <WEIGHT>    Weight for the clash-count penalty term (0 to disable)
  -h, --help                Print help
```

```
$ gdock score -h
Score structures without running the GA

Usage: gdock score [OPTIONS] --receptor <FILE> --ligand <FILE>

Options:
  -r, --receptor <FILE>     Receptor PDB file
  -l, --ligand <FILE>       Ligand PDB file
      --restraints <PAIRS>  Comma-separated restraint pairs receptor:ligand (optional)
      --reference <FILE>    Reference PDB file for DockQ calculation
      --w_vdw <WEIGHT>      Weight for VDW energy term
      --w_elec <WEIGHT>     Weight for electrostatic energy term
      --w_desolv <WEIGHT>   Weight for desolvation energy term
      --w_air <WEIGHT>      Weight for AIR restraint energy term
      --w_clash <WEIGHT>    Weight for the clash-count penalty term (0 to disable)
  -h, --help                Print help
```

```
$ gdock restraints -h
Generate restraints from interface contacts in a reference complex

Usage: gdock restraints [OPTIONS] --receptor <FILE> --ligand <FILE>

Options:
  -r, --receptor <FILE>     Receptor PDB file
  -l, --ligand <FILE>       Ligand PDB file
      --cutoff <ANGSTROMS>  Distance cutoff for interface detection (default: 5.0)
      --mode <MODE>         'ambig': cross-product OR-group per anchor (default); 'unambig': single closest partner per anchor [default: ambig] [possible values: ambig, unambig]
  -h, --help                Print help
```

## Input Format

### PDB Files

- **Receptor**: PDB file containing the receptor protein (single chain)
- **Ligand**: PDB file containing the ligand protein (single chain)
- **Reference** (optional): PDB file containing the native complex

### Restraints

Comma-separated list of residue pairs in `receptor:ligand` format:

```text
933:6,936:8,940:42
```

These indicate which residues should be in contact, based on experimental data
or other information sources.

`--restraints` accepts one of these:

- The list of pairs.
- The path of a text file that contains the list of pairs.
- The path of a HADDOCK AIR file. The file name must end in `.tbl`. Only the
  `run` subcommand accepts this format.

gdock reads the `.tbl` file as follows. The segid of the first `assign` statement is the
receptor. A residue is active if it is the first selection of an `assign`
statement. gdock keeps only the pairs in which the two residues are active.

## Output

- `model_X.pdb`: Cluster representatives (unless `--no-clust`)
- `ranked_X.pdb`: Top 5 models ranked by score (unless `--no-clust`)
- `metrics.tsv`: Tab-separated file with scores and metrics
- `best_by_score.pdb`: Best model by score (only with `--no-clust`)
- `best_by_dockq.pdb`: Best model by DockQ (only with `--no-clust` and `--reference`)
- `sampling/gdock_N.pdb`: All unique poses sorted by fitness (only with `--sampling`)
- `sampling/sampling.tsv`: Scores and energy components for sampling output
- `epoch.tsv.gz`: Genes, score and energy components of each individual of
  each generation (only with `--epoch`)

Output structures can be visualized with molecular viewers such as
[PyMOL](https://pymol.org/) or [ChimeraX](https://www.cgl.ucsf.edu/chimerax/).

## Algorithm

gdock uses:

- **Genetic Algorithm**: Population of 150, elitism (top 5), tournament
  selection
- **Energy Function**: VDW + Electrostatics + Desolvation + AIR restraints +
  Clashes
- **Restraints**: HADDOCK-style ambiguous interaction restraints (AIR). The
  effective distance of a restraint is calculated from all heavy-atom pairs.
  There is no penalty up to 4 Angstrom. Above that, a soft-square potential
  applies: quadratic for the first Angstrom, then linear.
- **Clashes**: Number of atom pairs that are closer than the sum of their van
  der Waals radii
- **Early Stopping**: Converges when no improvement for 50 generations
- **Hall of Fame**: Keeps the unique poses of all generations. If two poses are
  almost the same, it keeps the better one.
- **Clustering**: FCC-based clustering of the Hall of Fame

## Python

The Python package has the same engine as the command-line tool. It needs
Python 3.11 or later.

```bash
pip install gdock
```

The functions take the contents of the PDB files as strings, not file paths.

```python
import gdock

receptor_pdb = open("receptor.pdb").read()
ligand_pdb = open("ligand.pdb").read()

# Score a receptor-ligand complex
scores = gdock.score(receptor_pdb, ligand_pdb)
print(scores)  # {"vdw": ..., "elec": ..., "desolv": ..., "clash": ..., "total": ...}

# Run the docking
result = gdock.dock(
    receptor_pdb,
    ligand_pdb,
    restraints=[(10, 20), (15, 25)],  # (receptor_resseq, ligand_resseq) pairs
)
print(f"Generations run: {result['generationsRun']}")
print(f"Converged early: {result['convergedEarly']}")

best = result["models"][0]
print(f"Best fitness: {best['fitness']}")
open("best.pdb", "w").write(best["pdb"])  # receptor + docked ligand

# Use a HADDOCK AIR file for the restraints
result = gdock.dock(receptor_pdb, ligand_pdb, restraints="ambig.tbl")

# Sampling mode: get a large pool of unique poses, sorted by fitness
result = gdock.dock(
    receptor_pdb,
    ligand_pdb,
    restraints=[(10, 20), (15, 25)],
    sampling=500,
)
```

### `score`

```python
score(receptor_pdb, ligand_pdb, w_vdw=0.4, w_elec=0.05, w_desolv=3.4, w_clash=1.0) -> dict
```

Calculates the energy terms of a complex, without restraints. The result has
the keys `vdw`, `elec`, `desolv`, `clash` and `total`.

### `dock`

```python
dock(
    receptor_pdb,
    ligand_pdb,
    restraints=None,
    max_generations=None,  # default: 250
    population_size=None,  # default: 150
    ncores=None,           # default: all available
    seed=None,             # default: 42
    sampling=None,
    w_vdw=0.4,
    w_elec=0.05,
    w_desolv=3.4,
    w_air=1.0,
    w_clash=1.0,
) -> dict
```

Runs the genetic algorithm. `restraints` is a list of
`(receptor_resseq, ligand_resseq)` pairs, or the path of a HADDOCK AIR `.tbl`
file. The result is:

```text
{
  "generationsRun": int,    # generations that the GA did
  "convergedEarly": bool,   # True if the GA stopped before max_generations
  "models": [...],          # models ranked by fitness
  "clusteredModels": [...]  # cluster centres ranked by fitness
}
```

Each model has the keys `rank`, `fitness`, `vdw`, `elec`, `desolv`, `air`,
`clash`, `clusterSize` and `pdb`. `pdb` is the full complex (receptor and
docked ligand).

With `sampling=N`, gdock keeps up to N unique poses and returns all of them in
`models`. `clusteredModels` is then empty.

### Other functions

- `generate_restraints(receptor_pdb, ligand_pdb, cutoff=5.0, mode="ambig")`:
  Finds restraint pairs from the interface of a complex in the bound position.
  `mode` is `"ambig"` or `"unambig"`, as in the `restraints` subcommand. The
  result is valid input for `dock`.
- `tbl_to_pairs(tbl)`: Converts the text of a HADDOCK AIR `.tbl` file into
  restraint pairs.
- `contacts(receptor_pdb, ligand_pdb, cutoff=5.0)`: Returns the sorted list of
  the inter-chain contacts of a complex.
- `cluster_contacts(contact_sets, fcc_cutoff=0.6, min_cluster_size=4)`:
  Clusters models by their fraction of common contacts (FCC). `contact_sets`
  has one result of `contacts` for each model. Each cluster has the keys
  `centerIdx`, `members` and `size`. The largest cluster is first.

### Changes from version 0.5.0

The Python package now has the same version number as the core crate. Thus,
the version after 0.5.0 is 2.3.0.

- `dock`: `models` now has the models ranked by fitness. The cluster centres,
  which were in `models`, are now in `clusteredModels`.
- `dock`: each model has the new keys `clash` and `clusterSize`.
- `dock`: the weights of the energy terms are new parameters.
- `score`: the result has the new key `clash`, and `total` includes the clash
  term.
- `generate_restraints`, `tbl_to_pairs`, `contacts` and `cluster_contacts` are
  new.

## WebAssembly

The `wasm/` directory has the WebAssembly bindings (`gdock-wasm`). They run
the docking in the browser, without a server. [gdock.org](https://gdock.org)
uses them.

The package is not released on npm or crates.io. Build it from this
repository.

### Build

```bash
# Install wasm-pack and the wasm target, if necessary
cargo install wasm-pack
rustup target add wasm32-unknown-unknown

cd wasm
wasm-pack build --target web
```

The package is written to `wasm/pkg/`.

### JavaScript usage

```ts
import init, { run_docking, score_structures } from "./pkg/gdock_wasm.js";

await init();

const scores = score_structures(receptorPdb, ligandPdb, 0.4, 0.05, 3.4);
console.log(scores.total);

const pairs = JSON.stringify([[933, 6], [936, 8]]);
const result = run_docking(receptorPdb, ligandPdb, pairs);
console.log(result.rankedPoses[0].ligandPdb);
```

`run_docking` blocks until the docking is complete. Call it from a Web Worker
to keep the page responsive.

### Functions

The functions do the same work as the [Python](#python) functions. A
parameter with `?` is optional.

| Function | Python function |
|---|---|
| `score_structures(receptor_pdb, ligand_pdb, w_vdw, w_elec, w_desolv, w_clash?)` | `score` |
| `run_docking(receptor_pdb, ligand_pdb, restraint_pairs_json, max_generations?, seed?, population_size?, sampling?, w_vdw?, w_elec?, w_desolv?, w_air?, w_clash?)` | `dock` |
| `generate_restraints(receptor_pdb, ligand_pdb, cutoff?, mode?)` | `generate_restraints` |
| `tbl_to_pairs(tbl)` | `tbl_to_pairs` |
| `compute_contacts(receptor_pdb, ligand_pdb)` | `contacts` |
| `cluster_from_contacts(contacts_json, fcc_cutoff?, min_cluster_size?)` | `cluster_contacts` |

The differences from the Python functions are:

- `restraint_pairs_json` and `contacts_json` are JSON strings, for example
  `"[[10,5],[22,8]]"`. Use `"[]"` for a docking without restraints.
- `max_generations` and `seed` are `BigInt` values, for example `250n`.
- `compute_contacts` has a fixed cutoff of 5 Angstrom.
- A pose has `ligandPdb`, the docked ligand without the receptor, and not
  `pdb`.

The result of `run_docking` is:

```text
{
  "generationsRun": 100,
  "convergedEarly": false,
  "clusteredPoses": [...],  // cluster centres ranked by fitness
  "rankedPoses": [...]      // poses ranked by fitness
}
```

Each pose has the fields `rank`, `fitness`, `vdw`, `elec`, `desolv`, `air`,
`clash`, `clusterSize` and `ligandPdb`. With `sampling`, `rankedPoses` has all
the poses and `clusteredPoses` is empty.

## Website

The `website/` directory has the source of [gdock.org](https://gdock.org). It
is a React + Vite + Tailwind page with an in-browser docking engine, the
[WebAssembly](#webassembly) bindings.

### Development

You need Node.js and the tools of the WebAssembly [Build](#build). Do the
setup in `website/`:

```bash
npm run wasm                     # build gdock-wasm from wasm/
npm ci                           # install the dependencies
npx playwright install chromium  # browser for the tests, one time only
```

`gdock-wasm` comes from the `wasm/` directory of this repository, not from
npm. Run `npm run wasm` again after a change in `src/` or `wasm/`.

Then use these commands:

```bash
npm run dev          # start dev server (http://localhost:5173)
npm run lint         # eslint
npm test             # vitest: unit tests and browser tests
npm run build        # tsc + vite build, the result is in dist/
npm run preview      # serve dist/ locally to check prod build
```

### Key files

| Path | What it does |
|---|---|
| `website/src/components/sections/Gdock.tsx` | Tabs of the in-browser tool |
| `website/src/components/sections/gdock/ScoreJob.tsx` | Score tab |
| `website/src/components/sections/gdock/DockJob.tsx` | Dock tab, `.gdock` save/restore |
| `website/src/components/sections/gdock/CapriJob.tsx` | CAPRI tab, `.gdock` save/restore |
| `website/src/hooks/useGdockWasm.ts` | Typed wrappers of the WASM functions; `runDocking()` starts the worker |
| `website/src/docking.worker.ts` | Web Worker that calls WASM `run_docking` |
| `website/src/components/MolstarViewer.tsx` | Mol* v5 viewer (all panels hidden) |
| `website/src/components/DockResultCard.tsx` | Per-pose card with 3D viewer |

### `.gdock` file format

The Dock tab saves a job as gzip-compressed JSON (`fflate.gzipSync`):

```text
{
  "version": 1,
  "receptorPdb": "...",
  "ligandPdb": "...",
  "restraintPairs": [[933, 6], [936, 8]],
  "result": {
    "generationsRun": 66,
    "convergedEarly": true,
    "executionTimeMs": 14300,
    "clusteredPoses": [...],
    "rankedPoses": [...]
  }
}
```

The filename is `gdock_<8hexchars>.gdock`. The hex characters are a djb2 hash
of receptor + ligand + restraint pairs.

The CAPRI tab saves a different payload in the same container. It has
`"type": "capri"` and the fields `ensemblePdb`, `chainRoles`, `results`,
`subForm` and `selectedIndices`. The filename is `capri_T<target>.gdock`.

### Deployment

The site is static. There is no server-side component. On each push to
`main`, the `website` workflow (`.forgejo/workflows/website.yml`) builds the
site and uploads `dist/` to Codeberg Pages.

Vite bundles the workers and the WASM file. The site does not use
`SharedArrayBuffer`, thus it needs no COOP/COEP headers.

## Repository layout

This repository contains the core crate, its bindings and the website. They
share one version number.

| Directory | Contents |
|-----------|----------|
| `src/` | Core library and command-line tool ([crates.io](https://crates.io/crates/gdock)) |
| `py/` | Python bindings ([PyPI](https://pypi.org/project/gdock/)), see [Python](#python) |
| `wasm/` | WebAssembly bindings, see [WebAssembly](#webassembly) |
| `website/` | Source of [gdock.org](https://gdock.org), see [Website](#website) |

The scripts and the raw data of the benchmark are in a different repository,
[`gdock-benchmark`](https://codeberg.org/rvhonorato/gdock-benchmark).

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests
on [Codeberg](https://codeberg.org/rvhonorato/gdock).

Read [CONTRIBUTING.md](https://codeberg.org/rvhonorato/gdock/src/branch/main/CONTRIBUTING.md) and the [AI Policy](https://codeberg.org/rvhonorato/gdock/src/branch/main/AI_POLICY.md)
first. `CONTRIBUTING.md` has the tests and the checks that a pull request must
pass.

## Citation

If you use gdock in your research, please cite:

- Vargas Honorato, R. gdock: Information-Driven Protein-Protein Docking Using a Genetic Algorithm. (Zenodo, 2026). doi:[10.5281/zenodo.18863557](https://doi.org/10.5281/zenodo.18863557). 

## License

BSD Zero Clause License. See [LICENSE](https://codeberg.org/rvhonorato/gdock/src/branch/main/LICENSE) file.
