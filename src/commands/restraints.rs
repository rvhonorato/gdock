use crate::structure::read_pdb;

// These functions moved to `crate::restraints`, which also builds for wasm32.
use crate::restraints::{find_ambiguous_pairs, parse_tbl};
pub use crate::restraints::{find_interface_pairs, find_unambiguous_pairs};

fn print_pairs(pairs: &[(i16, i16)]) {
    let pairs: Vec<String> = pairs.iter().map(|(r, l)| format!("{}:{}", r, l)).collect();
    println!("{}", pairs.join(","));
}

/// Generate restraints from interface contacts and print to stdout.
///
/// Uses HADDOCK-style cross-product: finds all receptor residues with any contact
/// to the ligand (active rec) and all ligand residues with any contact to the
/// receptor (active lig), then emits every active_rec × active_lig pair.
/// Each anchor gets the full active ligand set as its OR group, matching the
/// ambiguity semantics of HADDOCK AIR restraints.
pub fn generate_restraints(receptor_file: String, ligand_file: String, cutoff: f64) {
    let receptor_model = read_pdb(&receptor_file);
    let ligand_model = read_pdb(&ligand_file);

    print_pairs(&find_ambiguous_pairs(
        &receptor_model.0[0],
        &ligand_model.0[0],
        cutoff,
    ));
}

/// Generate unambiguous restraints: one closest-partner pair per receptor residue.
///
/// Unlike `generate_restraints` (which emits a cross-product of all active residues),
/// this selects only the single ligand residue that is closest (minimum heavy-atom
/// distance) to each receptor interface residue. The resulting pairs are tight
/// 1:1 restraints suitable for AmbiguousRestraint with a single-element OR group.
pub fn generate_restraints_unambig(receptor_file: String, ligand_file: String, cutoff: f64) {
    let receptor_model = read_pdb(&receptor_file);
    let ligand_model = read_pdb(&ligand_file);

    print_pairs(&find_unambiguous_pairs(
        &receptor_model.0[0],
        &ligand_model.0[0],
        cutoff,
    ));
}

/// Read a HADDOCK AIR `.tbl` file into `(receptor_resseq, ligand_resseq)` pairs.
///
/// See [`parse_tbl`] for the rules. Exits the process on an error.
pub fn tbl_to_pairs(tbl_file: &str) -> Vec<(i32, i32)> {
    let content = std::fs::read_to_string(tbl_file).unwrap_or_else(|e| {
        eprintln!("Error: cannot read TBL file '{}': {}", tbl_file, e);
        std::process::exit(1);
    });
    parse_tbl(&content).unwrap_or_else(|e| {
        eprintln!("Error: {} in '{}'", e, tbl_file);
        std::process::exit(1);
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_interface_pairs_with_test_data() {
        let receptor_model = read_pdb("data/2oob_A.pdb");
        let ligand_model = read_pdb("data/2oob_B.pdb");

        let receptor = &receptor_model.0[0];
        let ligand = &ligand_model.0[0];

        let pairs = find_interface_pairs(receptor, ligand, 5.0);

        // Should find some interface pairs
        assert!(!pairs.is_empty(), "Should find interface pairs");

        // All pairs should be sorted
        let mut sorted = pairs.clone();
        sorted.sort();
        assert_eq!(pairs, sorted, "Pairs should be sorted");
    }

    #[test]
    fn test_find_interface_pairs_cutoff_effect() {
        let receptor_model = read_pdb("data/2oob_A.pdb");
        let ligand_model = read_pdb("data/2oob_B.pdb");

        let receptor = &receptor_model.0[0];
        let ligand = &ligand_model.0[0];

        let pairs_5a = find_interface_pairs(receptor, ligand, 5.0);
        let pairs_10a = find_interface_pairs(receptor, ligand, 10.0);

        // Larger cutoff should find more or equal pairs
        assert!(
            pairs_10a.len() >= pairs_5a.len(),
            "10Å cutoff should find >= pairs than 5Å"
        );
    }

    #[test]
    fn test_find_unambiguous_pairs_one_per_receptor_residue() {
        let receptor_model = read_pdb("data/2oob_A.pdb");
        let ligand_model = read_pdb("data/2oob_B.pdb");

        let receptor = &receptor_model.0[0];
        let ligand = &ligand_model.0[0];

        let unambig = find_unambiguous_pairs(receptor, ligand, 5.0);

        // Each receptor residue must appear exactly once
        let mut rec_residues: Vec<i16> = unambig.iter().map(|(r, _)| *r).collect();
        let original_len = rec_residues.len();
        rec_residues.dedup();
        assert_eq!(
            rec_residues.len(),
            original_len,
            "Each receptor residue should appear at most once"
        );

        // Result must be a subset of find_interface_pairs (every pair must be a valid contact)
        let all_pairs = find_interface_pairs(receptor, ligand, 5.0);
        for (r, l) in &unambig {
            assert!(
                all_pairs.contains(&(*r, *l)),
                "Unambig pair ({r},{l}) must be a valid interface contact"
            );
        }
    }

    #[test]
    fn test_find_unambiguous_pairs_fewer_than_ambig() {
        let receptor_model = read_pdb("data/2oob_A.pdb");
        let ligand_model = read_pdb("data/2oob_B.pdb");

        let receptor = &receptor_model.0[0];
        let ligand = &ligand_model.0[0];

        let ambig = find_interface_pairs(receptor, ligand, 5.0);
        let unambig = find_unambiguous_pairs(receptor, ligand, 5.0);

        // Unambig yields at most one pair per receptor residue, so never more than ambig
        assert!(
            unambig.len() <= ambig.len(),
            "Unambig pairs ({}) should be <= interface pairs ({})",
            unambig.len(),
            ambig.len()
        );
        assert!(!unambig.is_empty(), "Should find at least one unambig pair");
    }

    #[test]
    fn test_find_unambiguous_pairs_selects_closest() {
        use crate::structure::{Atom, Molecule};

        fn make_atom(resseq: i16, x: f64, y: f64, z: f64) -> Atom {
            Atom {
                serial: 1,
                name: "CA".to_string(),
                altloc: ' ',
                resname: "ALA".to_string(),
                chainid: 'A',
                resseq,
                icode: ' ',
                x,
                y,
                z,
                occupancy: 1.0,
                tempfactor: 0.0,
                element: "C".to_string(),
                charge: 0.0,
                vdw_radius: 1.7,
                epsilon: -0.1,
                rmin2: 2.0,
                eps_1_4: -0.1,
                rmin2_1_4: 1.9,
            }
        }

        // Receptor residue 1 at origin; two ligand residues: 10 at 3Å, 11 at 8Å.
        // Both within cutoff=10. Unambig must pick residue 10 (closer).
        let mut receptor = Molecule::new();
        receptor.0.push(make_atom(1, 0.0, 0.0, 0.0));

        let mut ligand = Molecule::new();
        ligand.0.push(make_atom(10, 3.0, 0.0, 0.0));
        ligand.0.push(make_atom(11, 8.0, 0.0, 0.0));

        let pairs = find_unambiguous_pairs(&receptor, &ligand, 10.0);
        assert_eq!(pairs.len(), 1);
        assert_eq!(
            pairs[0],
            (1, 10),
            "Should select residue 10 (3Å) over 11 (8Å)"
        );
    }
}
