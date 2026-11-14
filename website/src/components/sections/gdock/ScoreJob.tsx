import { useEffect, useState } from "react";
import { scoreStructures, type ScoreOutput } from "../../../hooks/useGdockWasm";
import { MolstarViewer } from "../../LazyMolstarViewer";
import { readFileAsTextChunked } from "./utils";

export function ScoreJob() {
  const [receptorText, setReceptorText] = useState<string | null>(null);
  const [receptorName, setReceptorName] = useState<string | null>(null);
  const [ligandText, setLigandText] = useState<string | null>(null);
  const [ligandName, setLigandName] = useState<string | null>(null);

  const [result, setResult] = useState<ScoreOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(
    file: File | null,
    setText: (v: string | null) => void,
    setName: (v: string | null) => void,
  ) {
    if (!file) { setText(null); setName(null); return; }
    setName(file.name);
    setText(await readFileAsTextChunked(file));
  }

  useEffect(() => {
    if (!receptorText || !ligandText) return;
    let cancelled = false;

    async function run() {
      setError(null);
      setResult(null);
      setLoading(true);
      try {
        const scores = await scoreStructures(receptorText!, ligandText!);
        if (!cancelled) setResult(scores);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [receptorText, ligandText]);

  const hasAnyStructure = !!(receptorText || ligandText);

  return (
    <div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Upload a receptor and ligand PDB to visualise the complex and compute
        VDW, electrostatic and desolvation energies instantly.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {(
          [
            { label: "Receptor", name: receptorName, setter: setReceptorText, nameSetter: setReceptorName },
            { label: "Ligand", name: ligandName, setter: setLigandText, nameSetter: setLigandName },
          ] as const
        ).map(({ label, name, setter, nameSetter }) => (
          <label
            key={label}
            className={`
              group relative flex flex-col items-center justify-center gap-2
              rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer
              transition-colors
              ${name
                ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10"
                : "border-slate-300 dark:border-slate-600 hover:border-accent-400 dark:hover:border-accent-400 bg-white dark:bg-slate-900/40"
              }
            `}
          >
            <input
              type="file"
              accept=".pdb"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) =>
                handleFileChange(e.target.files?.[0] ?? null, setter, nameSetter)
              }
            />

            {name ? (
              <>
                <svg className="w-5 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full px-2">{name}</span>
              </>
            ) : (
              <>
                <svg className="w-7 h-7 text-slate-400 group-hover:text-accent-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-accent-500 transition-colors">{label}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">.pdb file</span>
              </>
            )}
          </label>
        ))}
      </div>

      {hasAnyStructure && (
        <div className="mb-6">
          <MolstarViewer receptorPdb={receptorText} ligandPdb={ligandText} />
        </div>
      )}

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Scoring…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 pr-6 font-medium text-slate-500 dark:text-slate-400">Term</th>
                <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Energy (kcal/mol)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2 pr-6 text-slate-700 dark:text-slate-300">VDW</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{result.vdw.toFixed(4)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-slate-700 dark:text-slate-300">Electrostatic</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{result.elec.toFixed(4)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-slate-700 dark:text-slate-300">Desolvation</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{result.desolv.toFixed(4)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-slate-700 dark:text-slate-300">Clashes</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{result.clash.toFixed(4)}</td>
              </tr>
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
                <td className="py-2 pr-6 text-slate-900 dark:text-white">Total (weighted)</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{result.total.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Weights: VDW×0.4 · Elec×0.05 · Desolv×3.4 · Clash×1
          </p>
        </div>
      )}
    </div>
  );
}
