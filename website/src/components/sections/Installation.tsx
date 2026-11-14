import { CodeBlock } from '../ui/CodeBlock'

const steps = [
  {
    number: 1,
    title: 'Install via Cargo',
    description: 'Install directly from crates.io. Requires Rust 1.85 or later.',
    code: `cargo install gdock`,
    note: (
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Don't have Rust?{' '}
        <a
          href="https://www.rust-lang.org/tools/install"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-500 hover:underline"
        >
          Install it here
        </a>{' '}
        — takes about a minute.
      </p>
    ),
  },
  {
    number: 2,
    title: 'Prepare your input',
    description: 'You need two PDB files (receptor and ligand) and residue restraints indicating which residues should be in contact.',
    code: `# Download and split a complex from the PDB
curl -sL https://files.rcsb.org/download/2OOB.pdb -o 2OOB.pdb
awk '/^ATOM/ && substr($0,22,1)=="A"' 2OOB.pdb > 2oob_A.pdb
awk '/^ATOM/ && substr($0,22,1)=="B"' 2OOB.pdb > 2oob_B.pdb

# Restraints format: receptor_resid:ligand_resid pairs
# Example: 933:6,936:8,940:42,941:44,946:45,950:46`,
    note: null,
  },
  {
    number: 3,
    title: 'Run docking',
    description: 'Execute gdock with your structures and restraints. Most runs complete in ~15 seconds.',
    code: `gdock run \\
  --receptor 2oob_A.pdb \\
  --ligand 2oob_B.pdb \\
  --restraints 933:6,936:8,940:42,941:44,946:45,950:46`,
    note: null,
  },
  {
    number: 4,
    title: 'Analyze results',
    description: 'gdock outputs cluster representatives, top-ranked models, and a metrics file with scores.',
    code: `# Output files
results/model_*.pdb    # Cluster representatives
results/ranked_*.pdb   # Top 5 models by score
results/metrics.tsv    # Scores and DockQ values

# View metrics
cat results/metrics.tsv`,
    note: null,
  },
]

export function Installation() {
  return (
    <section id="installation" className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-heading font-semibold text-slate-900 dark:text-slate-100 text-center mb-4">
          Installation
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Install gdock via <code className="text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">cargo install</code> or build from source. Requires Rust 1.85 or later.
        </p>

        <div className="space-y-0">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex gap-4">
              {/* Connector line + number */}
              <div className="flex flex-col items-center">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center text-sm font-medium z-10">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1 mt-1">
                  {step.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                  {step.description}
                </p>
                <CodeBlock code={step.code} language="bash" />
                {step.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
