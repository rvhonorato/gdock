# gdock-py

Minimal Python bindings for [gdock](https://gdock.org), an information-driven
protein-protein docking engine using a genetic algorithm.

> **The main source repository has moved to
> [Codeberg](https://codeberg.org/rvhonorato/gdock).** GitHub remains
> available as a mirror; please open issues and pull requests on Codeberg.

## Installation

```bash
pip install gdock
```

## Usage

```python
import gdock

receptor_pdb = open("receptor.pdb").read()
ligand_pdb = open("ligand.pdb").read()

# Score a receptor-ligand complex
scores = gdock.score(receptor_pdb, ligand_pdb)
print(scores)  # {"vdw": ..., "elec": ..., "desolv": ..., "total": ...}

# Run the full GA docking pipeline
result = gdock.dock(
    receptor_pdb,
    ligand_pdb,
    restraints=[(10, 20), (15, 25)],  # (receptor_resseq, ligand_resseq) pairs
    max_generations=250,
    seed=42,
)
print(f"Generations run: {result['generationsRun']}")
print(f"Converged early: {result['convergedEarly']}")
print(f"Best fitness: {result['models'][0]['fitness']}")
best_pdb = result["models"][0]["pdb"]

# Pass restraints as a HADDOCK TBL file
result = gdock.dock(receptor_pdb, ligand_pdb, restraints="ambig.tbl")

# Sampling mode — collect a large pool of unique conformations sorted by fitness
result = gdock.dock(
    receptor_pdb,
    ligand_pdb,
    restraints=[(10, 20), (15, 25)],
    sampling=500,
)
for model in result["models"]:
    print(f"rank={model['rank']} fitness={model['fitness']:.3f}")
```

## Restraints

Restraints tell the GA which receptor and ligand residues should be in contact.
They can be provided as:

- **A list of integer pairs** — `[(rec_resseq, lig_resseq), ...]`
- **A HADDOCK TBL file path** — `restraints="ambig.tbl"` (string ending in `.tbl`)

Restraints use OR-group semantics (HADDOCK-style ambiguous AIR): a residue pair is
satisfied when **any** of the specified partners are within the target distance,
not all of them simultaneously.

## API

### `score(receptor_pdb, ligand_pdb, w_vdw=0.4, w_elec=0.05, w_desolv=3.4) -> dict`

Computes VDW, electrostatic and desolvation energy terms for a receptor-ligand
complex. Returns `{"vdw", "elec", "desolv", "total"}`.

### `dock(receptor_pdb, ligand_pdb, restraints=None, max_generations=250, population_size=150, ncores=None, seed=42, sampling=None) -> dict`

Runs the genetic algorithm docking pipeline and returns ranked models:

```
{
  "generationsRun": int,       # generations actually executed
  "convergedEarly": bool,      # true if stopped before max_generations
  "models": [
    {"rank", "fitness", "vdw", "elec", "desolv", "air", "pdb"},
    ...
  ]
}
```

By default, returns up to 5 cluster-representative models selected by FCC
clustering. When `sampling=N` is set, the Hall-of-Fame capacity is raised to N
and all accumulated unique conformations are returned sorted by fitness — useful
for generating a diverse pool for downstream selection.

## Development

```bash
uv venv --python 3.13 .venv
source .venv/bin/activate
uv pip install maturin pytest
maturin develop
pytest tests/
```

## License

0BSD
