# gdock

**Information-driven protein-protein docking using a genetic algorithm**

[![DOI](https://zenodo.org/badge/264535556.svg)](https://doi.org/10.5281/zenodo.18863556)
![License](https://img.shields.io/badge/license-0BSD-blue)
[![ci](https://codeberg.org/rvhonorato/gdock/badges/workflows/ci.yml/badge.svg)](https://codeberg.org/rvhonorato/gdock/actions?workflow=ci.yml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/23671025da8a4334a754d8d5af76a34a)](https://app.codacy.com/gh/rvhonorato/gdock/dashboard)

<img src="imgs/gdock_logo.png" alt="gdock_logo" width="350">

> **The main source repository has moved to
> [Codeberg](https://codeberg.org/rvhonorato/gdock).** GitHub remains available
> as a mirror; please open issues and pull requests on Codeberg.

gdock is a fast protein-protein docking tool written in Rust that uses
restraints and energy components to guide the docking process. It combines a
genetic algorithm with physics-based scoring to find optimal protein-protein
complexes.

> A paper describing gdock has been submitted to and is waiting review in the
> [Journal of Open Source Software (JOSS)](https://joss.theoj.org/).

## Contents

- [Features](#features)
- [Web Interface](#web-interface)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [Docking (`run`)](#docking-run)
  - [Scoring (`score`)](#scoring-score)
  - [Generate restraints (`restraints`)](#generate-restraints-restraints)
- [Command reference](#command-reference)
- [Input Format](#input-format)
  - [PDB Files](#pdb-files)
  - [Restraints](#restraints)
- [Output](#output)
- [Python](#python)
  - [`score`](#score)
  - [`dock`](#dock)
  - [Other functions](#other-functions)
  - [Changes from version 0.5.0](#changes-from-version-050)
- [Algorithm](#algorithm)
- [Testing](#testing)
- [Repository layout](#repository-layout)
- [Relevant repositories](#relevant-repositories)
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
  (WebAssembly)

## Web Interface

A web interface is available at [gdock.org](https://gdock.org) for running
docking jobs without installing anything locally.

## Quick Start

```bash
# Install
cargo install gdock

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

Additional options:

- `-o, --output-dir <DIR>`: Output directory (default: current directory)
- `-n, --nproc <NUM>`: Number of processors (default: total - 2)
- `--no-clust`: Disable clustering
- `--sampling <NUM>`: Collect up to NUM unique poses sorted by fitness into `sampling/`
- `--epoch`: Write the trace of all individuals of all generations to `epoch.tsv.gz`
- `--w_vdw`, `--w_elec`, `--w_desolv`, `--w_air`, `--w_clash`: Custom energy
  weights (`--w_clash 0` disables the clash penalty)
- `--debug`: Use DockQ as the fitness (requires `--reference`). This is for
  development only.

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

All unique conformations discovered by the GA (up to N) are written to
`sampling/gdock_1.pdb`, `sampling/gdock_2.pdb`, … sorted by fitness (best first),
alongside a `sampling/sampling.tsv` with per-model scores and energy components.
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

```bash
gdock run \
  --receptor receptor.pdb \
  --ligand ligand.pdb \
  --restraints ambig.tbl
```

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

## Testing

Run the test suite:

```bash
cargo test
```

The test suite includes 209 tests covering parsing, energy calculations, and
algorithm behavior.

The bindings and the website have their own tests. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the commands.

## Repository layout

This repository contains the core crate, its bindings and the website. They
share one version number.

| Directory | Contents |
|-----------|----------|
| `src/` | Core library and command-line tool ([crates.io](https://crates.io/crates/gdock)) |
| `py/` | Python bindings ([PyPI](https://pypi.org/project/gdock/)), see [Python](#python) |
| `wasm/` | WebAssembly bindings, see [wasm/README.md](wasm/README.md) |
| `website/` | Source of [gdock.org](https://gdock.org), see [website/README.md](website/README.md) |

## Relevant repositories

- [`gdock-benchmark`](https://codeberg.org/rvhonorato/gdock-benchmark): repository
containing all scripts and raw data relevant to benchmarking the performance
of `gdock`

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests
on [Codeberg](https://codeberg.org/rvhonorato/gdock).

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [AI Policy](AI_POLICY.md)
first.

Before submitting a pull request, please ensure:

- All tests pass (`cargo test`)
- Code is formatted (`cargo fmt`)
- Linting passes (`cargo clippy`)

## Citation

If you use gdock in your research, please cite:

- Vargas Honorato, R. gdock: Information-Driven Protein-Protein Docking Using a Genetic Algorithm. (Zenodo, 2026). doi:[10.5281/zenodo.18863557](https://doi.org/10.5281/zenodo.18863557). 

[_A JOSS paper has been submitted and is waiting for review_](https://gdock.org/gdock_paper_submitted.pdf).

## License

BSD Zero Clause License. See [LICENSE](LICENSE) file.
