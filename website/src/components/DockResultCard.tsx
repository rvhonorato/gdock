import { MolstarViewer } from "./LazyMolstarViewer";
import type { PoseOutput } from "../hooks/useGdockWasm";

interface Props {
  pose: PoseOutput;
  receptorPdb: string | null;
  restraintPairs?: [number, number][];
  showClusterSize?: boolean;
}

function downloadPdb(content: string, filename: string) {
  const blob = new Blob([content], { type: 'chemical/x-pdb' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DockResultCard({ pose, receptorPdb, restraintPairs, showClusterSize = true }: Props) {
  function handleDownload() {
    const complex = [receptorPdb, pose.ligandPdb].filter(Boolean).join('\n');
    downloadPdb(complex, `complex_rank${pose.rank}.pdb`);
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
      <MolstarViewer receptorPdb={receptorPdb} ligandPdb={pose.ligandPdb} height={360} restraintPairs={restraintPairs} />

      <div className="p-3 flex items-center gap-2">
        <span className={`
          inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0
          ${pose.rank === 1
            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }
        `}>
          {pose.rank}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {pose.rank === 1 ? "Best pose" : `Pose ${pose.rank}`}
          </span>
          {showClusterSize && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              cluster size: {pose.clusterSize}
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          title="Download complex PDB"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
            border border-slate-200 dark:border-slate-700
            text-slate-600 dark:text-slate-300
            hover:bg-slate-100 dark:hover:bg-slate-800
            transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDB
        </button>
      </div>
    </div>
  );
}
