import { useEffect, useRef, useState } from "react";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import type { PluginContext } from "molstar/lib/mol-plugin/context";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { Color } from "molstar/lib/mol-util/color";
import { StructureElement, Structure, Unit } from "molstar/lib/mol-model/structure";
import { OrderedSet } from "molstar/lib/mol-data/int";
import "molstar/build/viewer/molstar.css";

interface Props {
  receptorPdb: string | null;
  ligandPdb: string | null;
  height?: number;
  restraintPairs?: [number, number][];
}

// // Orange for receptor restraints, cyan for ligand restraints
// const RECEPTOR_RESTRAINT_COLOR = Color(0xFF8800);
// const LIGAND_RESTRAINT_COLOR = Color(0x00CCFF);

async function highlightRestraints(
  plugin: PluginContext,
  recResidues: number[],
  ligResidues: number[],
) {
  const { structures } = plugin.managers.structure.hierarchy.current;

  const tasks = [
    { idx: 0, residues: recResidues },
    { idx: 1, residues: ligResidues },
  ];

  for (const { idx, residues } of tasks) {
    if (!structures[idx] || residues.length === 0) continue;

    // Select atoms belonging to the restraint residue numbers
    const expression = MS.struct.generator.atomGroups({
      "residue-test": MS.core.set.has([
        MS.set(...residues),
        MS.ammp("auth_seq_id"),
      ]),
    });

    const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
      structures[idx].cell,
      expression,
      `restraint-${idx}`,
      { label: "Restraints" },
    );

    if (!comp) continue; // no atoms matched (empty selection)

    await plugin.builders.structure.representation.addRepresentation(comp, {
      type: "ball-and-stick",
      typeParams: { sizeFactor: 0.12, sizeAspectRatio: 1 },
      // color: "uniform",
    });
  }
}

// Find the Cα atom loci for a given residue number within a structure
// The measurement manager has no public type for this call.
interface DistanceMeasurement {
  addDistance(a: StructureElement.Loci, b: StructureElement.Loci, params: unknown): Promise<unknown>;
}

function getCaLoci(structure: Structure, resno: number): StructureElement.Loci | null {
  for (const unit of structure.units) {
    if (!Unit.isAtomic(unit)) continue;
    const { elements } = unit;
    const { residueAtomSegments, residues, atoms } = unit.model.atomicHierarchy;
    for (let i = 0; i < elements.length; i++) {
      const eIdx = elements[i];
      const rIdx = residueAtomSegments.index[eIdx];
      if (residues.auth_seq_id.value(rIdx) === resno && atoms.label_atom_id.value(eIdx) === "CA") {
        return StructureElement.Loci(structure, [{ unit, indices: OrderedSet.ofSingleton(i as StructureElement.UnitIndex) }]);
      }
    }
  }
  return null;
}

async function addRestraintLines(
  plugin: PluginContext,
  pairs: [number, number][],
) {
  if (pairs.length === 0) return;
  const { structures } = plugin.managers.structure.hierarchy.current;
  if (structures.length < 2) return;

  const recStruc = structures[0].cell.obj?.data as Structure | undefined;
  const ligStruc = structures[1].cell.obj?.data as Structure | undefined;
  if (!recStruc || !ligStruc) return;

  for (const [recRes, ligRes] of pairs) {
    const a = getCaLoci(recStruc, recRes);
    const b = getCaLoci(ligStruc, ligRes);
    if (!a || !b) continue;
    await (plugin.managers.structure.measurement as unknown as DistanceMeasurement).addDistance(a, b, {
      visualParams: {
        visuals: ["lines"],
        linesColor: Color(0xFF3366),
        linesSize: 0.06,
        dashLength: 0.4,
      },
    });
  }
}

export function MolstarViewer({ receptorPdb, ligandPdb, height = 480, restraintPairs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<PluginContext | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  // Only initialise the plugin once the container scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialise plugin once visible
  useEffect(() => {
    if (!visible || !containerRef.current) return;
    let cancelled = false;

    async function init() {
      const plugin = await createPluginUI({
        target: containerRef.current!,
        render: renderReact18,
        spec: {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              regionState: {
                left: "hidden",
                top: "hidden",
                right: "hidden",
                bottom: "hidden",
              },
            },
          },
          components: { remoteState: "none" },
        },
      });

      if (!cancelled) {
        pluginRef.current = plugin;
        setReady(true);
      } else {
        plugin.dispose();
      }
    }

    init();

    return () => {
      cancelled = true;
      pluginRef.current?.dispose();
      pluginRef.current = null;
    };
  }, [visible]);

  // Reload structures whenever PDB strings or plugin readiness change
  useEffect(() => {
    const plugin = pluginRef.current;
    if (!ready || !plugin) return;
    if (!receptorPdb && !ligandPdb) return;

    // Capture restraint data at effect time (they don't change after docking)
    const pairs = restraintPairs ?? [];
    const recResidues = pairs.map(p => p[0]);
    const ligResidues = pairs.map(p => p[1]);

    async function load() {
      await plugin!.clear();

      if (receptorPdb) {
        const data = await plugin!.builders.data.rawData({ data: receptorPdb, label: "Receptor" });
        const traj = await plugin!.builders.structure.parseTrajectory(data, "pdb");
        await plugin!.builders.structure.hierarchy.applyPreset(traj, "default");
      }

      if (ligandPdb) {
        const data = await plugin!.builders.data.rawData({ data: ligandPdb, label: "Ligand" });
        const traj = await plugin!.builders.structure.parseTrajectory(data, "pdb");
        await plugin!.builders.structure.hierarchy.applyPreset(traj, "default");
      }

      if (recResidues.length > 0 || ligResidues.length > 0) {
        await highlightRestraints(plugin!, recResidues, ligResidues);
      }

      if (pairs.length > 0) {
        await addRestraintLines(plugin!, pairs);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, receptorPdb, ligandPdb]); // restraintPairs intentionally omitted — fixed at load time

  return (
    <div
      ref={containerRef}
      className="w-full rounded overflow-hidden border border-slate-200 dark:border-slate-700"
      style={{ height: `${height}px`, position: "relative" }}
    />
  );
}
