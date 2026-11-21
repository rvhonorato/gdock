import { useState } from "react";
import { type JobMode } from "./gdock/utils";
import { ScoreJob } from "./gdock/ScoreJob";
import { DockJob } from "./gdock/DockJob";
import { CapriJob } from "./gdock/CapriJob";

const tabs: { id: JobMode; label: string; available: boolean }[] = [
  { id: "dock", label: "Dock", available: true },
  { id: "score", label: "Score", available: true },
  { id: "capri", label: "CAPRI", available: true },
];

export function Gdock() {
  const [mode, setMode] = useState<JobMode>("dock");

  return (
    <section id="gdock" className="py-16 border-y border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Dock proteins in your browser
          </h2>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Runs entirely in your browser
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
              No data sent to any server
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download results before leaving
            </span>
          </div>
        </div>

        {/* Job type tabs */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.available && setMode(tab.id)}
                disabled={!tab.available}
                className={`
                relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${mode === tab.id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }
                ${!tab.available ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              `}
              >
                {tab.label}
                {!tab.available && (
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {mode === "score" && <ScoreJob />}
        {mode === "capri" && <CapriJob />}
        {mode === "dock" && <DockJob />}

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>
            Vargas Honorato, R. <em>gdock: Information-Driven Protein-Protein Docking Using a Genetic Algorithm.</em> Zenodo, 2026.{' '}
            <a
              href="https://doi.org/10.5281/zenodo.18863557"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-accent-500 transition-colors"
            >
              doi:10.5281/zenodo.18863557
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
