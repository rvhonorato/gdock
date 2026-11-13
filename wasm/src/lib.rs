//! WebAssembly bindings for `gdock`.
//!
//! All the science is in `gdock::api`. This file only converts the types.

use std::collections::HashSet;

use gdock::api::{self, DockParams, Pose};
use gdock::clustering::{self, ClusteringConfig};
use gdock::constants::{self, EnergyWeights};
use gdock::restraints::{find_ambiguous_pairs, find_unambiguous_pairs, parse_tbl};
use gdock::structure::{combine_molecules, Molecule};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Show Rust panics in the browser console, not as "unreachable".
#[cfg(feature = "console_error_panic_hook")]
#[wasm_bindgen(start)]
fn start() {
    console_error_panic_hook::set_once();
}

fn parse_molecule(pdb: &str, label: &str) -> Result<Molecule, JsValue> {
    api::parse_molecule(pdb, label).map_err(|e| JsValue::from_str(&e))
}

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub struct ScoreResult {
    pub vdw: f64,
    pub elec: f64,
    pub desolv: f64,
    pub clash: f64,
    pub total: f64,
}

/// Score a receptor-ligand complex. `w_clash` defaults to the CLI default.
#[wasm_bindgen]
pub fn score_structures(
    receptor_pdb: &str,
    ligand_pdb: &str,
    w_vdw: f64,
    w_elec: f64,
    w_desolv: f64,
    w_clash: Option<f64>,
) -> Result<ScoreResult, JsValue> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;

    let weights = EnergyWeights::new(
        w_vdw,
        w_elec,
        w_desolv,
        constants::DEFAULT_W_AIR,
        w_clash.unwrap_or(constants::DEFAULT_W_CLASH),
    );
    let s = api::score(&receptor, &ligand, &weights);

    Ok(ScoreResult {
        vdw: s.vdw,
        elec: s.elec,
        desolv: s.desolv,
        clash: s.clash,
        total: s.total,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PoseResult {
    rank: usize,
    fitness: f64,
    vdw: f64,
    elec: f64,
    desolv: f64,
    air: f64,
    clash: f64,
    cluster_size: usize,
    ligand_pdb: String,
}

impl From<&Pose> for PoseResult {
    fn from(pose: &Pose) -> Self {
        Self {
            rank: pose.rank,
            fitness: pose.fitness,
            vdw: pose.vdw,
            elec: pose.elec,
            desolv: pose.desolv,
            air: pose.air,
            clash: pose.clash,
            cluster_size: pose.cluster_size,
            ligand_pdb: pose.ligand_pdb(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DockingOutput {
    generations_run: u32,
    converged_early: bool,
    /// Cluster centres sorted by fitness (empty in sampling mode)
    clustered_poses: Vec<PoseResult>,
    /// Poses sorted by fitness: the top ones, or all of them in sampling mode
    ranked_poses: Vec<PoseResult>,
}

/// Run the genetic algorithm docking pipeline.
///
/// `restraint_pairs_json` is a JSON array of `[receptor_resseq, ligand_resseq]`.
/// `sampling` keeps up to that many unique poses and returns all of them in
/// `rankedPoses`, without clustering. The `w_*` weights of the energy terms
/// default to the CLI defaults.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn run_docking(
    receptor_pdb: &str,
    ligand_pdb: &str,
    restraint_pairs_json: &str,
    max_generations: Option<u64>,
    seed: Option<u64>,
    population_size: Option<u32>,
    sampling: Option<u32>,
    w_vdw: Option<f64>,
    w_elec: Option<f64>,
    w_desolv: Option<f64>,
    w_air: Option<f64>,
    w_clash: Option<f64>,
) -> Result<JsValue, JsValue> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;

    let pairs: Vec<(i32, i32)> = if restraint_pairs_json.trim().is_empty() {
        Vec::new()
    } else {
        serde_json::from_str(restraint_pairs_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid restraints JSON: {}", e)))?
    };

    let defaults = DockParams::default();
    let params = DockParams {
        max_generations: max_generations.unwrap_or(defaults.max_generations),
        population_size: population_size.map_or(defaults.population_size, u64::from),
        seed: seed.unwrap_or(defaults.seed),
        sampling: sampling.map(|n| n as usize),
        weights: EnergyWeights::new(
            w_vdw.unwrap_or(defaults.weights.vdw),
            w_elec.unwrap_or(defaults.weights.elec),
            w_desolv.unwrap_or(defaults.weights.desolv),
            w_air.unwrap_or(defaults.weights.air),
            w_clash.unwrap_or(defaults.weights.clash),
        ),
    };

    let run = api::dock(receptor, ligand, &pairs, &params);
    let (clustered, ranked) = run.poses();

    to_js(&DockingOutput {
        generations_run: run.generations_run as u32,
        converged_early: run.converged_early,
        clustered_poses: clustered.iter().map(PoseResult::from).collect(),
        ranked_poses: ranked.iter().map(PoseResult::from).collect(),
    })
}

/// Find restraint pairs from the interface of a complex in the bound position.
///
/// `mode` is "ambig" (all interface residue pairs, the default) or "unambig"
/// (the closest ligand residue for each receptor residue). `cutoff` defaults
/// to 5.0 Å. Returns an array of `[receptor_resseq, ligand_resseq]`.
#[wasm_bindgen]
pub fn generate_restraints(
    receptor_pdb: &str,
    ligand_pdb: &str,
    cutoff: Option<f64>,
    mode: Option<String>,
) -> Result<JsValue, JsValue> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;
    let cutoff = cutoff.unwrap_or(5.0);

    let pairs = match mode.as_deref().unwrap_or("ambig") {
        "ambig" => find_ambiguous_pairs(&receptor, &ligand, cutoff),
        "unambig" => find_unambiguous_pairs(&receptor, &ligand, cutoff),
        other => {
            return Err(JsValue::from_str(&format!(
                "mode must be 'ambig' or 'unambig', got '{other}'"
            )))
        }
    };
    to_js(&pairs)
}

/// Parse the text of a HADDOCK AIR `.tbl` file.
///
/// Returns an array of `[receptor_resseq, ligand_resseq]`.
#[wasm_bindgen]
pub fn tbl_to_pairs(tbl: &str) -> Result<JsValue, JsValue> {
    let pairs = parse_tbl(tbl).map_err(|e| JsValue::from_str(&e))?;
    to_js(&pairs)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClusterOutput {
    center_idx: usize,
    members: Vec<usize>,
    size: usize,
}

/// Compute inter-chain FCC contacts for a receptor + ligand complex.
///
/// Returns a JS array of contact strings ("chainA resA chainB resB").
/// Call this once per model while iterating over the ensemble.
#[wasm_bindgen]
pub fn compute_contacts(receptor_pdb: &str, ligand_pdb: &str) -> Result<JsValue, JsValue> {
    let receptor = parse_molecule(receptor_pdb, "Receptor")?;
    let ligand = parse_molecule(ligand_pdb, "Ligand")?;

    let complex = combine_molecules(&receptor, &ligand);
    let mut contacts: Vec<String> = clustering::calculate_contacts(&complex, 5.0)
        .into_iter()
        .collect();
    contacts.sort();

    to_js(&contacts)
}

/// Cluster structures from pre-computed contact sets using FCC.
///
/// `contacts_json` — JSON array of arrays of contact strings, one inner array
/// per model (as returned by repeated calls to `compute_contacts`).
///
/// Returns an array of cluster objects `{ centerIdx, members, size }` sorted
/// by cluster size descending. Only clusters with `size >= min_cluster_size`
/// are included.
#[wasm_bindgen]
pub fn cluster_from_contacts(
    contacts_json: &str,
    fcc_cutoff: Option<f64>,
    min_cluster_size: Option<usize>,
) -> Result<JsValue, JsValue> {
    let raw: Vec<Vec<String>> = serde_json::from_str(contacts_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;
    let contact_sets: Vec<HashSet<String>> =
        raw.into_iter().map(|v| v.into_iter().collect()).collect();

    let defaults = ClusteringConfig::default();
    let config = ClusteringConfig {
        fcc_cutoff: fcc_cutoff.unwrap_or(defaults.fcc_cutoff),
        min_cluster_size: min_cluster_size.unwrap_or(defaults.min_cluster_size),
        ..defaults
    };

    let output: Vec<ClusterOutput> = clustering::cluster_contact_sets(&contact_sets, &config)
        .into_iter()
        .map(|c| ClusterOutput {
            center_idx: c.center_idx,
            members: c.members,
            size: c.size,
        })
        .collect();

    to_js(&output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    const RECEPTOR: &str = include_str!("../../data/2oob_A.pdb");
    const LIGAND: &str = include_str!("../../data/2oob_B.pdb");

    fn json(value: JsValue) -> Value {
        serde_wasm_bindgen::from_value(value).expect("value is not valid JSON data")
    }

    fn quick_dock(restraints: &str, sampling: Option<u32>) -> Value {
        json(
            run_docking(
                RECEPTOR,
                LIGAND,
                restraints,
                Some(2),
                Some(1),
                Some(20),
                sampling,
                None,
                None,
                None,
                None,
                None,
            )
            .unwrap(),
        )
    }

    #[wasm_bindgen_test]
    fn score_total_is_the_weighted_sum() {
        let s = score_structures(RECEPTOR, LIGAND, 0.4, 0.05, 3.4, None).unwrap();
        let expected = 0.4 * s.vdw + 0.05 * s.elec + 3.4 * s.desolv + s.clash;
        assert!(s.total.is_finite());
        assert!((s.total - expected).abs() < 1e-9);
    }

    #[wasm_bindgen_test]
    fn score_rejects_a_pdb_without_atoms() {
        assert!(score_structures("END\n", LIGAND, 0.4, 0.05, 3.4, None).is_err());
    }

    #[wasm_bindgen_test]
    fn dock_returns_clustered_and_ranked_poses() {
        let out = quick_dock("[]", None);
        assert!(out["generationsRun"].as_u64().unwrap() >= 1);
        assert!(out["convergedEarly"].is_boolean());
        assert!(!out["clusteredPoses"].as_array().unwrap().is_empty());
        let ranked = out["rankedPoses"].as_array().unwrap();
        assert!(!ranked.is_empty());
        assert!(ranked[0]["ligandPdb"].as_str().unwrap().contains("ATOM"));
        assert!(ranked[0]["clash"].is_number());
    }

    #[wasm_bindgen_test]
    fn dock_sampling_returns_all_poses_without_clusters() {
        let out = quick_dock("[]", Some(30));
        assert!(out["clusteredPoses"].as_array().unwrap().is_empty());
        let ranked = out["rankedPoses"].as_array().unwrap();
        assert!(ranked.len() > 5);
        let fitness: Vec<f64> = ranked
            .iter()
            .map(|p| p["fitness"].as_f64().unwrap())
            .collect();
        assert!(fitness.windows(2).all(|w| w[0] <= w[1]));
    }

    #[wasm_bindgen_test]
    fn dock_is_deterministic_for_a_seed() {
        let a = quick_dock("[[933,6]]", None);
        let b = quick_dock("[[933,6]]", None);
        assert_eq!(
            a["rankedPoses"][0]["fitness"],
            b["rankedPoses"][0]["fitness"]
        );
    }

    #[wasm_bindgen_test]
    fn dock_rejects_bad_restraints_json() {
        let err = run_docking(
            RECEPTOR, LIGAND, "not json", None, None, None, None, None, None, None, None, None,
        );
        assert!(err.is_err());
    }

    #[wasm_bindgen_test]
    fn dock_uses_the_energy_weights() {
        let out = json(
            run_docking(
                RECEPTOR,
                LIGAND,
                "[[933,6],[936,8]]",
                Some(2),
                Some(1),
                Some(20),
                None,
                Some(1.0),
                Some(0.5),
                Some(2.0),
                Some(0.1),
                Some(3.0),
            )
            .unwrap(),
        );
        let p = &out["rankedPoses"][0];
        let term = |name: &str| p[name].as_f64().unwrap();
        let expected = term("vdw")
            + 0.5 * term("elec")
            + 2.0 * term("desolv")
            + 0.1 * term("air")
            + 3.0 * term("clash");
        assert!((term("fitness") - expected).abs() < 1e-6);
    }

    #[wasm_bindgen_test]
    fn generate_restraints_finds_the_interface() {
        // The 2oob chains are in the bound position in these files.
        let ambig = json(generate_restraints(RECEPTOR, LIGAND, None, None).unwrap());
        let unambig = json(
            generate_restraints(RECEPTOR, LIGAND, Some(5.0), Some("unambig".to_string())).unwrap(),
        );
        let ambig = ambig.as_array().unwrap();
        let unambig = unambig.as_array().unwrap();
        assert!(!unambig.is_empty());
        assert!(ambig.len() >= unambig.len());
        assert!(generate_restraints(RECEPTOR, LIGAND, None, Some("nope".to_string())).is_err());
    }

    #[wasm_bindgen_test]
    fn tbl_to_pairs_reads_active_pairs() {
        let tbl = "assign (resid 1 and segid A) (resid 2 and segid B) 2.0 2.0 0.0\n\
               assign (resid 2 and segid B) (resid 1 and segid A) 2.0 2.0 0.0\n";
        assert_eq!(
            json(tbl_to_pairs(tbl).unwrap()),
            serde_json::json!([[1, 2]])
        );
        assert!(tbl_to_pairs("assign (resid 1 and segid A) 2.0 2.0 0.0").is_err());
    }

    #[wasm_bindgen_test]
    fn contacts_and_clustering() {
        let contacts = json(compute_contacts(RECEPTOR, LIGAND).unwrap());
        assert!(!contacts.as_array().unwrap().is_empty());

        let sets = serde_json::json!([contacts, contacts, ["A 9 B 9"]]).to_string();
        let clusters = json(cluster_from_contacts(&sets, None, Some(2)).unwrap());
        assert_eq!(clusters[0]["members"], serde_json::json!([0, 1]));
        assert_eq!(clusters[0]["size"], 2);
    }
}
