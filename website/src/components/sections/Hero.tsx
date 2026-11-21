export function Hero() {
  return (
    <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <img
          src="/media/webp/logo-vertical-color.webp"
          alt="gdock"
          width={664}
          height={640}
          className="h-64 md:h-80 w-auto mx-auto mb-6 dark:hidden"
        />
        <img
          src="/media/webp/logo-vertical-white.webp"
          alt="gdock"
          width={664}
          height={640}
          className="h-64 md:h-80 w-auto mx-auto mb-6 hidden dark:block"
        />
        <h1 className="text-lg text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          <span className="sr-only">gdock: </span>
          Information-driven protein-protein docking using a genetic algorithm
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          Free, open-source docking software for protein complexes. Use interface
          residues as ambiguous restraints, as in HADDOCK.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <a
            href="#gdock"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
              bg-accent-500 hover:bg-accent-600 text-white font-medium text-sm
              transition-all shadow-sm hover:shadow-md hover:scale-[1.02]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submit a job
          </a>
          <a
            href="#installation"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
              border border-slate-300 dark:border-slate-600
              text-slate-700 dark:text-slate-300 font-medium text-sm
              hover:bg-slate-100 dark:hover:bg-slate-800
              transition-all hover:scale-[1.02]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <a
            href="https://codeberg.org/rvhonorato/gdock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              border border-slate-200 dark:border-slate-700
              text-slate-600 dark:text-slate-400
              hover:border-accent-400 hover:text-accent-500 dark:hover:text-accent-400
              transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.14 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 16.553a12 12 0 0 0 5.137-4.213z" />
            </svg>
            Codeberg
          </a>
          <a
            href="/gdock_paper_submitted.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              border border-slate-200 dark:border-slate-700
              text-slate-600 dark:text-slate-400
              hover:border-accent-400 hover:text-accent-500 dark:hover:text-accent-400
              transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Preprint
          </a>
        </div>
      </div>
    </section>
  )
}
