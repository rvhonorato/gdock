"""Type stubs for the gdock native extension."""

from typing import Optional, Union

def score(
    receptor_pdb: str,
    ligand_pdb: str,
    w_vdw: float = 0.4,
    w_elec: float = 0.05,
    w_desolv: float = 3.4,
    w_clash: float = 1.0,
) -> dict[str, float]:
    """Score a receptor-ligand complex.

    Returns:
        dict with keys: vdw, elec, desolv, clash, total
    """

def dock(
    receptor_pdb: str,
    ligand_pdb: str,
    restraints: Optional[Union[list[tuple[int, int]], str]] = None,
    max_generations: Optional[int] = None,
    population_size: Optional[int] = None,
    ncores: Optional[int] = None,
    seed: Optional[int] = None,
    sampling: Optional[int] = None,
    w_vdw: float = 0.4,
    w_elec: float = 0.05,
    w_desolv: float = 3.4,
    w_air: float = 1.0,
    w_clash: float = 1.0,
) -> dict:
    """Run the genetic algorithm docking pipeline.

    Args:
        receptor_pdb: PDB string of the receptor
        ligand_pdb: PDB string of the ligand
        restraints: A list of (receptor_resseq, ligand_resseq) pairs, or the
                    path of a HADDOCK AIR .tbl file.
        max_generations: Maximum number of GA generations (default: 250)
        population_size: Number of individuals in the GA population (default: 150)
        ncores: Number of CPU threads (default: all available)
        seed: Random seed for reproducibility (default: 42)
        sampling: If set, keep up to this many unique poses and return all of
                  them in `models`, sorted by fitness, without clustering.
        w_vdw, w_elec, w_desolv, w_air, w_clash: Weights of the energy terms
                  in the fitness. The defaults are the CLI defaults.

    Returns:
        dict with keys:
            - generationsRun: number of generations executed
            - convergedEarly: True if the GA stopped before max_generations
            - models: models ranked by fitness
            - clusteredModels: cluster centres ranked by fitness (empty in
              sampling mode)

        Each model has rank, fitness, vdw, elec, desolv, air, clash,
        clusterSize, pdb.
    """

def generate_restraints(
    receptor_pdb: str,
    ligand_pdb: str,
    cutoff: float = 5.0,
    mode: str = "ambig",
) -> list[tuple[int, int]]:
    """Find restraint pairs from the interface of a complex.

    `mode` is "ambig" (all interface residue pairs) or "unambig" (the closest
    ligand residue for each receptor residue).
    """

def tbl_to_pairs(tbl: str) -> list[tuple[int, int]]:
    """Parse the text of a HADDOCK AIR .tbl file into restraint pairs."""

def contacts(receptor_pdb: str, ligand_pdb: str, cutoff: float = 5.0) -> list[str]:
    """Compute the sorted inter-chain contacts of a receptor-ligand complex."""

def cluster_contacts(
    contact_sets: list[list[str]],
    fcc_cutoff: float = 0.6,
    min_cluster_size: int = 4,
) -> list[dict]:
    """Cluster models by the fraction of common contacts (FCC).

    Returns:
        list of dicts with centerIdx, members, size; largest cluster first
    """
