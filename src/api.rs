//! High-level entry points for the language bindings.
//!
//! The Python and WebAssembly crates call these functions, so that they do
//! the same setup as the CLI `run` and `score` commands.

use rand::rngs::StdRng;
use rand::SeedableRng;

use crate::chromosome::Chromosome;
use crate::constants::{self, EnergyWeights};
use crate::evaluator::Evaluator;
use crate::fitness;
use crate::hall_of_fame::HallOfFameEntry;
use crate::population::Population;
use crate::restraints::create_ambiguous_restraints_from_pairs;
use crate::runner::{run_ga, select_models};
use crate::structure::{self, combine_molecules, Molecule};
use crate::utils::position_ligand;

/// Read the first model of a PDB string. `label` names the input in the error.
pub fn parse_molecule(pdb: &str, label: &str) -> Result<Molecule, String> {
    structure::read_pdb_from_str(pdb)
        .0
        .into_iter()
        .next()
        // The parser returns an empty molecule for input without atoms.
        .filter(|m| !m.0.is_empty())
        .ok_or_else(|| format!("{label} PDB contains no atoms"))
}

/// Energy terms of one receptor-ligand complex.
#[derive(Debug, Clone, Copy)]
pub struct Score {
    pub vdw: f64,
    pub elec: f64,
    pub desolv: f64,
    pub clash: f64,
    /// Weighted sum of the terms above. It has no AIR term.
    pub total: f64,
}

/// Score a complex as the CLI `score` command does, without restraints.
pub fn score(receptor: &Molecule, ligand: &Molecule, weights: &EnergyWeights) -> Score {
    let vdw = fitness::vdw_energy(receptor, ligand);
    let elec = fitness::elec_energy(receptor, ligand);
    let desolv = fitness::desolv_energy(receptor, ligand);
    let clash = fitness::count_clashes(receptor, ligand).0 as f64;
    let total =
        weights.vdw * vdw + weights.elec * elec + weights.desolv * desolv + weights.clash * clash;
    Score {
        vdw,
        elec,
        desolv,
        clash,
        total,
    }
}

/// Settings for [`dock`]. The defaults are the CLI defaults.
#[derive(Debug, Clone)]
pub struct DockParams {
    pub max_generations: u64,
    pub population_size: u64,
    pub seed: u64,
    /// Sampling mode: keep up to this many unique poses and return all of them.
    pub sampling: Option<usize>,
    pub weights: EnergyWeights,
}

impl Default for DockParams {
    fn default() -> Self {
        Self {
            max_generations: constants::MAX_GENERATIONS,
            population_size: constants::POPULATION_SIZE,
            seed: constants::RANDOM_SEED,
            sampling: None,
            weights: EnergyWeights::default(),
        }
    }
}

/// One docked pose.
#[derive(Debug, Clone)]
pub struct Pose {
    /// Position in its list, from 1.
    pub rank: usize,
    pub fitness: f64,
    pub vdw: f64,
    pub elec: f64,
    pub desolv: f64,
    pub air: f64,
    pub clash: f64,
    /// Number of members in the cluster. 0 if the pose is not a cluster centre.
    pub cluster_size: usize,
    /// The ligand in its docked position.
    pub ligand: Molecule,
}

impl Pose {
    pub fn ligand_pdb(&self) -> String {
        self.ligand.to_pdb_string()
    }

    /// PDB string of the receptor together with the docked ligand.
    pub fn complex_pdb(&self, receptor: &Molecule) -> String {
        combine_molecules(receptor, &self.ligand).to_pdb_string()
    }
}

/// Result of [`dock`].
pub struct DockRun {
    pub generations_run: u64,
    pub converged_early: bool,
    pub receptor: Molecule,
    /// The population after the last evaluation.
    pub final_population: Population,
    sampling: bool,
    // The ligand at the start position, which the genes refer to.
    ligand: Molecule,
    entries: Vec<HallOfFameEntry>,
}

impl DockRun {
    /// The ligand at the start position. The genes of each entry move this molecule.
    pub fn ligand(&self) -> &Molecule {
        &self.ligand
    }

    /// The Hall-of-Fame entries, in no special order.
    pub fn entries(&self) -> &[HallOfFameEntry] {
        &self.entries
    }

    fn pose(&self, rank: usize, entry: &HallOfFameEntry, cluster_size: usize) -> Pose {
        let g = entry.genes;
        let ligand = self
            .ligand
            .clone()
            .rotate(g[0], g[1], g[2])
            .displace(g[3], g[4], g[5]);
        Pose {
            rank,
            fitness: entry.fitness,
            vdw: entry.vdw,
            elec: entry.elec,
            desolv: entry.desolv,
            air: entry.air,
            clash: entry.clash,
            cluster_size,
            ligand,
        }
    }

    /// The output poses for the mode of the run: `(clustered, ranked)`.
    ///
    /// A sampling run gives all poses in `ranked` and no clustered poses,
    /// because the clustering of a large Hall of Fame is slow.
    pub fn poses(&self) -> (Vec<Pose>, Vec<Pose>) {
        if self.sampling {
            (Vec::new(), self.sampled())
        } else {
            self.selected()
        }
    }

    /// The default output models: `(clustered, ranked)`.
    ///
    /// `clustered` has the cluster centres, best fitness first. `ranked` has
    /// the best poses by fitness only. This call does the FCC clustering.
    pub fn selected(&self) -> (Vec<Pose>, Vec<Pose>) {
        let selected = select_models(&self.entries, &self.receptor, &self.ligand);
        let clustered = selected
            .clustered
            .iter()
            .enumerate()
            .map(|(i, &(idx, size))| self.pose(i + 1, &self.entries[idx], size))
            .collect();
        let ranked = selected
            .ranked
            .iter()
            .enumerate()
            .map(|(i, &idx)| self.pose(i + 1, &self.entries[idx], 0))
            .collect();
        (clustered, ranked)
    }

    /// All Hall-of-Fame poses, best fitness first, without clustering.
    pub fn sampled(&self) -> Vec<Pose> {
        let mut sorted: Vec<&HallOfFameEntry> = self.entries.iter().collect();
        sorted.sort_by(|a, b| {
            a.fitness
                .partial_cmp(&b.fitness)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        sorted
            .into_iter()
            .enumerate()
            .map(|(i, e)| self.pose(i + 1, e, 0))
            .collect()
    }
}

/// Run the genetic algorithm. The CLI `run` command and the bindings use this.
///
/// `pairs` are `(receptor_resseq, ligand_resseq)` restraint pairs.
pub fn dock(
    receptor: Molecule,
    ligand: Molecule,
    pairs: &[(i32, i32)],
    params: &DockParams,
) -> DockRun {
    dock_with(receptor, ligand, pairs, params, None, |_, _| {})
}

/// [`dock`] with the extras of the CLI.
///
/// `debug_evaluator` makes the fitness the DockQ against a reference, not the
/// energy. `on_generation` gets each evaluated population, for progress reports.
pub fn dock_with<F>(
    receptor: Molecule,
    ligand: Molecule,
    pairs: &[(i32, i32)],
    params: &DockParams,
    debug_evaluator: Option<Evaluator>,
    on_generation: F,
) -> DockRun
where
    F: FnMut(u64, &Population),
{
    let restraints = create_ambiguous_restraints_from_pairs(&receptor, &ligand, pairs);
    let original = ligand.clone();
    let ligand = position_ligand(&receptor, ligand);

    let mut rng = StdRng::seed_from_u64(params.seed);
    let chromosomes = (0..params.population_size)
        .map(|_| Chromosome::new(&mut rng))
        .collect();

    let pop = Population::new(
        chromosomes,
        receptor.clone(),
        ligand.clone(),
        original,
        restraints,
        params.weights,
        debug_evaluator,
    );

    let ga = run_ga(
        pop,
        &mut rng,
        params.max_generations,
        params.sampling.unwrap_or(constants::HALL_OF_FAME_MAX_SIZE),
        on_generation,
    );

    DockRun {
        generations_run: ga.generations_run,
        converged_early: ga.converged_early,
        receptor,
        sampling: params.sampling.is_some(),
        ligand,
        entries: ga.hall_of_fame.entries().to_vec(),
        final_population: ga.final_population,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inputs() -> (Molecule, Molecule) {
        let rec = std::fs::read_to_string("data/2oob_A.pdb").unwrap();
        let lig = std::fs::read_to_string("data/2oob_B.pdb").unwrap();
        (
            parse_molecule(&rec, "Receptor").unwrap(),
            parse_molecule(&lig, "Ligand").unwrap(),
        )
    }

    fn quick_params() -> DockParams {
        DockParams {
            max_generations: 3,
            population_size: 20,
            ..DockParams::default()
        }
    }

    #[test]
    fn parse_molecule_rejects_empty_input() {
        let err = parse_molecule("END\n", "Ligand").unwrap_err();
        assert_eq!(err, "Ligand PDB contains no atoms");
    }

    #[test]
    fn score_total_is_weighted_sum() {
        let (receptor, ligand) = inputs();
        let w = EnergyWeights::default();
        let s = score(&receptor, &ligand, &w);
        let expected = w.vdw * s.vdw + w.elec * s.elec + w.desolv * s.desolv + w.clash * s.clash;
        assert!(s.total.is_finite());
        assert!((s.total - expected).abs() < 1e-9);
    }

    #[test]
    fn dock_is_deterministic_for_a_seed() {
        let (receptor, ligand) = inputs();
        let a = dock(receptor.clone(), ligand.clone(), &[], &quick_params());
        let b = dock(receptor, ligand, &[], &quick_params());
        let (_, ra) = a.selected();
        let (_, rb) = b.selected();
        assert!(!ra.is_empty());
        assert_eq!(ra.len(), rb.len());
        for (x, y) in ra.iter().zip(&rb) {
            assert_eq!(x.fitness, y.fitness);
        }
    }

    #[test]
    fn sampled_poses_are_sorted_and_ranked() {
        let (receptor, ligand) = inputs();
        let run = dock(receptor, ligand, &[], &quick_params());
        let poses = run.sampled();
        assert!(!poses.is_empty());
        assert!(poses.windows(2).all(|p| p[0].fitness <= p[1].fitness));
        assert!(poses.iter().enumerate().all(|(i, p)| p.rank == i + 1));
    }

    #[test]
    fn sampling_run_returns_all_poses_without_clusters() {
        let (receptor, ligand) = inputs();
        let params = DockParams {
            sampling: Some(50),
            ..quick_params()
        };
        let run = dock(receptor, ligand, &[], &params);
        let (clustered, ranked) = run.poses();
        assert!(clustered.is_empty());
        assert_eq!(ranked.len(), run.sampled().len());
    }

    #[test]
    fn complex_pdb_has_receptor_and_ligand_atoms() {
        let (receptor, ligand) = inputs();
        let n_atoms = receptor.0.len() + ligand.0.len();
        let run = dock(receptor, ligand, &[], &quick_params());
        let pose = &run.sampled()[0];
        let pdb = pose.complex_pdb(&run.receptor);
        assert_eq!(
            pdb.lines().filter(|l| l.starts_with("ATOM")).count(),
            n_atoms
        );
    }
}
