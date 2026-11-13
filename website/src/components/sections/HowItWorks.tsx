import { Math } from '../ui/Math'

const algorithmDetails = [
  { label: 'Population size', value: '150' },
  { label: 'Elitism', value: 'Top 5 preserved' },
  { label: 'Selection', value: 'Tournament' },
  { label: 'Crossover', value: 'Uniform' },
  { label: 'Mutation', value: 'Creep mutation' },
  { label: 'Early stopping', value: '10 generations without improvement' },
]

const energyTerms = [
  {
    term: 'E_{vdw}',
    weight: 'w = 0.4',
    formula: String.raw`E_{vdw} = \varepsilon_{ij} \left[ \left(\frac{r_{min}^6}{r_{eff}^6}\right)^2 - 2\left(\frac{r_{min}^6}{r_{eff}^6}\right) \right]`,
    formulaNote: String.raw`r_{eff}^6 = r^6 + \alpha \cdot r_{min}^6`,
    description: 'Soft-core Lennard-Jones. Remains finite at r→0, allowing exploration of near-native poses with minor clashes.',
  },
  {
    term: 'E_{elec}',
    weight: 'w = 0.05',
    formula: String.raw`E_{elec} = \frac{332.0 \cdot q_1 \cdot q_2}{r^2}`,
    formulaNote: null,
    description: 'Coulombic electrostatics with distance-dependent dielectric (ε = r) to dampen long-range interactions.',
  },
  {
    term: 'E_{desolv}',
    weight: 'w = 3.4',
    formula: String.raw`E_{desolv} = -\sum_{i} ASP_i \cdot burial_i \cdot 4\pi r_i^2`,
    formulaNote: null,
    description: 'Empirical atomic solvation parameters penalize burial of polar atoms (N, O) and reward burial of hydrophobic atoms (C, S).',
  },
  {
    term: 'E_{air}',
    weight: 'w = 1.0',
    formula: String.raw`E_{air} = k \cdot (d - 7)^2 \quad \text{if } d > 7\text{Å}`,
    formulaNote: null,
    description: 'Flat-bottom harmonic on Cα–Cα distances. No penalty within 0–7Å; quadratic penalty beyond. HADDOCK-inspired.',
  },
]

export function HowItWorks() {
  return (
    <section id="algorithm" className="py-20 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-heading font-semibold text-slate-900 dark:text-slate-100 text-center mb-4">
          Algorithm
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          gdock uses a genetic algorithm to optimize rigid-body protein-protein docking,
          guided by a physics-based scoring function and optional experimental restraints.
        </p>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Genetic Algorithm */}
          <div className="min-w-0">
            <h3 className="text-lg font-heading font-medium text-slate-900 dark:text-slate-100 mb-4">
              Genetic Algorithm
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Each candidate pose is encoded as a chromosome with 6 genes:
              three Euler angles (α, β, γ) for rotation and three translations (x, y, z)
              for positioning the ligand relative to the receptor.
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <tbody>
                  {algorithmDetails.map((item, i) => (
                    <tr key={item.label} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-700/50' : ''}>
                      <td className="px-3 sm:px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-1/3">
                        {item.label}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-slate-600 dark:text-slate-400 text-right">
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Energy Function */}
          <div className="min-w-0">
            <h3 className="text-lg font-heading font-medium text-slate-900 dark:text-slate-100 mb-4">
              Energy Function
            </h3>
            <div className="mb-6 p-4 bg-slate-900 dark:bg-slate-950 dark:border dark:border-slate-700 rounded-lg text-slate-100 overflow-x-auto">
              <Math display>{String.raw`E_{total} = w_{vdw} E_{vdw} + w_{elec} E_{elec} + w_{desolv} E_{desolv} + w_{air} E_{air}`}</Math>
            </div>
            <div className="space-y-4">
              {energyTerms.map(term => (
                <div key={term.term} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{term.weight}</span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 mb-2 overflow-x-auto">
                    <Math>{term.formula}</Math>
                    {term.formulaNote && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        where <Math>{term.formulaNote}</Math>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    {term.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
