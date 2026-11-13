import pytest

import gdock

RECEPTOR_PDB = (
    "ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C\n"
    "ATOM      2  CA  ALA A   2       3.800   0.000   0.000  1.00  0.00           C\n"
    "END\n"
)

LIGAND_PDB = (
    "ATOM      1  CA  ALA B   1      10.000   0.000   0.000  1.00  0.00           C\n"
    "ATOM      2  CA  ALA B   2      13.800   0.000   0.000  1.00  0.00           C\n"
    "END\n"
)


def test_score():
    result = gdock.score(RECEPTOR_PDB, LIGAND_PDB)
    assert set(result.keys()) == {"vdw", "elec", "desolv", "clash", "total"}
    for value in result.values():
        assert isinstance(value, float)


def test_score_energy_weights():
    default = gdock.score(RECEPTOR_PDB, LIGAND_PDB)
    custom = gdock.score(
        RECEPTOR_PDB, LIGAND_PDB, w_vdw=0.0, w_elec=0.0, w_desolv=0.0, w_clash=0.0
    )
    assert custom["total"] == 0.0
    assert default["total"] != 0.0


def test_dock():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        restraints=[(1, 1)],
        max_generations=2,
        seed=1,
    )
    assert result["generationsRun"] >= 1
    assert isinstance(result["convergedEarly"], bool)
    assert len(result["models"]) > 0

    model = result["models"][0]
    assert model["rank"] == 1
    assert "pdb" in model
    assert "ATOM" in model["pdb"]


def test_dock_model_fields():
    result = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=2, seed=1)
    model = result["models"][0]
    for key in ("rank", "fitness", "vdw", "elec", "desolv", "air", "pdb"):
        assert key in model
    assert isinstance(model["rank"], int)
    for key in ("fitness", "vdw", "elec", "desolv", "air"):
        assert isinstance(model[key], float)
    assert isinstance(model["pdb"], str)


def test_dock_pdb_contains_both_chains():
    result = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=2, seed=1)
    pdb = result["models"][0]["pdb"]
    chains = {line[21] for line in pdb.splitlines() if line.startswith("ATOM")}
    assert "A" in chains
    assert "B" in chains


def test_dock_models_ranked_ascending():
    result = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=5, seed=1)
    models = result["models"]
    ranks = [m["rank"] for m in models]
    assert ranks == list(range(1, len(models) + 1))


def test_dock_energy_weights():
    weights = {
        "w_vdw": 1.0,
        "w_elec": 0.5,
        "w_desolv": 2.0,
        "w_air": 0.1,
        "w_clash": 3.0,
    }
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        restraints=[(933, 6), (936, 8)],
        max_generations=3,
        seed=1,
        **weights,
    )
    m = result["models"][0]
    expected = sum(w * m[name[2:]] for name, w in weights.items())
    assert m["fitness"] == pytest.approx(expected)

    default = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        restraints=[(933, 6), (936, 8)],
        max_generations=3,
        seed=1,
    )
    assert default["models"][0]["fitness"] != m["fitness"]


def test_dock_seed_reproducibility():
    r1 = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=3, seed=99)
    r2 = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=3, seed=99)
    assert r1["models"][0]["fitness"] == r2["models"][0]["fitness"]


def test_dock_different_seeds_differ():
    r1 = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=5, seed=1)
    r2 = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=5, seed=2)
    fitnesses1 = [m["fitness"] for m in r1["models"]]
    fitnesses2 = [m["fitness"] for m in r2["models"]]
    assert fitnesses1 != fitnesses2


def test_dock_population_size():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        max_generations=2,
        population_size=10,
        seed=1,
    )
    assert result["generationsRun"] >= 1
    assert len(result["models"]) > 0


def test_dock_sampling_returns_models_sorted_by_fitness():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        max_generations=5,
        seed=1,
        sampling=20,
    )
    models = result["models"]
    assert len(models) > 0
    fitnesses = [m["fitness"] for m in models]
    assert fitnesses == sorted(fitnesses)


def test_dock_sampling_respects_capacity():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        max_generations=3,
        seed=1,
        sampling=2,
    )
    assert len(result["models"]) <= 2


def test_dock_sampling_fills_capacity():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        max_generations=1,
        population_size=5,
        seed=1,
        sampling=5,
    )
    assert len(result["models"]) == 5


def test_dock_ncores_accepts_parameter():
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        max_generations=2,
        seed=1,
        ncores=2,
    )
    assert result["generationsRun"] >= 1
    assert len(result["models"]) > 0


def test_dock_ncores_results_match_single_core():
    kwargs = dict(
        receptor_pdb=RECEPTOR_PDB,
        ligand_pdb=LIGAND_PDB,
        max_generations=5,
        seed=42,
    )
    r1 = gdock.dock(**kwargs, ncores=1)
    r2 = gdock.dock(**kwargs, ncores=2)
    assert len(r1["models"]) == len(r2["models"])
    for m1, m2 in zip(r1["models"], r2["models"]):
        assert m1["fitness"] == m2["fitness"]


def test_dock_restraints_as_tbl_file(tmp_path):
    # Standard HADDOCK TBL: bidirectional assign blocks so both segids appear as anchors
    # (tbl_to_pairs requires active-active pairs — both residues must appear as anchors).
    tbl_file = tmp_path / "ambig.tbl"
    tbl_file.write_text(
        "assign (resid 1 and segid A) (resid 1 and segid B) 2.0 2.0 0.0\n"
        "assign (resid 1 and segid B) (resid 1 and segid A) 2.0 2.0 0.0\n"
    )
    result = gdock.dock(
        RECEPTOR_PDB,
        LIGAND_PDB,
        restraints=str(tbl_file),
        max_generations=2,
        seed=1,
    )
    assert result["generationsRun"] >= 1
    assert len(result["models"]) > 0


def test_dock_restraints_tbl_equals_pairs(tmp_path):
    # Bidirectional TBL with resid 1 A ↔ resid 1 B should produce the same pairs as [(1, 1)].
    tbl_file = tmp_path / "ambig.tbl"
    tbl_file.write_text(
        "assign (resid 1 and segid A) (resid 1 and segid B) 2.0 2.0 0.0\n"
        "assign (resid 1 and segid B) (resid 1 and segid A) 2.0 2.0 0.0\n"
    )
    r_pairs = gdock.dock(
        RECEPTOR_PDB, LIGAND_PDB, restraints=[(1, 1)], max_generations=2, seed=1
    )
    r_tbl = gdock.dock(
        RECEPTOR_PDB, LIGAND_PDB, restraints=str(tbl_file), max_generations=2, seed=1
    )
    assert r_pairs["models"][0]["fitness"] == r_tbl["models"][0]["fitness"]


def test_dock_invalid_pdb_raises():
    try:
        gdock.dock("not a pdb", LIGAND_PDB)
        assert False, "expected an error"
    except Exception:
        pass


def test_score_total_includes_clash():
    # The two CA atoms overlap, so the clash count is not zero.
    overlapping = LIGAND_PDB.replace("10.000", " 0.500").replace("13.800", " 4.300")
    with_clash = gdock.score(
        RECEPTOR_PDB, overlapping, w_vdw=0.0, w_elec=0.0, w_desolv=0.0
    )
    assert with_clash["clash"] > 0
    assert with_clash["total"] == with_clash["clash"]


def test_dock_missing_tbl_file_raises():
    try:
        gdock.dock(RECEPTOR_PDB, LIGAND_PDB, restraints="/no/such/file.tbl")
        assert False, "expected an error"
    except ValueError:
        pass


def test_dock_clustered_models():
    result = gdock.dock(RECEPTOR_PDB, LIGAND_PDB, max_generations=2, seed=1)
    assert len(result["clusteredModels"]) > 0
    for model in result["clusteredModels"]:
        assert model["clusterSize"] >= 1
        assert "ATOM" in model["pdb"]


def test_dock_sampling_has_no_clustered_models():
    result = gdock.dock(
        RECEPTOR_PDB, LIGAND_PDB, max_generations=2, seed=1, sampling=20
    )
    assert result["clusteredModels"] == []


def test_generate_restraints_modes():
    # The chains are in contact in this pose.
    close = LIGAND_PDB.replace("10.000", " 7.000").replace("13.800", "10.800")
    ambig = gdock.generate_restraints(RECEPTOR_PDB, close, cutoff=5.0)
    unambig = gdock.generate_restraints(RECEPTOR_PDB, close, cutoff=5.0, mode="unambig")
    assert ambig == [(2, 1)]
    assert unambig == [(2, 1)]
    assert gdock.generate_restraints(RECEPTOR_PDB, LIGAND_PDB, cutoff=5.0) == []


def test_generate_restraints_invalid_mode_raises():
    try:
        gdock.generate_restraints(RECEPTOR_PDB, LIGAND_PDB, mode="nope")
        assert False, "expected an error"
    except ValueError:
        pass


def test_tbl_to_pairs():
    tbl = (
        "assign (resid 1 and segid A) (resid 1 and segid B) 2.0 2.0 0.0\n"
        "assign (resid 1 and segid B) (resid 1 and segid A) 2.0 2.0 0.0\n"
    )
    assert gdock.tbl_to_pairs(tbl) == [(1, 1)]


def test_contacts_and_cluster_contacts():
    close = LIGAND_PDB.replace("10.000", " 7.000").replace("13.800", "10.800")
    found = gdock.contacts(RECEPTOR_PDB, close)
    assert len(found) > 0
    assert gdock.contacts(RECEPTOR_PDB, LIGAND_PDB) == []

    clusters = gdock.cluster_contacts([found, found, ["A 9 B 9"]], min_cluster_size=2)
    assert len(clusters) == 1
    assert clusters[0]["members"] == [0, 1]
    assert clusters[0]["size"] == 2
