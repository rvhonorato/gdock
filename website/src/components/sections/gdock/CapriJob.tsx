import { useRef, useState } from "react";
import { zipSync, strToU8, gzip, gunzipSync } from "fflate";
import { scoreStructures, computeContacts, clusterFromContacts } from "../../../hooks/useGdockWasm";
import { MolstarViewer } from "../../LazyMolstarViewer";
import { readFileAsTextChunked, readFileAsArrayBufferChunked, processLargeFileInChunks } from "./utils";
import { Th } from "./Th";
import {
  type ChainRole,
  type CapriPhase,
  type ScoredCluster,
  parseMd5Map,
  splitModels,
  detectChains,
  extractAndRename,
  extractOriginal,
} from "./capriUtils";

export function CapriJob() {
  const [ensembleText, setEnsembleText] = useState<string | null>(null);
  const [ensembleName, setEnsembleName] = useState<string | null>(null);
  const [chains, setChains] = useState<string[]>([]);
  const [chainRoles, setChainRoles] = useState<Record<string, ChainRole>>({});
  const [fccCutoff, setFccCutoff] = useState(0.60);
  const [minClusterSize, setMinClusterSize] = useState(4);
  const [phase, setPhase] = useState<CapriPhase>('idle');
  const [results, setResults] = useState<ScoredCluster[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [error, setError] = useState<string | null>(null);
  const [parsedModels, setParsedModels] = useState<{ modelId: number; lines: string[] }[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<'rank' | 'size' | 'model' | 'fitness' | 'vdw' | 'elec' | 'desolv' | null>('size');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [saving, setSaving] = useState(false);
  const [subForm, setSubForm] = useState<{ round: string; target: string; groupName: string; authors: string; notes: string; chainMolecules: Record<string, string> }>({ round: '', target: '', groupName: '', authors: '', notes: '', chainMolecules: {} });
  const [parsing, setParsing] = useState(false);
  const abortRef = useRef(false);

  function toggleSelect(i: number) {
    setSelectedIndices(prev => {
      const s = new Set(prev);
      if (s.has(i)) { s.delete(i); return s; }
      if (s.size >= 10) return prev;
      s.add(i);
      return s;
    });
  }

  const receptorChains = Object.entries(chainRoles).filter(([, r]) => r === 'receptor').map(([c]) => c);
  const ligandChains = Object.entries(chainRoles).filter(([, r]) => r === 'ligand').map(([c]) => c);

  function buildSubmissionPdb() {
    const allChains = [...receptorChains, ...ligandChains];
    const ordered = [...selectedIndices]
      .map(i => results[i])
      .sort((a, b) => a.rank - b.rank);

    const lines: string[] = [];

    // HEADER
    const round = subForm.round || '??';
    const target = subForm.target || '???';
    const group = subForm.groupName || 'gdock';
    lines.push(`HEADER     CAPRI ROUND ${round} TARGET ${target} : CAPRI HUMAN ${group}`);

    // AUTHOR — split by comma, pack into AUTHOR records (max 70 chars/line)
    const authorList = subForm.authors.split(',').map(a => a.trim()).filter(Boolean);
    if (authorList.length > 0) {
      const MAX_CONTENT = 59;
      let remaining = authorList.join(', ');
      let contNum = 1;
      while (remaining.length > 0) {
        let chunk: string;
        if (remaining.length <= MAX_CONTENT) {
          chunk = remaining;
          remaining = '';
        } else {
          const cutAt = remaining.lastIndexOf(',', MAX_CONTENT);
          if (cutAt <= 0) {
            chunk = remaining.slice(0, MAX_CONTENT);
            remaining = remaining.slice(MAX_CONTENT).replace(/^,?\s*/, '');
          } else {
            chunk = remaining.slice(0, cutAt);
            remaining = remaining.slice(cutAt + 1).trimStart();
          }
        }
        lines.push(`AUTHOR  ${String(contNum).padStart(2)} ${chunk}`);
        contNum++;
      }
    }

    // REMARK 1 — method (fixed)
    lines.push('REMARK   1');
    lines.push('REMARK   1 Models scored with gdock v2.0.0 - gdock.org');
    lines.push('REMARK   1 https://codeberg.org/rvhonorato/gdock');

    // REMARK 2 — reference
    lines.push('REMARK   2 REFERENCE 1');
    lines.push('REMARK   2  AUTH   R.Vargas Honorato');
    lines.push('REMARK   2  TITL   gdock: Information-Driven Protein-Protein Docking Using a');
    lines.push('REMARK   2  TITL 2 Genetic Algorithm.');
    lines.push('REMARK   2  REF    Zenodo, 2026. doi:10.5281/zenodo.18863557');

    // REMARK 3 — MD5 hashes per model
    ordered.forEach((r, i) => {
      lines.push(`REMARK   3 MODEL ${i + 1} FROM MD5 ${r.centerMd5}`);
    });

    // REMARK 4 — user notes (optional)
    if (subForm.notes.trim()) {
      const MAX_CONTENT = 62;
      let rem = subForm.notes.trim();
      while (rem.length > 0) {
        const chunk = rem.slice(0, MAX_CONTENT);
        rem = rem.slice(MAX_CONTENT);
        lines.push(`REMARK   4 ${chunk}`);
      }
    }

    // COMPND — one MOL_ID block per chain
    {
      const compndEntries: string[] = [];
      const perChain: { molId: number; molecule: string; chain: string }[] = [];
      let molId = 1;
      for (const chain of receptorChains) {
        perChain.push({ molId: molId++, molecule: subForm.chainMolecules[chain] || 'receptor', chain });
      }
      for (const chain of ligandChains) {
        perChain.push({ molId: molId++, molecule: subForm.chainMolecules[chain] || 'ligand', chain });
      }
      perChain.forEach(({ molId, molecule, chain }, pi) => {
        compndEntries.push(`MOL_ID: ${molId};`);
        compndEntries.push(`MOLECULE: ${molecule};`);
        const isLast = pi === perChain.length - 1;
        compndEntries.push(`CHAIN: ${chain}${isLast ? '' : ';'}`);
      });
      const MAX_CONTENT = 59;
      compndEntries.forEach((entry, idx) => {
        const cont = idx === 0 ? '  ' : String(idx + 1).padStart(2);
        const prefix = `COMPND  ${cont} `;
        let rem = entry;
        while (rem.length > 0) {
          const chunk = rem.slice(0, MAX_CONTENT);
          rem = rem.slice(MAX_CONTENT);
          lines.push(`${prefix}${chunk}`);
        }
      });
    }

    // Model blocks
    ordered.forEach((r, i) => {
      lines.push(`MODEL        ${i + 1}`);
      const modelLines = parsedModels[r.cluster.centerIdx]?.lines ?? [];
      lines.push(...extractOriginal(modelLines, allChains));
      lines.push('ENDMDL');
    });

    lines.push('END');

    return { content: lines.join('\n'), filename: `capri_T${target}_submission.pdb` };
  }

  function handleDownloadSubmission() {
    const { content, filename } = buildSubmissionPdb();
    const blob = new Blob([content], { type: 'chemical/x-pdb' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadSubmissionZip() {
    const { content, filename } = buildSubmissionPdb();
    const zip = zipSync({ [filename]: strToU8(content) });
    const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.pdb', '.pdb.zip');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(file: File | null) {
    if (!file) { setEnsembleText(null); setEnsembleName(null); setChains([]); setChainRoles({}); setParsedModels([]); return; }
    setEnsembleName(file.name);
    setResults([]);
    setPhase('idle');
    setError(null);
    setProgress({ done: 0, total: 0, label: 'Parsing ensemble' });
    setExpandedRows(new Set());
    setSelectedIndices(new Set());
    setSubForm({ round: '', target: '', groupName: '', authors: '', notes: '', chainMolecules: {} });
    setParsing(true);
    await new Promise(r => setTimeout(r, 0)); // flush render
    
    try {
      let text: string;
      let models: { modelId: number; lines: string[] }[] = [];
      
      if (file.name.endsWith('.gz')) {
        // For gzipped files, we still need to decompress the entire file
        // but we can use chunked reading to reduce memory pressure
        setProgress({ done: 0, total: 0, label: 'Reading gzipped file...' });
        const buffer = await readFileAsArrayBufferChunked(file);
        setProgress({ done: 0, total: 0, label: 'Decompressing...' });
        const decompressed = gunzipSync(new Uint8Array(buffer));
        text = new TextDecoder().decode(decompressed);
        setProgress({ done: 0, total: 0, label: 'Parsing models...' });
        models = splitModels(text);
      } else if (file.size > 50 * 1024 * 1024) { // For files > 50MB, use streaming
        // Use streaming approach for very large files - process line by line
        let currentModelLines: string[] = [];
        let currentModelId: number | null = null;
        let fileContent = ''; // We still need this for ensembleText, but we'll limit its size
        let modelCount = 0;
        let totalModelsEstimate = 0;
        
        // First pass: count models to estimate total
        setProgress({ done: 0, total: 0, label: 'Counting models...' });
        await processLargeFileInChunks(file, 10 * 1024 * 1024, (chunk) => {
          const chunkLines = chunk.split('\n');
          for (const line of chunkLines) {
            if (line.startsWith('MODEL ')) {
              totalModelsEstimate++;
            }
          }
        });
        
        // Second pass: parse models with progress tracking
        setProgress({ done: 0, total: totalModelsEstimate, label: 'Parsing models' });
        
        await processLargeFileInChunks(file, 10 * 1024 * 1024, (chunk) => {
          const chunkLines = chunk.split('\n');
          for (const line of chunkLines) {
            // Only keep first 1000 lines for preview to avoid memory issues
            if (fileContent.split('\n').length < 1000) {
              fileContent += line + '\n';
            }
            
            if (line.startsWith('MODEL ')) {
              // Start of a new model
              if (currentModelId !== null) {
                // Save previous model
                models.push({ modelId: currentModelId, lines: currentModelLines });
                modelCount++;
                setProgress({ done: modelCount, total: totalModelsEstimate, label: 'Parsing models' });
                // Clear memory
                currentModelLines = [];
              }
              currentModelId = parseInt(line.substring(6).trim());
              currentModelLines = [line];
            } else if (line.startsWith('ENDMDL') || line.startsWith('END')) {
              // End of current model
              if (currentModelId !== null) {
                currentModelLines.push(line);
                models.push({ modelId: currentModelId, lines: currentModelLines });
                modelCount++;
                setProgress({ done: modelCount, total: totalModelsEstimate, label: 'Parsing models' });
                currentModelId = null;
                currentModelLines = [];
              }
            } else if (currentModelId !== null) {
              // Part of current model
              currentModelLines.push(line);
            }
          }
        });
        
        text = fileContent;
      } else {
        // For smaller files, use regular chunked reading
        setProgress({ done: 0, total: 0, label: 'Reading file...' });
        text = await readFileAsTextChunked(file);
        setProgress({ done: 0, total: 0, label: 'Parsing models...' });
        models = splitModels(text);
      }
      
      setEnsembleText(text);
      setParsedModels(models);
      const detected = detectChains(models);
      setChains(detected);
      setChainRoles(Object.fromEntries(detected.map(c => [c, 'none' as ChainRole])));
    } catch (error) {
      setError(`Failed to load file: ${error instanceof Error ? error.message : String(error)}`);
      setPhase('error');
    } finally {
      setParsing(false);
      setProgress({ done: 0, total: 0, label: '' });
    }
  }

  function cycleRole(chain: string) {
    setChainRoles(prev => {
      const order: ChainRole[] = ['none', 'receptor', 'ligand'];
      const next = order[(order.indexOf(prev[chain] ?? 'none') + 1) % order.length];
      return { ...prev, [chain]: next };
    });
  }

  const isRunning = phase === 'contacts' || phase === 'clustering' || phase === 'scoring';
  const canRun = !!(ensembleText && receptorChains.length > 0 && ligandChains.length > 0) && !isRunning;

  async function handleRun() {
    if (!ensembleText) return;
    abortRef.current = false;
    setResults([]);
    setError(null);

    try {
      const models = parsedModels;
      const md5Map = parseMd5Map(ensembleText);

      // ── Phase 1: compute contacts ──────────────────────────────────────────
      setPhase('contacts');
      setProgress({ done: 0, total: models.length, label: 'Computing contacts' });
      const allContacts: string[][] = [];

      for (const { lines } of models) {
        if (abortRef.current) return;
        const receptorPdb = extractAndRename(lines, receptorChains, 'A');
        const ligandPdb = extractAndRename(lines, ligandChains, 'B');
        const contacts = await computeContacts(receptorPdb, ligandPdb);
        allContacts.push(contacts);
        setProgress(p => ({ ...p, done: allContacts.length }));
        if (allContacts.length % 20 === 0) await new Promise(r => setTimeout(r, 0));
      }

      // ── Phase 2: cluster ───────────────────────────────────────────────────
      setPhase('clustering');
      setProgress({ done: 0, total: 0, label: 'Clustering' });
      await new Promise(r => setTimeout(r, 0)); // flush UI
      const clusters = await clusterFromContacts(allContacts, fccCutoff, minClusterSize);

      if (clusters.length === 0) {
        setError('No clusters found. Try lowering the FCC cutoff or check chain assignment.');
        setPhase('error');
        return;
      }

      // ── Phase 3: score cluster centres ────────────────────────────────────
      setPhase('scoring');
      setProgress({ done: 0, total: clusters.length, label: 'Scoring cluster centres' });
      const scored: ScoredCluster[] = [];

      for (const cluster of clusters) {
        if (abortRef.current) return;
        const { lines, modelId } = models[cluster.centerIdx];
        const receptorPdb = extractAndRename(lines, receptorChains, 'A');
        const ligandPdb = extractAndRename(lines, ligandChains, 'B');
        const score = await scoreStructures(receptorPdb, ligandPdb);
        scored.push({
          rank: scored.length + 1,
          cluster,
          centerModelId: modelId,
          centerMd5: md5Map.get(modelId) ?? '',
          ...score,
        });
        setProgress(p => ({ ...p, done: scored.length }));
        await new Promise(r => setTimeout(r, 0));
      }

      // Sort by total score, re-rank
      scored.sort((a, b) => b.cluster.size - a.cluster.size);
      scored.forEach((s, i) => { s.rank = i + 1; });
      setResults(scored);
      setExpandedRows(new Set([0]));
      setSortKey('size');
      setSortDir('desc');
      setPhase('done');
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  }

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setExpandedRows(new Set());
  }

  const sortedResults = sortKey === null ? results : [...results].sort((a, b) => {
    const vals: Record<NonNullable<typeof sortKey>, [number, number]> = {
      rank: [a.rank, b.rank],
      size: [a.cluster.size, b.cluster.size],
      model: [a.centerModelId, b.centerModelId],
      fitness: [a.total, b.total],
      vdw: [a.vdw, b.vdw],
      elec: [a.elec, b.elec],
      desolv: [a.desolv, b.desolv],
    };
    const [av, bv] = vals[sortKey];
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  async function handleSaveCapriJob() {
    if (!ensembleText || results.length === 0 || saving) return;
    setSaving(true);
    const payload = new TextEncoder().encode(JSON.stringify({
      version: 1,
      type: 'capri',
      ensemblePdb: ensembleText,
      chainRoles,
      results,
      subForm,
      selectedIndices: [...selectedIndices],
    }));
    const compressed = await new Promise<Uint8Array>((resolve, reject) =>
      gzip(payload, (err, data) => err ? reject(err) : resolve(data))
    );
    const blob = new Blob([compressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const target = subForm.target || 'T???';
    a.download = `capri_T${target}.gdock`;
    a.click();
    URL.revokeObjectURL(url);
    setSaving(false);
  }

  async function handleImportCapriGdock(file: File) {
    try {
      const buffer = await readFileAsArrayBufferChunked(file);
      const decompressed = gunzipSync(new Uint8Array(buffer));
      const json = JSON.parse(new TextDecoder().decode(decompressed));
      if (json.version !== 1) {
        setError('Unsupported .gdock version.');
        setPhase('error');
        return;
      }
      if (json.type !== 'capri') {
        setError('This .gdock file belongs to the Dock tab — load it there.');
        setPhase('error');
        return;
      }
      const models = splitModels(json.ensemblePdb);
      setParsedModels(models);
      setEnsembleText(json.ensemblePdb);
      setEnsembleName('restored-ensemble.pdb');
      setChains(detectChains(models));
      setChainRoles(json.chainRoles ?? {});
      setResults(json.results ?? []);
      setSubForm(json.subForm ?? { round: '', target: '', groupName: '', authors: '', chainMolecules: {} });
      setSelectedIndices(new Set(json.selectedIndices ?? []));
      setExpandedRows(new Set([0]));
      setSortKey('size');
      setSortDir('desc');
      setPhase('done');
    } catch (e) {
      setError('Failed to load .gdock file: ' + String(e));
      setPhase('error');
    }
  }

  function handleDownload() {
    const header = 'rank\tcluster_size\tcenter_model_id\tcenter_md5\ttotal\tvdw\telec\tdesolv';
    const rows = results.map(r =>
      `${r.rank}\t${r.cluster.size}\t${r.centerModelId}\t${r.centerMd5}\t${r.total.toFixed(4)}\t${r.vdw.toFixed(4)}\t${r.elec.toFixed(4)}\t${r.desolv.toFixed(4)}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capri_scores.tsv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Upload a CAPRI multi-model ensemble PDB, assign chains to receptor and ligand, then cluster and score in the browser.
      </p>
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-400">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span><strong>Experimental</strong> — this CAPRI interface to score and select models is still being developed, use with care and double-check your submission.</span>
      </div>

      {/* Ensemble file upload */}
      <label className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition-colors mb-4 ${ensembleName ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10" : "border-slate-300 dark:border-slate-600 hover:border-accent-400 dark:hover:border-accent-400 bg-white dark:bg-slate-900/40"}`}>
        <input type="file" accept=".pdb,.gz" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
        {ensembleName ? (
          <>
            <svg className="w-5 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Ensemble</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{ensembleName}</span>
          </>
        ) : (
          <>
            <svg className="w-7 h-7 text-slate-400 group-hover:text-accent-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-accent-500 transition-colors">Ensemble</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">multi-model .pdb or .pdb.gz</span>
          </>
        )}
      </label>

      {/* Parsing indicator */}
      {parsing && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span>{progress.label}…</span>
          </div>
          {progress.total > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1">
                <span>Progress: {progress.done} of {progress.total} models</span>
                <span>{progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAPRI parameters */}
      {chains.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">CAPRI parameters</p>

          {/* Chain assignment */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Chain assignment</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">click to cycle: unassigned → receptor → ligand</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {chains.map(chain => {
                const role = chainRoles[chain] ?? 'none';
                return (
                  <button
                    key={chain}
                    onClick={() => cycleRole(chain)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-colors border ${role === 'receptor' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700' :
                      role === 'ligand' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-300 dark:border-cyan-700' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                      }`}
                  >
                    {chain}
                    {role !== 'none' && <span className="ml-1.5 text-xs opacity-70">{role === 'receptor' ? 'Receptor' : 'Ligand'}</span>}
                  </button>
                );
              })}
            </div>
            {(receptorChains.length > 0 || ligandChains.length > 0) && (
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Receptor chains → <span className="font-mono">A</span>, ligand chains → <span className="font-mono">B</span>
              </p>
            )}
          </div>

          {/* Clustering parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <span className="group relative inline-flex items-center gap-1">
                  FCC cutoff
                  <svg className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="pointer-events-none absolute top-full left-0 mt-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity z-[9999] font-normal shadow-lg">
                    Percentage of common contacts between two structures for them to be considered to belong in the same cluster.
                  </span>
                </span>
                <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">(default 0.60)</span>
              </label>
              <input
                type="number"
                min={0.1} max={1.0} step={0.05}
                value={fccCutoff}
                onChange={e => setFccCutoff(Math.min(1, Math.max(0.1, parseFloat(e.target.value) || 0.60)))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Min cluster size
                <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">(default 4)</span>
              </label>
              <input
                type="number"
                min={1} max={100} step={1}
                value={minClusterSize}
                onChange={e => setMinClusterSize(Math.max(1, parseInt(e.target.value) || 4))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleRun}
        disabled={!canRun}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors mb-2 ${canRun ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"}`}
      >
        Cluster &amp; score
      </button>

      {phase === 'idle' && (
        <div className="flex items-center justify-center gap-1.5 mb-4 text-xs text-slate-400 dark:text-slate-500">
          <span>or restore a previous job</span>
          <label className="cursor-pointer flex items-center gap-1 text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300 transition-colors">
            <input
              type="file"
              accept=".gdock"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCapriGdock(f); e.target.value = ''; }}
            />
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            load .gdock file
          </label>
        </div>
      )}

      {/* Progress */}
      {isRunning && (
        <div className="mb-4">
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-2">
            <svg className="w-4 h-4 animate-spin text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{progress.label}{progress.total > 0 ? ` — ${progress.done} / ${progress.total}` : '…'}</span>
          </div>
          {progress.total > 0 && (
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {phase === 'error' && error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
      )}

      {/* Results */}
      {phase === 'done' && results.length > 0 && (
        <>
          {/* Submission builder */}
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Prepare submission
                <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                  {selectedIndices.size} model{selectedIndices.size !== 1 ? 's' : ''} selected
                  {selectedIndices.size < 10 && <span className="text-amber-500 dark:text-amber-400"> ({10 - selectedIndices.size} more recommended)</span>}
                </span>
              </h3>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear selection
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              {([
                { label: 'CAPRI Round', key: 'round' as const, placeholder: '' },
                { label: 'Target', key: 'target' as const, placeholder: '' },
                { label: 'Team', key: 'groupName' as const, placeholder: '' },
              ]).map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={subForm[key]}
                    onChange={e => setSubForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                </div>
              ))}
            </div>

            <div className="mb-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-[3rem_6rem_1fr] bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <span>Chain</span>
                  <span>Assignment</span>
                  <span>Molecule name</span>
                </div>
                {[
                  ...receptorChains.map(c => ({ chain: c, role: 'receptor' as const })),
                  ...ligandChains.map(c => ({ chain: c, role: 'ligand' as const })),
                ].map(({ chain, role }, i, arr) => (
                  <div key={chain} className={`grid grid-cols-[3rem_6rem_1fr] items-center px-3 py-1.5 gap-2 ${i < arr.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''} ${i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{chain}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium w-fit ${role === 'receptor' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'}`}>{role}</span>
                    <input
                      type="text"
                      placeholder={role === 'receptor' ? 'e.g. Receptor protein name' : 'e.g. Ligand protein name'}
                      value={subForm.chainMolecules[chain] ?? ''}
                      onChange={e => setSubForm(f => ({ ...f, chainMolecules: { ...f.chainMolecules, [chain]: e.target.value } }))}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Authors <span className="font-normal">(comma-separated)</span></label>
              <textarea
                rows={2}
                placeholder="Gandalf the White, Ellen Ripley, Darth Sidious"
                value={subForm.authors}
                onChange={e => setSubForm(f => ({ ...f, authors: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none font-mono"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes <span className="font-normal">(optional)</span></label>
              <textarea
                rows={3}
                placeholder="Describe the rationale behind the model selection…"
                value={subForm.notes}
                onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
              />
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={handleDownloadSubmissionZip}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download submission ZIP
              </button>
              <button
                onClick={handleDownloadSubmission}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDB
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="w-8 px-2">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                      {selectedIndices.size}/10
                    </span>
                  </th>
                  <th className="w-6 px-2" />
                  <Th label="Rank" tooltip="Ranked by cluster size, largest first." align="center" onSort={() => handleSort('rank')} sortDir={sortKey === 'rank' ? sortDir : null} />
                  <Th label="Cluster size" tooltip="Number of models in this cluster." align="center" onSort={() => handleSort('size')} sortDir={sortKey === 'size' ? sortDir : null} />
                  <Th label="Model" tooltip="CAPRI model number of the cluster centre." align="center" onSort={() => handleSort('model')} sortDir={sortKey === 'model' ? sortDir : null} />
                  <Th label="Fitness" tooltip="Weighted sum: VDW×0.4 + Elec×0.05 + Desolv×3.4. Lower is better." onSort={() => handleSort('fitness')} sortDir={sortKey === 'fitness' ? sortDir : null} />
                  <Th label="VDW" tooltip="Van der Waals energy." onSort={() => handleSort('vdw')} sortDir={sortKey === 'vdw' ? sortDir : null} />
                  <Th label="Elec" tooltip="Electrostatic energy." onSort={() => handleSort('elec')} sortDir={sortKey === 'elec' ? sortDir : null} />
                  <Th label="Desolv" tooltip="Desolvation energy." onSort={() => handleSort('desolv')} sortDir={sortKey === 'desolv' ? sortDir : null} />
                  <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">MD5</th>
                </tr>
              </thead>
              {sortedResults.map((r, i) => {
                const isOpen = expandedRows.has(i);
                const modelLines = parsedModels[r.cluster.centerIdx]?.lines ?? [];
                return (
                  <tbody key={r.centerModelId} className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr
                      className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
                      onClick={() => setExpandedRows(prev => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s; })}
                    >
                      <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIndices.has(i)}
                          disabled={!selectedIndices.has(i) && selectedIndices.size >= 10}
                          onChange={() => toggleSelect(i)}
                          className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-slate-400 dark:text-slate-500">
                        <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">{r.rank}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">{r.cluster.size}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">{r.centerModelId}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-700 dark:text-slate-200">{r.total.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">{r.vdw.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">{r.elec.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">{r.desolv.toFixed(2)}</td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">{r.centerMd5}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700">
                          <MolstarViewer
                            receptorPdb={extractAndRename(modelLines, receptorChains, 'A')}
                            ligandPdb={extractAndRename(modelLines, ligandChains, 'B')}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium border border-emerald-500 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download scores (TSV)
            </button>
            <button
              onClick={handleSaveCapriJob}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Save a .gdock snapshot you can reload later"
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 3v4a1 1 0 001 1h4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17h6M9 13h6" />
                </svg>
              )}
              {saving ? 'Saving…' : 'Save job'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
