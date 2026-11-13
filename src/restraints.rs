use std::collections::{HashMap, HashSet};

use crate::structure::{self, Atom, Molecule};

#[derive(Debug, Clone)]
pub struct Restraint(pub structure::Atom, pub structure::Atom);

/// A HADDOCK-style ambiguous restraint: one anchor residue against an OR group.
///
/// The restraint is satisfied when the effective distance `deff` (1/r^6 sum over
/// all heavy-atom pairs) falls below `AIR_UPPER_BOUND`. Restraints are always
/// created in pairs (receptor-anchored + ligand-anchored) by
/// `create_ambiguous_restraints_from_pairs` to replicate HADDOCK's bidirectional scoring.
#[derive(Debug, Clone)]
pub struct AmbiguousRestraint {
    pub anchor_resseq: i32,
    pub or_group_resseqs: Vec<i32>,
    anchor_on_receptor: bool,
}

impl AmbiguousRestraint {
    /// Compute deff = [Σ_j Σ_a Σ_b 1/r_ab^6]^(-1/6) over all heavy-atom pairs
    /// between the anchor residue and every OR-group residue.
    /// Returns `None` when no heavy atoms are found (anchor or OR group missing).
    pub fn compute_deff(
        &self,
        receptor: &structure::Molecule,
        ligand: &structure::Molecule,
    ) -> Option<f64> {
        let (anchor_mol, or_mol) = if self.anchor_on_receptor {
            (receptor, ligand)
        } else {
            (ligand, receptor)
        };
        let anchor_atoms: Vec<&structure::Atom> = anchor_mol
            .0
            .iter()
            .filter(|a| a.resseq as i32 == self.anchor_resseq && a.element.trim() != "H")
            .collect();
        if anchor_atoms.is_empty() {
            return None;
        }
        let mut sum = 0.0_f64;
        for &or_resseq in &self.or_group_resseqs {
            for b in or_mol
                .0
                .iter()
                .filter(|b| b.resseq as i32 == or_resseq && b.element.trim() != "H")
            {
                for a in &anchor_atoms {
                    let d = structure::distance(a, b).max(0.1);
                    sum += 1.0 / d.powi(6);
                }
            }
        }
        if sum <= 0.0 {
            return None;
        }
        Some(sum.powf(-1.0 / 6.0))
    }

    pub fn is_satisfied(
        &self,
        receptor: &structure::Molecule,
        ligand: &structure::Molecule,
    ) -> bool {
        self.compute_deff(receptor, ligand)
            .map(|deff| deff <= crate::constants::AIR_UPPER_BOUND)
            .unwrap_or(false)
    }
}

/// Create ambiguous restraints from (receptor_resseq, ligand_resseq) pairs.
///
/// Produces bidirectional restraints (HADDOCK-style): one receptor-anchored restraint
/// per unique receptor residue and one ligand-anchored restraint per unique ligand
/// residue. Both directions are scored independently, matching HADDOCK's behaviour
/// where active residues on both chains incur a penalty if not at the interface.
pub fn create_ambiguous_restraints_from_pairs(
    _mol1: &structure::Molecule,
    _mol2: &structure::Molecule,
    pairs: &[(i32, i32)],
) -> Vec<AmbiguousRestraint> {
    let mut result = group_into_restraints(pairs, true);
    let swapped: Vec<(i32, i32)> = pairs.iter().map(|&(r, l)| (l, r)).collect();
    result.extend(group_into_restraints(&swapped, false));
    result
}

fn group_into_restraints(
    pairs: &[(i32, i32)],
    anchor_on_receptor: bool,
) -> Vec<AmbiguousRestraint> {
    let mut groups: HashMap<i32, Vec<i32>> = HashMap::new();
    for &(anchor, partner) in pairs {
        groups.entry(anchor).or_default().push(partner);
    }
    let mut anchors: Vec<i32> = groups.keys().cloned().collect();
    anchors.sort();
    anchors
        .into_iter()
        .map(|anchor| {
            let mut or_group = groups.remove(&anchor).unwrap();
            or_group.sort();
            or_group.dedup();
            AmbiguousRestraint {
                anchor_resseq: anchor,
                or_group_resseqs: or_group,
                anchor_on_receptor,
            }
        })
        .collect()
}

impl Restraint {
    fn new(atom1: structure::Atom, atom2: structure::Atom) -> Self {
        Self(atom1, atom2)
    }

    pub fn is_satisfied(
        &self,
        receptor: &structure::Molecule,
        ligand: &structure::Molecule,
    ) -> bool {
        // The restraint is based on CA atoms, so check CA-CA distance
        // This is consistent with how restraints are created

        // Find CA atom in receptor with matching resseq
        let ca_receptor = receptor
            .0
            .iter()
            .find(|x| x.resseq == self.0.resseq && x.name.trim() == "CA");

        // Find CA atom in ligand with matching resseq
        let ca_ligand = ligand
            .0
            .iter()
            .find(|x| x.resseq == self.1.resseq && x.name.trim() == "CA");

        // Both CAs must exist
        if let (Some(ca1), Some(ca2)) = (ca_receptor, ca_ligand) {
            let dist = structure::distance(ca1, ca2);
            // Restraint is satisfied if within flat-bottom bounds [0.0, 7.0]
            // This matches the upper_bound in air_energy()
            return dist <= 7.0;
        }

        false
    }
}

/// Create restraints from user-specified residue pairs
pub fn create_restraints_from_pairs(
    mol1: &structure::Molecule,
    mol2: &structure::Molecule,
    pairs: &[(i32, i32)],
) -> Vec<Restraint> {
    let mut restraints = Vec::new();

    for (res1, res2) in pairs {
        // Find CA atom in mol1 with matching residue number
        let ca_atom_1 = mol1
            .0
            .iter()
            .find(|atom| atom.name.trim() == "CA" && atom.resseq as i32 == *res1);

        // Find CA atom in mol2 with matching residue number
        let ca_atom_2 = mol2
            .0
            .iter()
            .find(|atom| atom.name.trim() == "CA" && atom.resseq as i32 == *res2);

        // Both CAs must exist
        if let (Some(atom1), Some(atom2)) = (ca_atom_1, ca_atom_2) {
            let restraint = Restraint::new(atom1.clone(), atom2.clone());
            restraints.push(restraint);
        } else {
            eprintln!(
                "Warning: Restraint pair {}:{} not found in structures",
                res1, res2
            );
        }
    }

    restraints
}

/// Create restraints automatically from interface (for benchmarking/development)
pub fn create_restraints(mol1: &structure::Molecule, mol2: &structure::Molecule) -> Vec<Restraint> {
    let mut restraints = Vec::new();

    // Only create restraints for CA atoms (backbone) to reduce the number of restraints
    // This is more realistic for protein-protein docking
    let ca_atoms_1: Vec<&structure::Atom> = mol1
        .0
        .iter()
        .filter(|atom| atom.name.trim() == "CA")
        .collect();

    let ca_atoms_2: Vec<&structure::Atom> = mol2
        .0
        .iter()
        .filter(|atom| atom.name.trim() == "CA")
        .collect();

    // Loop over CA atoms in mol1
    for atom1 in ca_atoms_1.iter() {
        // Loop over CA atoms in mol2
        for atom2 in ca_atoms_2.iter() {
            // Create restraints for CA atoms within 7.0A (interface contacts)
            // This matches the upper_bound used in air_energy() flat-bottom potential
            let dist = structure::distance(atom1, atom2);
            if dist < 7.0 {
                // Create a new restraint
                let restraint = Restraint::new((*atom1).clone(), (*atom2).clone());

                // Add the restraint to the vector
                restraints.push(restraint);
            }
        }
    }

    restraints
}

/// Find interface residue pairs between receptor and ligand within a distance cutoff.
/// Returns pairs of (receptor_resseq, ligand_resseq) that are in contact.
pub fn find_interface_pairs(
    receptor: &Molecule,
    ligand: &Molecule,
    cutoff: f64,
) -> Vec<(i16, i16)> {
    let mut interface_pairs: Vec<(i16, i16)> = Vec::new();

    // Get unique residues from receptor and ligand
    let rec_residues: HashSet<i16> = receptor.0.iter().map(|a| a.resseq).collect();
    let lig_residues: HashSet<i16> = ligand.0.iter().map(|a| a.resseq).collect();

    for rec_res in &rec_residues {
        for lig_res in &lig_residues {
            // Get heavy atoms for this residue pair
            let rec_atoms: Vec<_> = receptor
                .0
                .iter()
                .filter(|a| a.resseq == *rec_res && !a.name.starts_with('H'))
                .collect();
            let lig_atoms: Vec<_> = ligand
                .0
                .iter()
                .filter(|a| a.resseq == *lig_res && !a.name.starts_with('H'))
                .collect();

            // Check if any pair of atoms is within cutoff
            'outer: for rec_atom in &rec_atoms {
                for lig_atom in &lig_atoms {
                    let dx = rec_atom.x - lig_atom.x;
                    let dy = rec_atom.y - lig_atom.y;
                    let dz = rec_atom.z - lig_atom.z;
                    let dist = (dx * dx + dy * dy + dz * dz).sqrt();

                    if dist <= cutoff {
                        interface_pairs.push((*rec_res, *lig_res));
                        break 'outer;
                    }
                }
            }
        }
    }

    // Sort for consistent output
    interface_pairs.sort();
    interface_pairs
}

/// Find HADDOCK-style ambiguous pairs: the cross-product of the interface residues.
///
/// Every receptor residue in contact with the ligand is paired with every
/// ligand residue in contact with the receptor.
pub fn find_ambiguous_pairs(
    receptor: &Molecule,
    ligand: &Molecule,
    cutoff: f64,
) -> Vec<(i16, i16)> {
    let interface_pairs = find_interface_pairs(receptor, ligand, cutoff);

    let mut active_rec: Vec<i16> = interface_pairs.iter().map(|(r, _)| *r).collect();
    active_rec.sort();
    active_rec.dedup();

    let mut active_lig: Vec<i16> = interface_pairs.iter().map(|(_, l)| *l).collect();
    active_lig.sort();
    active_lig.dedup();

    let mut pairs = Vec::with_capacity(active_rec.len() * active_lig.len());
    for r in &active_rec {
        for l in &active_lig {
            pairs.push((*r, *l));
        }
    }
    pairs
}

/// Minimum heavy-atom distance from a pre-collected receptor atom slice to a ligand residue.
fn min_dist_to_res(rec_atoms: &[&Atom], ligand: &Molecule, lig_res: i16) -> f64 {
    ligand
        .0
        .iter()
        .filter(|a| a.resseq == lig_res && !a.name.starts_with('H'))
        .flat_map(|la| {
            rec_atoms.iter().map(move |ra| {
                let dx = ra.x - la.x;
                let dy = ra.y - la.y;
                let dz = ra.z - la.z;
                (dx * dx + dy * dy + dz * dz).sqrt()
            })
        })
        .fold(f64::INFINITY, f64::min)
}

/// Like `find_interface_pairs` but returns only the single closest ligand partner
/// per receptor residue (minimum heavy-atom distance).
///
/// Use this to generate unambiguous 1:1 restraints where the GA must bring a
/// specific receptor residue close to a specific ligand residue, rather than
/// satisfying any member of a large OR group.
pub fn find_unambiguous_pairs(
    receptor: &Molecule,
    ligand: &Molecule,
    cutoff: f64,
) -> Vec<(i16, i16)> {
    let all_pairs = find_interface_pairs(receptor, ligand, cutoff);

    let mut by_rec: HashMap<i16, Vec<i16>> = HashMap::new();
    for (r, l) in &all_pairs {
        by_rec.entry(*r).or_default().push(*l);
    }

    let mut result: Vec<(i16, i16)> = by_rec
        .iter()
        .filter_map(|(rec_res, lig_candidates)| {
            let rec_atoms: Vec<&Atom> = receptor
                .0
                .iter()
                .filter(|a| a.resseq == *rec_res && !a.name.starts_with('H'))
                .collect();
            lig_candidates
                .iter()
                .map(|&l| (l, min_dist_to_res(&rec_atoms, ligand, l)))
                .min_by(|(_, d1), (_, d2)| d1.partial_cmp(d2).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(closest, _)| (*rec_res, closest))
        })
        .collect();

    result.sort();
    result
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Split the text on the word `assign` (any case) and drop the part before the first one.
///
/// This is a hand-written parser: the `regex` crate adds about 1 MB to the wasm build.
fn split_assign_blocks(text: &str) -> Vec<&str> {
    const WORD: &str = "assign";
    let lower = text.to_ascii_lowercase();
    let mut blocks = Vec::new();
    let mut block_start: Option<usize> = None;
    let mut from = 0;
    while let Some(found) = lower[from..].find(WORD) {
        let at = from + found;
        let end = at + WORD.len();
        let before_ok = !lower[..at].chars().next_back().is_some_and(is_word_char);
        let after_ok = !lower[end..].chars().next().is_some_and(is_word_char);
        if before_ok && after_ok {
            if let Some(start) = block_start {
                blocks.push(&text[start..at]);
            }
            block_start = Some(end);
        }
        from = end;
    }
    if let Some(start) = block_start {
        blocks.push(&text[start..]);
    }
    blocks
}

/// Read one selection group: `resid N and segid X` or `segid X and resid N`.
fn parse_selection(group: &str) -> Option<(String, i32)> {
    let words: Vec<&str> = group.split_whitespace().collect();
    let is_resid = |w: &str| w.eq_ignore_ascii_case("resid") || w.eq_ignore_ascii_case("resi");
    let is_word = |w: &str| !w.is_empty() && w.chars().all(is_word_char);
    let [a, b, and, c, d] = words[..] else {
        return None;
    };
    if !and.eq_ignore_ascii_case("and") {
        return None;
    }
    let (resi, segid) = if is_resid(a) && c.eq_ignore_ascii_case("segid") {
        (b, d)
    } else if a.eq_ignore_ascii_case("segid") && is_resid(c) {
        (d, b)
    } else {
        return None;
    };
    if !is_word(segid) || resi.is_empty() || !resi.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some((segid.to_uppercase(), resi.parse().ok()?))
}

/// Extract `(segid, resseq)` tuples from one assign block's text.
///
/// Handles both `(resid N and segid X)` and `(segid X and resid N)` forms,
/// and accepts the `resi` abbreviation used by some HADDOCK versions.
/// Only the innermost parentheses are read.
fn parse_selections(block: &str) -> Vec<(String, i32)> {
    let mut found = Vec::new();
    let mut open: Option<usize> = None;
    for (i, c) in block.char_indices() {
        match c {
            '(' => open = Some(i + 1),
            ')' => {
                if let Some(start) = open.take() {
                    found.extend(parse_selection(&block[start..i]));
                }
            }
            _ => {}
        }
    }
    found
}

/// Parse the text of a HADDOCK AIR `.tbl` file into active-active `(receptor_resseq, ligand_resseq)` pairs.
///
/// Chain identities are detected automatically: the segid that first appears as an
/// anchor is treated as the receptor; the other segid is the ligand.  Only residues
/// that appear as anchors are considered active; passive OR-group members (never
/// anchors) are silently dropped.
pub fn parse_tbl(content: &str) -> Result<Vec<(i32, i32)>, String> {
    let stripped: String = content
        .lines()
        .map(|line| {
            if let Some(pos) = line.find('!') {
                &line[..pos]
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let blocks = split_assign_blocks(&stripped);

    let parsed: Vec<Vec<(String, i32)>> = blocks.iter().map(|b| parse_selections(b)).collect();

    // Auto-detect chains: first segid seen as an anchor = receptor; the other = ligand.
    let mut rec = String::new();
    let mut lig = String::new();
    'outer: for sels in &parsed {
        if let Some((anchor_seg, _)) = sels.first() {
            if rec.is_empty() {
                rec = anchor_seg.clone();
            }
            for (seg, _) in &sels[1..] {
                if seg != &rec && lig.is_empty() {
                    lig = seg.clone();
                    break 'outer;
                }
            }
        }
    }

    if rec.is_empty() || lig.is_empty() {
        return Err("could not detect two distinct chain segids".to_string());
    }

    // First pass — every anchor is active.
    let mut active: HashSet<(String, i32)> = HashSet::new();
    for sels in &parsed {
        if let Some(anchor) = sels.first() {
            active.insert(anchor.clone());
        }
    }

    // Second pass — collect pairs where both anchor and partner are active.
    let mut groups: HashMap<i32, HashSet<i32>> = HashMap::new();
    for sels in &parsed {
        if sels.len() < 2 {
            continue;
        }
        let (anchor_seg, anchor_resi) = &sels[0];
        for (partner_seg, partner_resi) in &sels[1..] {
            if !active.contains(&(partner_seg.clone(), *partner_resi)) {
                continue;
            }
            if anchor_seg == &rec && partner_seg == &lig {
                groups
                    .entry(*anchor_resi)
                    .or_default()
                    .insert(*partner_resi);
            } else if anchor_seg == &lig && partner_seg == &rec {
                groups
                    .entry(*partner_resi)
                    .or_default()
                    .insert(*anchor_resi);
            }
        }
    }

    let mut pairs: Vec<(i32, i32)> = groups
        .into_iter()
        .flat_map(|(rec_resi, lig_set)| lig_set.into_iter().map(move |l| (rec_resi, l)))
        .collect();
    pairs.sort();

    if pairs.is_empty() {
        eprintln!(
            "Warning: no active-active pairs found for chains '{}'/'{}'",
            rec, lig
        );
    }

    Ok(pairs)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_atom_heavy(resseq: i16, x: f64, y: f64, z: f64) -> structure::Atom {
        structure::Atom {
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
            epsilon: 0.0,
            rmin2: 0.0,
            eps_1_4: 0.0,
            rmin2_1_4: 0.0,
        }
    }

    #[test]
    fn test_create_ambiguous_single_anchor_single_partner() {
        // pairs [(1,10)] → rec-anchored: 1→[10]; lig-anchored: 10→[1] → 2 total
        let mol = structure::Molecule::new();
        let restraints = create_ambiguous_restraints_from_pairs(&mol, &mol, &[(1, 10)]);
        assert_eq!(restraints.len(), 2);
        assert_eq!(restraints[0].anchor_resseq, 1);
        assert_eq!(restraints[0].or_group_resseqs, vec![10]);
        assert!(restraints[0].anchor_on_receptor);
        assert_eq!(restraints[1].anchor_resseq, 10);
        assert_eq!(restraints[1].or_group_resseqs, vec![1]);
        assert!(!restraints[1].anchor_on_receptor);
    }

    #[test]
    fn test_create_ambiguous_groups_multiple_partners_under_same_anchor() {
        // pairs [(10,20),(10,21)] → rec-anchored: 10→[20,21]; lig-anchored: 20→[10], 21→[10] → 3 total
        let mol = structure::Molecule::new();
        let restraints = create_ambiguous_restraints_from_pairs(&mol, &mol, &[(10, 20), (10, 21)]);
        assert_eq!(restraints.len(), 3);
        assert_eq!(restraints[0].anchor_resseq, 10);
        assert_eq!(restraints[0].or_group_resseqs, vec![20, 21]);
        assert!(restraints[0].anchor_on_receptor);
    }

    #[test]
    fn test_create_ambiguous_multiple_anchors() {
        // pairs [(10,20),(11,20)] → rec-anchored: 10→[20], 11→[20]; lig-anchored: 20→[10,11] → 3 total
        let mol = structure::Molecule::new();
        let restraints = create_ambiguous_restraints_from_pairs(&mol, &mol, &[(10, 20), (11, 20)]);
        assert_eq!(restraints.len(), 3);
        assert_eq!(restraints[0].anchor_resseq, 10);
        assert_eq!(restraints[1].anchor_resseq, 11);
        assert!(restraints[0].anchor_on_receptor);
        assert!(restraints[1].anchor_on_receptor);
        assert!(!restraints[2].anchor_on_receptor);
        assert_eq!(restraints[2].anchor_resseq, 20);
    }

    #[test]
    fn test_ambiguous_is_satisfied_close() {
        // anchor residue 1 at origin, OR-group residue 10 at 1.5Å → deff=1.5 ≤ 4.0 → satisfied
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom_heavy(1, 0.0, 0.0, 0.0));
        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom_heavy(10, 1.5, 0.0, 0.0));
        let r = AmbiguousRestraint {
            anchor_resseq: 1,
            or_group_resseqs: vec![10],
            anchor_on_receptor: true,
        };
        assert!(r.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_ambiguous_is_not_satisfied_far() {
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom_heavy(1, 0.0, 0.0, 0.0));
        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom_heavy(10, 50.0, 0.0, 0.0));
        let r = AmbiguousRestraint {
            anchor_resseq: 1,
            or_group_resseqs: vec![10],
            anchor_on_receptor: true,
        };
        assert!(!r.is_satisfied(&receptor, &ligand));
    }

    fn create_test_atom(name: &str, resseq: i16, x: f64, y: f64, z: f64) -> structure::Atom {
        structure::Atom {
            serial: 1,
            name: name.to_string(),
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
            epsilon: 0.0,
            rmin2: 0.0,
            eps_1_4: 0.0,
            rmin2_1_4: 0.0,
        }
    }

    #[test]
    fn test_restraint_new() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 5.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1.clone(), atom2.clone());

        assert_eq!(restraint.0.resseq, 1);
        assert_eq!(restraint.1.resseq, 10);
    }

    #[test]
    fn test_restraint_is_satisfied_within_bounds() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 5.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1.clone(), atom2.clone());

        // Create molecules with CA atoms within 7.0A
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0)); // Distance = 5.0

        assert!(restraint.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_restraint_is_satisfied_at_boundary() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 7.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1.clone(), atom2.clone());

        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 7.0, 0.0, 0.0)); // Distance = 7.0 (at boundary)

        assert!(restraint.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_restraint_is_not_satisfied_beyond_bounds() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 10.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1.clone(), atom2.clone());

        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 10.0, 0.0, 0.0)); // Distance = 10.0

        assert!(!restraint.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_restraint_is_not_satisfied_missing_receptor_ca() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 5.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1, atom2);

        // Receptor has wrong residue number
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 99, 0.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0));

        assert!(!restraint.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_restraint_is_not_satisfied_missing_ligand_ca() {
        let atom1 = create_test_atom("CA", 1, 0.0, 0.0, 0.0);
        let atom2 = create_test_atom("CA", 10, 5.0, 0.0, 0.0);

        let restraint = Restraint::new(atom1, atom2);

        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        // Ligand has wrong residue number
        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 99, 5.0, 0.0, 0.0));

        assert!(!restraint.is_satisfied(&receptor, &ligand));
    }

    #[test]
    fn test_create_restraints_from_pairs_single_pair() {
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));
        receptor.0.push(create_test_atom("CB", 1, 0.5, 0.0, 0.0)); // Non-CA atom

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0));
        ligand.0.push(create_test_atom("CB", 10, 5.5, 0.0, 0.0)); // Non-CA atom

        let pairs = vec![(1, 10)];
        let restraints = create_restraints_from_pairs(&receptor, &ligand, &pairs);

        assert_eq!(restraints.len(), 1);
        assert_eq!(restraints[0].0.resseq, 1);
        assert_eq!(restraints[0].1.resseq, 10);
    }

    #[test]
    fn test_create_restraints_from_pairs_multiple_pairs() {
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));
        receptor.0.push(create_test_atom("CA", 2, 1.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0));
        ligand.0.push(create_test_atom("CA", 11, 6.0, 0.0, 0.0));

        let pairs = vec![(1, 10), (2, 11)];
        let restraints = create_restraints_from_pairs(&receptor, &ligand, &pairs);

        assert_eq!(restraints.len(), 2);
        assert_eq!(restraints[0].0.resseq, 1);
        assert_eq!(restraints[0].1.resseq, 10);
        assert_eq!(restraints[1].0.resseq, 2);
        assert_eq!(restraints[1].1.resseq, 11);
    }

    #[test]
    fn test_create_restraints_from_pairs_missing_residue() {
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0));

        // Request a pair where one residue doesn't exist
        let pairs = vec![(1, 10), (999, 10)];
        let restraints = create_restraints_from_pairs(&receptor, &ligand, &pairs);

        // Should only create 1 restraint (the valid one)
        assert_eq!(restraints.len(), 1);
        assert_eq!(restraints[0].0.resseq, 1);
    }

    #[test]
    fn test_create_restraints_from_pairs_no_ca_atoms() {
        let mut receptor = structure::Molecule::new();
        receptor.0.push(create_test_atom("CB", 1, 0.0, 0.0, 0.0)); // Not CA

        let mut ligand = structure::Molecule::new();
        ligand.0.push(create_test_atom("CB", 10, 5.0, 0.0, 0.0)); // Not CA

        let pairs = vec![(1, 10)];
        let restraints = create_restraints_from_pairs(&receptor, &ligand, &pairs);

        // Should create 0 restraints since no CA atoms exist
        assert_eq!(restraints.len(), 0);
    }

    #[test]
    fn test_create_restraints_within_distance() {
        let mut mol1 = structure::Molecule::new();
        mol1.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));
        mol1.0.push(create_test_atom("CA", 2, 100.0, 0.0, 0.0)); // Far away

        let mut mol2 = structure::Molecule::new();
        mol2.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0)); // Within 7.0A of res 1
        mol2.0.push(create_test_atom("CA", 11, 200.0, 0.0, 0.0)); // Far away

        let restraints = create_restraints(&mol1, &mol2);

        // Should only create 1 restraint (1-10 pair within 7.0A)
        assert_eq!(restraints.len(), 1);
        assert_eq!(restraints[0].0.resseq, 1);
        assert_eq!(restraints[0].1.resseq, 10);
    }

    #[test]
    fn test_create_restraints_at_boundary() {
        let mut mol1 = structure::Molecule::new();
        mol1.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut mol2 = structure::Molecule::new();
        mol2.0.push(create_test_atom("CA", 10, 6.99, 0.0, 0.0)); // Just under 7.0A

        let restraints = create_restraints(&mol1, &mol2);

        assert_eq!(restraints.len(), 1);
    }

    #[test]
    fn test_create_restraints_beyond_distance() {
        let mut mol1 = structure::Molecule::new();
        mol1.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));

        let mut mol2 = structure::Molecule::new();
        mol2.0.push(create_test_atom("CA", 10, 10.0, 0.0, 0.0)); // Beyond 7.0A

        let restraints = create_restraints(&mol1, &mol2);

        assert_eq!(restraints.len(), 0);
    }

    #[test]
    fn test_create_restraints_filters_non_ca() {
        let mut mol1 = structure::Molecule::new();
        mol1.0.push(create_test_atom("CA", 1, 0.0, 0.0, 0.0));
        mol1.0.push(create_test_atom("CB", 1, 0.0, 0.0, 0.0)); // Non-CA
        mol1.0.push(create_test_atom("N", 1, 0.0, 0.0, 0.0)); // Non-CA

        let mut mol2 = structure::Molecule::new();
        mol2.0.push(create_test_atom("CA", 10, 5.0, 0.0, 0.0));
        mol2.0.push(create_test_atom("CB", 10, 5.0, 0.0, 0.0)); // Non-CA

        let restraints = create_restraints(&mol1, &mol2);

        // Should only create 1 restraint (CA-CA pair)
        assert_eq!(restraints.len(), 1);
        assert_eq!(restraints[0].0.name.trim(), "CA");
        assert_eq!(restraints[0].1.name.trim(), "CA");
    }

    #[test]
    fn test_create_restraints_empty_molecules() {
        let mol1 = structure::Molecule::new();
        let mol2 = structure::Molecule::new();

        let restraints = create_restraints(&mol1, &mol2);

        assert_eq!(restraints.len(), 0);
    }

    #[test]
    fn test_parse_tbl_active_active_pairs() {
        let tbl = "\
! comment line
assign (resid 10 and segid A) (resid 20 and segid B) 2.0 2.0 0.0
assign (resid 20 and segid B) (resid 10 and segid A) 2.0 2.0 0.0
assign (resid 11 and segid A) (resid 20 and segid B) or (resid 99 and segid B) 2.0 2.0 0.0
";
        // 99 is never an anchor, so it is passive and dropped.
        assert_eq!(parse_tbl(tbl).unwrap(), vec![(10, 20), (11, 20)]);
    }

    #[test]
    fn test_parse_tbl_needs_two_chains() {
        assert!(parse_tbl("assign (resid 1 and segid A) 2.0 2.0 0.0").is_err());
    }

    #[test]
    fn test_parse_tbl_accepts_haddock_forms() {
        // Upper case keywords, `resi`, swapped order, nested parentheses and a trailing comment.
        let tbl = "\
ASSIGN ((segid A and RESI 5)) ((SEGID B AND resid 7)
   or (resid 8 and segid B)) 2.0 2.0 0.0 ! comment (resid 99 and segid A)
Assign ((resid 7 and segid B)) ((segid A and resid 5)) 2.0 2.0 0.0
assign ((resid 8 and segid B)) ((resid 5 and segid A)) 2.0 2.0 0.0
";
        assert_eq!(parse_tbl(tbl).unwrap(), vec![(5, 7), (5, 8)]);
    }

    #[test]
    fn test_parse_tbl_ignores_words_that_only_contain_assign() {
        // "reassign" and "assigned" are not the keyword, so there is no block.
        assert!(
            parse_tbl("reassign (resid 1 and segid A) assigned (resid 1 and segid B)").is_err()
        );
    }
}
