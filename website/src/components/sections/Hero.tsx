export function Hero() {
  return (
    <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <img
          src="/media/svg/logo-vertical-color.svg"
          alt="gdock"
          className="h-64 md:h-80 mx-auto mb-6 dark:hidden"
        />
        <img
          src="/media/svg/logo-vertical-white.svg"
          alt="gdock"
          className="h-64 md:h-80 mx-auto mb-6 hidden dark:block"
        />
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          Information-driven protein-protein docking using a genetic algorithm
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
            href="https://github.com/rvhonorato/gdock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              border border-slate-200 dark:border-slate-700
              text-slate-600 dark:text-slate-400
              hover:border-accent-400 hover:text-accent-500 dark:hover:text-accent-400
              transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
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
