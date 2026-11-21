import { Tabs } from '../ui/Tabs'
import { CodeBlock } from '../ui/CodeBlock'

function RunCommand() {
  return (
    <div className="space-y-6">
      <p className="text-slate-600 dark:text-slate-400">
        Run the full genetic algorithm docking between a receptor and ligand.
      </p>
      <CodeBlock
        code={`gdock run [OPTIONS] --receptor <FILE> --ligand <FILE> --restraints <PAIRS>

Required:
  -r, --receptor <FILE>       Receptor PDB file (single chain)
  -l, --ligand <FILE>         Ligand PDB file (single chain)
  --restraints <PAIRS>        Residue pairs, e.g. 933:6,936:8,940:42

Options:
  -o, --output-dir <DIR>      Output directory (default: current)
  -n, --nproc <NUM>           Number of processors (default: total - 2)
  --reference <FILE>          Reference structure for DockQ calculation
  --no-clust                  Disable clustering
  --w_vdw <WEIGHT>            VDW energy weight
  --w_elec <WEIGHT>           Electrostatics weight
  --w_desolv <WEIGHT>         Desolvation weight
  --w_air <WEIGHT>            Restraints weight
  -h, --help                  Print help`}
        language="bash"
      />
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Example</h3>
        <CodeBlock
          code={`gdock run \\
  --receptor data/2oob_A.pdb \\
  --ligand data/2oob_B.pdb \\
  --restraints 933:6,936:8,940:42,941:44,946:45,950:46 \\
  --reference data/2oob.pdb \\
  --output-dir results/`}
          language="bash"
        />
      </div>
    </div>
  )
}

function ScoreCommand() {
  return (
    <div className="space-y-6">
      <p className="text-slate-600 dark:text-slate-400">
        Calculate energy components for a given receptor-ligand configuration without running the genetic algorithm.
      </p>
      <CodeBlock
        code={`gdock score --receptor <FILE> --ligand <FILE> --restraints <PAIRS>

Required:
  -r, --receptor <FILE>       Receptor PDB file
  -l, --ligand <FILE>         Ligand PDB file
  --restraints <PAIRS>        Residue pairs

Options:
  -h, --help                  Print help`}
        language="bash"
      />
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Example</h3>
        <CodeBlock
          code={`gdock score \\
  --receptor receptor.pdb \\
  --ligand ligand.pdb \\
  --restraints 933:6,936:8,940:42`}
          language="bash"
        />
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Output</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Returns the total energy score and individual contributions: VDW, electrostatics, desolvation, and AIR restraints.
        </p>
      </div>
    </div>
  )
}

function RestraintsCommand() {
  return (
    <div className="space-y-6">
      <p className="text-slate-600 dark:text-slate-400">
        Generate restraints from interface contacts in a native complex structure. Useful for benchmarking or when interface residues are known experimentally.
      </p>
      <CodeBlock
        code={`gdock restraints --receptor <FILE> --ligand <FILE> [OPTIONS]

Required:
  -r, --receptor <FILE>       Receptor PDB file (reference)
  -l, --ligand <FILE>         Ligand PDB file (reference)

Options:
  -c, --cutoff <DIST>         Distance cutoff in Angstroms (default: 5.0)
  -h, --help                  Print help`}
        language="bash"
      />
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Example</h3>
        <CodeBlock
          code={`gdock restraints \\
  --receptor receptor_ref.pdb \\
  --ligand ligand_ref.pdb \\
  --cutoff 5.0`}
          language="bash"
        />
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Restraint Format</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Output is a comma-separated list of residue pairs in <code className="bg-slate-100 dark:bg-slate-600 px-1 rounded">receptor:ligand</code> format:
        </p>
        <CodeBlock
          code={`933:6,936:8,940:42,941:44,946:45,950:46`}
          language="text"
        />
      </div>
    </div>
  )
}

const tabs = [
  { id: 'run', label: 'run', content: <RunCommand /> },
  { id: 'score', label: 'score', content: <ScoreCommand /> },
  { id: 'restraints', label: 'restraints', content: <RestraintsCommand /> },
]

export function CliReference() {
  return (
    <section id="cli" className="py-20 bg-slate-50 dark:bg-slate-800/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-heading font-semibold text-slate-900 dark:text-slate-100 text-center mb-4">
          CLI Reference
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          gdock provides three subcommands: <code className="text-sm bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">run</code> for docking, <code className="text-sm bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">score</code> for energy calculation, and <code className="text-sm bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">restraints</code> for generating restraints from a reference structure.
        </p>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <Tabs tabs={tabs} defaultTab="run" />
        </div>
      </div>
    </section>
  )
}
