const benchmarkStats = [
  { value: '95.9%', label: 'Success rate', description: 'DockQ ≥ 0.23 (acceptable quality)' },
  { value: '55.7%', label: 'Medium quality', description: 'DockQ ≥ 0.49' },
  { value: '3.7%', label: 'High quality', description: 'DockQ ≥ 0.80' },
]

const timingStats = [
  { value: '~15s', label: 'Median runtime' },
  { value: '56%', label: 'Within 20 seconds' },
  { value: '<2min', label: '95th percentile' },
]

const dockqLegend = [
  { label: 'Incorrect (< 0.23)', light: '#cccccc', dark: '#6b7280' },
  { label: 'Acceptable (0.23 – 0.49)', light: '#c7e9c0', dark: '#4ade80' },
  { label: 'Medium (0.49 – 0.80)', light: '#74c476', dark: '#22c55e' },
  { label: 'High (≥ 0.80)', light: '#238b45', dark: '#16a34a' },
]

export function Performance() {
  return (
    <section id="performance" className="py-20 bg-slate-50 dark:bg-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-heading font-semibold text-slate-900 dark:text-slate-100 text-center mb-4">
          Benchmark
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Benchmarked on the Protein-Protein Docking Benchmark v5, gdock achieves
          high success rates with minimal computational cost.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12 max-w-2xl mx-auto">
          {benchmarkStats.map(stat => (
            <div
              key={stat.label}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center"
            >
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Plots */}
        <div className="space-y-8 max-w-2xl mx-auto mb-12">
          <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <img
              src="/images/plot_dockq_categories.svg"
              alt="DockQ quality categories distribution across benchmark"
              width={432}
              height={360}
              loading="lazy"
              className="w-full h-auto"
            />
          </div>
          <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <img
              src="/images/plot_timing_histogram.svg"
              alt="Histogram of docking runtime across benchmark"
              width={576}
              height={360}
              loading="lazy"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Timing + DockQ side by side */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Timing */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8">
            <h3 className="text-base font-heading font-semibold text-slate-900 dark:text-slate-100 mb-6 text-center">
              Runtime Performance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {timingStats.map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
              Tested on standard computational hardware. Actual performance may vary based on protein size and complexity.
            </p>
          </div>

          {/* DockQ explanation */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8">
            <h3 className="text-base font-heading font-semibold text-slate-900 dark:text-slate-100 mb-3">
              About DockQ
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              DockQ is a continuous quality measure for protein docking models, combining interface RMSD,
              ligand RMSD, and fraction of native contacts into a single score between 0 and 1.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {dockqLegend.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 dark:hidden"
                    style={{ backgroundColor: item.light }}
                  />
                  <span
                    className="w-3 h-3 rounded-full shrink-0 hidden dark:block"
                    style={{ backgroundColor: item.dark }}
                  />
                  <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
