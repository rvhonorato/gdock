import { useMemo, useRef, useState } from "react";
import { zipSync, strToU8, gzipSync, gunzipSync } from "fflate";
import { runDocking, type DockingOutput } from "../../../hooks/useGdockWasm";
import { DockResultCard } from "../../DockResultCard";
import { Th } from "./Th";
import { readFileAsArrayBufferChunked } from "./utils";

function parsePdbResidues(pdb: string): number[] {
  const seen = new Set<number>();
  for (const line of pdb.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    const resno = parseInt(line.slice(22, 26).trim(), 10);
    if (!isNaN(resno)) seen.add(resno);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

type DockState = 'idle' | 'running' | 'done' | 'error';

export function DockJob() {
  const [receptorText, setReceptorText] = useState<string | null>(null);
  const [receptorName, setReceptorName] = useState<string | null>(null);
  const [ligandText, setLigandText] = useState<string | null>(null);
  const [ligandName, setLigandName] = useState<string | null>(null);
  const [pairs, setPairs] = useState<[number, number][]>([]);
  const [selectedRec, setSelectedRec] = useState<number | ''>('');
  const [selectedLig, setSelectedLig] = useState<number | ''>('');

  const recResidueList = useMemo(() => receptorText ? parsePdbResidues(receptorText) : [], [receptorText]);
  const ligResidueList = useMemo(() => ligandText ? parsePdbResidues(ligandText) : [], [ligandText]);

  const [state, setState] = useState<DockState>('idle');
  const [result, setResult] = useState<DockingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(['m-1']));

  const abortRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  async function handleFileChange(
    file: File | null,
    setText: (v: string | null) => void,
    setName: (v: string | null) => void,
  ) {
    if (!file) { setText(null); setName(null); return; }
    setName(file.name);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
    setText(text);
  }

  function handleDownloadAll() {
    if (!result) return;

    const files: Record<string, Uint8Array> = {};

    for (const pose of result.clusteredPoses) {
      const complex = [receptorText, pose.ligandPdb].filter(Boolean).join('\n');
      files[`model_${pose.rank}.pdb`] = strToU8(complex);
    }

    for (const pose of result.rankedPoses) {
      const complex = [receptorText, pose.ligandPdb].filter(Boolean).join('\n');
      files[`ranked_${pose.rank}.pdb`] = strToU8(complex);
    }

    const header = 'file\trank\tfitness\tvdw\telec\tdesolv\tair\tcluster_size';
    const clusterRows = result.clusteredPoses.map(p =>
      `model_${p.rank}.pdb\t${p.rank}\t${p.fitness.toFixed(4)}\t${p.vdw.toFixed(4)}\t${p.elec.toFixed(4)}\t${p.desolv.toFixed(4)}\t${p.air.toFixed(4)}\t${p.clusterSize}`
    );
    const rankedRows = result.rankedPoses.map(p =>
      `ranked_${p.rank}.pdb\t${p.rank}\t${p.fitness.toFixed(4)}\t${p.vdw.toFixed(4)}\t${p.elec.toFixed(4)}\t${p.desolv.toFixed(4)}\t${p.air.toFixed(4)}\t-`
    );
    files['metrics.tsv'] = strToU8([header, ...clusterRows, ...rankedRows].join('\n'));

    const zip = zipSync(files);
    const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gdock_results.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setReceptorText(null);
    setReceptorName(null);
    setLigandText(null);
    setLigandName(null);
    setPairs([]);
    setSelectedRec('');
    setSelectedLig('');
    setResult(null);
    setError(null);
    setState('idle');
    setExpandedRows(new Set(['m-1']));
    document.getElementById('gdock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSaveJob() {
    if (!result || !receptorText) return;
    const payload = JSON.stringify({ version: 1, receptorPdb: receptorText, ligandPdb: ligandText, restraintPairs: pairs, result });
    const compressed = gzipSync(new TextEncoder().encode(payload));
    const blob = new Blob([compressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const seed = receptorText + (ligandText ?? '') + JSON.stringify(pairs);
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0;
    const hash = h.toString(16).padStart(8, '0');
    a.download = `gdock_${hash}.gdock`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportGdock(file: File) {
    try {
      const buffer = await readFileAsArrayBufferChunked(file);
      const decompressed = gunzipSync(new Uint8Array(buffer));
      const json = JSON.parse(new TextDecoder().decode(decompressed));
      if (json.version !== 1) {
        setError('Unsupported .gdock version.');
        setState('error');
        return;
      }
      if (json.type === 'capri') {
        setError('This .gdock file belongs to the CAPRI tab — load it there.');
        setState('error');
        return;
      }
      setReceptorText(json.receptorPdb ?? null);
      setReceptorName('restored-receptor.pdb');
      setLigandText(json.ligandPdb ?? null);
      setLigandName('restored-ligand.pdb');
      setPairs(json.restraintPairs ?? []);
      setResult(json.result ?? null);
      setExpandedRows(new Set(['m-1']));
      setState('done');
    } catch (e) {
      setError('Failed to load .gdock file: ' + String(e));
      setState('error');
    }
  }

  async function handleDock() {
    if (!receptorText || !ligandText) return;
    abortRef.current = false;
    setElapsed(0);
    setExpandedRows(new Set(['m-1']));
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
    setState('running');
    setError(null);
    setResult(null);
    try {
      const output = await runDocking(receptorText, ligandText, pairs);
      if (!abortRef.current) {
        setResult(output);
        setState('done');
      }
    } catch (e) {
      if (!abortRef.current) {
        setError(String(e));
        setState('error');
      }
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }

  function toggleRow(key: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const canDock = !!(receptorText && ligandText && pairs.length > 0) && state !== 'running';

  return (
    <div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Upload a receptor and ligand PDB, specify residue restraints, then
        run the genetic algorithm docking engine directly in your browser.
      </p>

      {/* File inputs */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
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

      {/* Restraints */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Restraints
          </label>
          {pairs.length > 0 && (
            <button
              onClick={() => setPairs([])}
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Selector row */}
        <div className="flex gap-2 mb-2">
          <select
            value={selectedRec}
            onChange={(e) => setSelectedRec(e.target.value ? Number(e.target.value) : '')}
            disabled={!receptorText}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:opacity-40"
          >
            <option value="">Receptor residue</option>
            {recResidueList.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={selectedLig}
            onChange={(e) => setSelectedLig(e.target.value ? Number(e.target.value) : '')}
            disabled={!ligandText}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:opacity-40"
          >
            <option value="">Ligand residue</option>
            {ligResidueList.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => {
              if (selectedRec === '' || selectedLig === '') return;
              if (pairs.some(([r, l]) => r === selectedRec && l === selectedLig)) return;
              setPairs((prev) => [...prev, [selectedRec as number, selectedLig as number]]);
              setSelectedRec('');
              setSelectedLig('');
            }}
            disabled={selectedRec === '' || selectedLig === ''}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Pair list */}
        {pairs.length > 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {pairs.map(([rec, lig], i) => (
              <div
                key={`${rec}-${lig}-${i}`}
                className={`flex items-center justify-center px-3 py-1.5 ${i % 2 === 0
                  ? 'bg-slate-50 dark:bg-slate-800/60'
                  : 'bg-white dark:bg-slate-900/40'
                  }`}
              >
                <span className="grid grid-cols-3 items-center text-sm font-mono w-32">
                  <span className="text-right text-orange-500">{rec}</span>
                  <span className="text-center text-slate-400 dark:text-slate-500">↔</span>
                  <span className="text-left text-cyan-500">{lig}</span>
                </span>
                <button
                  onClick={() => setPairs((prev) => prev.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-base leading-none ml-2"
                  aria-label="Remove pair"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No restraints — select a receptor and ligand residue above to add a pair.
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleDock}
        disabled={!canDock}
        className={`
          w-full py-2.5 rounded-xl text-sm font-semibold transition-colors mb-6
          ${canDock
            ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
          }
        `}
      >
        {state === 'running' ? 'Running…' : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v13" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 10h12" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20C9 20 6 18 6 15M12 20c3 0 6-2 6-5" />
              <circle cx="6" cy="10" r="1" fill="currentColor" strokeWidth={0} />
              <circle cx="18" cy="10" r="1" fill="currentColor" strokeWidth={0} />
            </svg>
            Dock
          </span>
        )}
      </button>

      {/* Restore a previous job */}
      {state === 'idle' && (
        <div className="flex items-center justify-center gap-1.5 mt-2 mb-4 text-xs text-slate-400 dark:text-slate-500">
          <span>or restore a previous job</span>
          <label className="cursor-pointer flex items-center gap-1 text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300 transition-colors">
            <input
              type="file"
              accept=".gdock"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportGdock(file);
                e.target.value = '';
              }}
            />
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            load .gdock file
          </label>
        </div>
      )}

      {/* Running state */}
      {state === 'running' && (
        <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-4">
          <svg className="w-4 h-4 animate-spin text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Running gdock</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">
            {(elapsed / 1000).toFixed(1)} s
          </span>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 ml-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            New job
          </button>
        </div>
      )}

      {/* Results */}
      {state === 'done' && result && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">Results</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Header */}
          <div className="mb-4 flex justify-center gap-4">
            <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.generationsRun}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">generations</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{(result.executionTimeMs / 1000).toFixed(1)} s</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">total runtime</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{Math.round(result.executionTimeMs / result.generationsRun)} ms</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">per generation</span>
            </div>
          </div>

          {/* Download all + Save job */}
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={handleDownloadAll}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium
              border border-emerald-500 dark:border-emerald-600
              text-emerald-600 dark:text-emerald-400
              hover:bg-emerald-50 dark:hover:bg-emerald-900/20
              transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Results
            </button>
            <button
              onClick={handleSaveJob}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium
              border border-slate-300 dark:border-slate-600
              text-slate-600 dark:text-slate-300
              hover:bg-slate-100 dark:hover:bg-slate-700
              transition-colors mb-4"
              title="Save a .gdock snapshot you can reload later"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 3v4a1 1 0 001 1h4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17h6M9 13h6" />
              </svg>
              Save job
            </button>
          </div>

          {/* Table info */}
          <div className="mb-3 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 text-center">
            <p>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200">model_N</span>
              {' '}: cluster representatives from the best solutions across all generations, grouped by structural similarity.
            </p>
            <p>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200">ranked_N</span>
              {' '}: top-scoring entries from all generations, ranked by fitness score alone regardless of structural diversity.
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
                Click a row to view the conformation
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                Pink lines indicate restraint pairs
              </span>
            </div>
          </div>

          {/* Metrics table */}
          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="w-6 px-2" />
                  <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">File</th>
                  <Th label="Fitness" tooltip="Overall score used to rank models. Lower is better. Weighted sum of all energy terms." />
                  <Th label="VDW" tooltip="Van der Waals energy. Measures steric complementarity between receptor and ligand." />
                  <Th label="Elec" tooltip="Electrostatic energy. Coulombic interactions with distance-dependent dielectric." />
                  <Th label="Desolv" tooltip="Desolvation energy. Penalty for burying polar atoms; reward for burying hydrophobic atoms." />
                  <Th label="AIR" tooltip="Ambiguous Interaction Restraints. Flat-bottom harmonic penalty when restrained residue pairs exceed 7 Å." />
                  <Th label="Cluster" tooltip="Number of structures in this cluster. Larger clusters indicate how frequently this conformation was found." />
                </tr>
              </thead>
              {[
                ...result.clusteredPoses.map(p => ({ p, key: `m-${p.rank}`, filename: `model_${p.rank}.pdb`, cluster: String(p.clusterSize), bg: 'bg-white dark:bg-slate-900/40', showClusterSize: true as const })),
                ...result.rankedPoses.map(p => ({ p, key: `r-${p.rank}`, filename: `ranked_${p.rank}.pdb`, cluster: '—', bg: 'bg-slate-50/50 dark:bg-slate-800/30', showClusterSize: false as const })),
              ].map(({ p, key, filename, cluster, bg, showClusterSize }) => {
                const isOpen = expandedRows.has(key);
                return (
                  <tbody key={key} className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr
                      className={`${bg} cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors`}
                      onClick={() => toggleRow(key)}
                    >
                      <td className="px-2 py-1.5 text-slate-400 dark:text-slate-500">
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{filename}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{p.fitness.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{p.vdw.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{p.elec.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{p.desolv.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{p.air.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-400 dark:text-slate-500">{cluster}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700">
                          <DockResultCard pose={p} receptorPdb={receptorText} restraintPairs={pairs} showClusterSize={showClusterSize} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>

          <button
            onClick={handleReset}
            className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            New job
          </button>
        </>
      )}
    </div>
  );
}
