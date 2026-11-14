export function Footer() {
  return (
    <footer className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <img src="/media/webp/logo-horizontal-grayscale.webp" alt="gdock" width={205} height={96} loading="lazy" className="h-8 w-auto dark:hidden" />
              <img src="/media/webp/logo-horizontal-white.webp" alt="gdock" width={205} height={96} loading="lazy" className="h-8 w-auto hidden dark:block opacity-80" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Information-driven protein-protein docking using a genetic algorithm.
            </p>
            <a
              href="#gdock"
              className="inline-flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-600 dark:hover:text-accent-400 transition-colors font-medium"
            >
              Try it in the browser →
            </a>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://codeberg.org/rvhonorato/gdock" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors">
                  Codeberg Repository
                </a>
              </li>
              <li>
                <a href="https://codeberg.org/rvhonorato/gdock-benchmark" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors">
                  Benchmark Data
                </a>
              </li>
              <li>
                <a href="/gdock_paper_submitted.pdf" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors">
                  Preprint (JOSS)
                </a>
              </li>
              <li>
                <a href="https://codeberg.org/rvhonorato/gdock/issues" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors">
                  Report Issues
                </a>
              </li>
            </ul>
          </div>
          <div id="citation">
            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Citation</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Vargas Honorato, R. <em>gdock: Information-Driven Protein-Protein Docking Using a Genetic Algorithm.</em> Zenodo, 2026.
            </p>
            <a
              href="https://doi.org/10.5281/zenodo.18863557"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent-500 hover:text-accent-600 dark:hover:text-accent-400 transition-colors font-mono"
            >
              10.5281/zenodo.18863557
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
          <p>© 2026 Rodrigo V. Honorato · Software released under 0BSD License</p>
        </div>
      </div>
    </footer>
  )
}
