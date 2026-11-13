//! Python bindings for `gdock` - information-driven protein-protein docking.
//!
//! All the science is in `gdock::api`. This file only converts the types.

use std::collections::HashSet;

use gdock::api::{self, DockParams, Pose};
use gdock::clustering::{self, ClusteringConfig};
use gdock::constants::{self, EnergyWeights};
use gdock::restraints::{find_ambiguous_pairs, find_unambiguous_pairs, parse_tbl};
use gdock::structure::{combine_molecules, Molecule};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::PyDict;
use rayon::ThreadPoolBuilder;
use serde::Serialize;

fn parse_molecule(pdb: &str, label: &str) -> PyResult<Molecule> {
    api::parse_molecule(pdb, label).map_err(PyValueError::new_err)
}

/// Convert a serializable value to a Python object through JSON.
fn to_py<T: Serialize>(py: Python<'_>, value: &T) -> PyResult<Py<PyAny>> {
    let json = serde_json::to_string(value)
        .map_err(|e| PyRuntimeError::new_err(format!("Failed to serialize result: {e}")))?;
    let loads = py.import("json")?.getattr("loads")?;
    Ok(loads.call1((json,))?.unbind())
}

/// Score a receptor-ligand complex using the gdock energy function.
///
/// Args:
///     receptor_pdb: PDB string of the receptor
///     ligand_pdb: PDB string of the ligand
///     w_vdw: Weight for van der Waals energy (default: 0.4)
///     w_elec: Weight for electrostatic energy (default: 0.05)
///     w_desolv: Weight for desolvation energy (default: 3.4)
///     w_clash: Weight for the clash count (default: 1.0)
///
/// Returns:
///     dict with keys: vdw, elec, desolv, clash, total
#[pyfunction]
#[pyo3(signature = (receptor_pdb, ligand_pdb, w_vdw=constants::DEFAULT_W_VDW, w_elec=constants::DEFAULT_W_ELEC, w_desolv=constants::DEFAULT_W_DESOLV, w_clash=constants::DEFAULT_W_CLASH))]
fn score(
    py: Python<'_>,
    receptor_pdb: &str,
    ligand_pdb: &str,
    w_vdw: f64,
    w_elec: f64,
    w_desolv: f64,
    w_clash: f64,
) -> PyResult<Py<PyDict>> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;

    let weights = EnergyWeights::new(w_vdw, w_elec, w_desolv, constants::DEFAULT_W_AIR, w_clash);
    let s = api::score(&receptor, &ligand, &weights);

    let dict = PyDict::new(py);
    dict.set_item("vdw", s.vdw)?;
    dict.set_item("elec", s.elec)?;
    dict.set_item("desolv", s.desolv)?;
    dict.set_item("clash", s.clash)?;
    dict.set_item("total", s.total)?;
    Ok(dict.into())
}

/// A single docking model.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Model {
    rank: usize,
    fitness: f64,
    vdw: f64,
    elec: f64,
    desolv: f64,
    air: f64,
    clash: f64,
    cluster_size: usize,
    pdb: String,
}

impl Model {
    fn new(pose: &Pose, receptor: &Molecule) -> Self {
        Self {
            rank: pose.rank,
            fitness: pose.fitness,
            vdw: pose.vdw,
            elec: pose.elec,
            desolv: pose.desolv,
            air: pose.air,
            clash: pose.clash,
            cluster_size: pose.cluster_size,
            pdb: pose.complex_pdb(receptor),
        }
    }
}

/// Result of [`dock`].
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DockResult {
    generations_run: u64,
    converged_early: bool,
    models: Vec<Model>,
    clustered_models: Vec<Model>,
}

/// Run the genetic algorithm docking pipeline.
///
/// Args:
///     receptor_pdb: PDB string of the receptor
///     ligand_pdb: PDB string of the ligand
///     restraints: List of (receptor_resseq, ligand_resseq) pairs, or the path
///                 of a HADDOCK AIR .tbl file
///     max_generations: Maximum number of GA generations (default: 250)
///     population_size: Number of individuals in the GA population (default: 150)
///     ncores: Number of CPU threads for parallel fitness evaluation (default: all available)
///     seed: Random seed for reproducibility (default: 42)
///     sampling: If set, collect up to this many unique poses and return all of
///               them in `models`, sorted by fitness, without clustering.
///     w_vdw: Weight for van der Waals energy (default: 0.4)
///     w_elec: Weight for electrostatic energy (default: 0.05)
///     w_desolv: Weight for desolvation energy (default: 3.4)
///     w_air: Weight for the restraint (AIR) energy (default: 1.0)
///     w_clash: Weight for the clash-count penalty (default: 1.0)
///
/// Returns:
///     dict with keys:
///         - generationsRun: number of generations executed
///         - convergedEarly: true if the GA stopped before max_generations
///         - models: models ranked by fitness
///         - clusteredModels: cluster centres ranked by fitness (empty in sampling mode)
///
///     Each model has rank, fitness, vdw, elec, desolv, air, clash, clusterSize, pdb.
#[pyfunction]
#[allow(clippy::too_many_arguments)]
#[pyo3(signature = (receptor_pdb, ligand_pdb, restraints=None, max_generations=None, population_size=None, ncores=None, seed=None, sampling=None, w_vdw=constants::DEFAULT_W_VDW, w_elec=constants::DEFAULT_W_ELEC, w_desolv=constants::DEFAULT_W_DESOLV, w_air=constants::DEFAULT_W_AIR, w_clash=constants::DEFAULT_W_CLASH))]
fn dock(
    py: Python<'_>,
    receptor_pdb: &str,
    ligand_pdb: &str,
    restraints: Option<pyo3::Bound<'_, pyo3::PyAny>>,
    max_generations: Option<u64>,
    population_size: Option<u64>,
    ncores: Option<usize>,
    seed: Option<u64>,
    sampling: Option<usize>,
    w_vdw: f64,
    w_elec: f64,
    w_desolv: f64,
    w_air: f64,
    w_clash: f64,
) -> PyResult<Py<PyDict>> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;

    let pairs: Vec<(i32, i32)> = match restraints {
        None => vec![],
        Some(r) => {
            if let Ok(path) = r.extract::<String>() {
                let content = std::fs::read_to_string(&path).map_err(|e| {
                    PyValueError::new_err(format!("cannot read TBL file '{path}': {e}"))
                })?;
                parse_tbl(&content).map_err(PyValueError::new_err)?
            } else {
                r.extract::<Vec<(i32, i32)>>()?
            }
        }
    };

    let defaults = DockParams::default();
    let params = DockParams {
        max_generations: max_generations.unwrap_or(defaults.max_generations),
        population_size: population_size.unwrap_or(defaults.population_size),
        seed: seed.unwrap_or(defaults.seed),
        sampling,
        weights: EnergyWeights::new(w_vdw, w_elec, w_desolv, w_air, w_clash),
    };

    // 0 tells rayon to use all available logical CPUs (its default behaviour).
    let pool = ThreadPoolBuilder::new()
        .num_threads(ncores.unwrap_or(0))
        .build()
        .map_err(|e| PyRuntimeError::new_err(format!("Failed to build thread pool: {e}")))?;

    let result = py.detach(|| {
        pool.install(|| {
            let run = api::dock(receptor, ligand, &pairs, &params);
            let (clustered, ranked) = run.poses();
            let models = |poses: &[Pose]| -> Vec<Model> {
                poses.iter().map(|p| Model::new(p, &run.receptor)).collect()
            };
            DockResult {
                generations_run: run.generations_run,
                converged_early: run.converged_early,
                models: models(&ranked),
                clustered_models: models(&clustered),
            }
        })
    });

    Ok(to_py(py, &result)?.extract(py)?)
}

/// Find restraint pairs from the interface of a complex.
///
/// Args:
///     receptor_pdb: PDB string of the receptor, in the bound position
///     ligand_pdb: PDB string of the ligand, in the bound position
///     cutoff: Heavy-atom distance cutoff in Å (default: 5.0)
///     mode: "ambig" pairs all interface residues of the two chains (default);
///           "unambig" gives the closest ligand residue for each receptor residue
///
/// Returns:
///     list of (receptor_resseq, ligand_resseq) pairs, valid input for `dock`
#[pyfunction]
#[pyo3(signature = (receptor_pdb, ligand_pdb, cutoff=5.0, mode="ambig"))]
fn generate_restraints(
    receptor_pdb: &str,
    ligand_pdb: &str,
    cutoff: f64,
    mode: &str,
) -> PyResult<Vec<(i32, i32)>> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;
    let pairs = match mode {
        "ambig" => find_ambiguous_pairs(&receptor, &ligand, cutoff),
        "unambig" => find_unambiguous_pairs(&receptor, &ligand, cutoff),
        other => {
            return Err(PyValueError::new_err(format!(
                "mode must be 'ambig' or 'unambig', got '{other}'"
            )))
        }
    };
    Ok(pairs
        .into_iter()
        .map(|(r, l)| (r as i32, l as i32))
        .collect())
}

/// Parse the text of a HADDOCK AIR .tbl file into restraint pairs.
///
/// Returns:
///     list of (receptor_resseq, ligand_resseq) pairs
#[pyfunction]
fn tbl_to_pairs(tbl: &str) -> PyResult<Vec<(i32, i32)>> {
    parse_tbl(tbl).map_err(PyValueError::new_err)
}

/// Compute the inter-chain contacts of a receptor-ligand complex.
///
/// Returns:
///     sorted list of contact strings ("chainA resA chainB resB")
#[pyfunction]
#[pyo3(signature = (receptor_pdb, ligand_pdb, cutoff=5.0))]
fn contacts(receptor_pdb: &str, ligand_pdb: &str, cutoff: f64) -> PyResult<Vec<String>> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;
    let complex = combine_molecules(&receptor, &ligand);
    let mut contacts: Vec<String> = clustering::calculate_contacts(&complex, cutoff)
        .into_iter()
        .collect();
    contacts.sort();
    Ok(contacts)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Cluster {
    center_idx: usize,
    members: Vec<usize>,
    size: usize,
}

/// Cluster models by the fraction of common contacts (FCC).
///
/// Args:
///     contact_sets: one list of contact strings for each model, from `contacts`
///     fcc_cutoff: minimum FCC for two models to be neighbours (default: 0.6)
///     min_cluster_size: smallest cluster to return (default: 4)
///
/// Returns:
///     list of dicts with centerIdx, members, size; largest cluster first
#[pyfunction]
#[pyo3(signature = (contact_sets, fcc_cutoff=0.6, min_cluster_size=4))]
fn cluster_contacts(
    py: Python<'_>,
    contact_sets: Vec<Vec<String>>,
    fcc_cutoff: f64,
    min_cluster_size: usize,
) -> PyResult<Py<PyAny>> {
    let sets: Vec<HashSet<String>> = contact_sets
        .into_iter()
        .map(|v| v.into_iter().collect())
        .collect();
    let config = ClusteringConfig {
        fcc_cutoff,
        min_cluster_size,
        ..ClusteringConfig::default()
    };
    let clusters: Vec<Cluster> = clustering::cluster_contact_sets(&sets, &config)
        .into_iter()
        .map(|c| Cluster {
            center_idx: c.center_idx,
            members: c.members,
            size: c.size,
        })
        .collect();
    to_py(py, &clusters)
}

#[pymodule]
fn _internal(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(score, m)?)?;
    m.add_function(wrap_pyfunction!(dock, m)?)?;
    m.add_function(wrap_pyfunction!(generate_restraints, m)?)?;
    m.add_function(wrap_pyfunction!(tbl_to_pairs, m)?)?;
    m.add_function(wrap_pyfunction!(contacts, m)?)?;
    m.add_function(wrap_pyfunction!(cluster_contacts, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pyo3::types::PyList;
    use pyo3::Python;

    #[test]
    fn test_score() {
        let receptor_pdb = "ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C\nATOM      2  CA  ALA A   2       1.000   0.000   0.000  1.00  0.00           C\nEND\n";
        let ligand_pdb =
            "ATOM      1  CA  ALA B   1       5.000   0.000   0.000  1.00  0.00           C\nEND\n";

        Python::attach(|py| {
            let result = score(py, receptor_pdb, ligand_pdb, 0.4, 0.05, 3.4, 1.0).unwrap();
            let dict = result.bind(py);
            let vdw: f64 = dict.get_item("vdw").unwrap().unwrap().extract().unwrap();
            let total: f64 = dict.get_item("total").unwrap().unwrap().extract().unwrap();
            assert!(vdw.is_finite());
            assert!(total.is_finite());
        });
    }

    #[test]
    fn test_dock_runs_a_few_generations() {
        let receptor_pdb = "ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C\nATOM      2  CA  ALA A   2       3.800   0.000   0.000  1.00  0.00           C\nEND\n";
        let ligand_pdb = "ATOM      1  CA  ALA B   1      10.000   0.000   0.000  1.00  0.00           C\nATOM      2  CA  ALA B   2      13.800   0.000   0.000  1.00  0.00           C\nEND\n";

        Python::attach(|py| {
            let result = dock(
                py,
                receptor_pdb,
                ligand_pdb,
                None,
                Some(2),
                None,
                None,
                Some(1),
                None,
                constants::DEFAULT_W_VDW,
                constants::DEFAULT_W_ELEC,
                constants::DEFAULT_W_DESOLV,
                constants::DEFAULT_W_AIR,
                constants::DEFAULT_W_CLASH,
            )
            .unwrap();
            let dict = result.bind(py);
            let generations_run: u64 = dict
                .get_item("generationsRun")
                .unwrap()
                .unwrap()
                .extract()
                .unwrap();
            assert!(generations_run >= 1);
            let _converged_early: bool = dict
                .get_item("convergedEarly")
                .unwrap()
                .unwrap()
                .extract()
                .unwrap();
            let models = dict.get_item("models").unwrap().unwrap();
            let models = models.cast::<PyList>().unwrap();
            assert!(models.len() > 0);
        });
    }
}
