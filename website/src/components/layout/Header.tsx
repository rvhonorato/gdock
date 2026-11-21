import { useState } from 'react'
import { DarkModeToggle } from '../ui/DarkModeToggle'

const navLinks = [
  { href: '#gdock', label: 'Try it' },
  { href: '#installation', label: 'Installation' },
  { href: '#algorithm', label: 'Algorithm' },
  { href: '#performance', label: 'Benchmark' },
  { href: '#cli', label: 'Reference' },
  { href: '#citation', label: 'Citation' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center">
          <img src="/media/webp/logo-horizontal-color.webp" alt="gdock" width={205} height={96} className="h-7 w-auto dark:hidden" />
          <img src="/media/webp/logo-horizontal-white.webp" alt="gdock" width={205} height={96} className="h-7 w-auto hidden dark:block" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://codeberg.org/rvhonorato/gdock"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors"
            aria-label="Codeberg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.14 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 16.553a12 12 0 0 0 5.137-4.213z" />
            </svg>
          </a>
          <DarkModeToggle />
        </nav>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <DarkModeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-400"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 animate-[fadeIn_0.15s_ease]">
          <div className="px-6 py-4 space-y-3">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://codeberg.org/rvhonorato/gdock"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-600 hover:text-accent-500 dark:text-slate-400 dark:hover:text-accent-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.14 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 16.553a12 12 0 0 0 5.137-4.213z" />
              </svg>
              Codeberg
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}
