import type { ClusterResult } from "../../../hooks/useGdockWasm";

export type ChainRole = 'receptor' | 'ligand' | 'none';
export type CapriPhase = 'idle' | 'contacts' | 'clustering' | 'scoring' | 'done' | 'error';

export interface ScoredCluster {
  rank: number;
  cluster: ClusterResult;
  centerModelId: number;
  centerMd5: string;
  vdw: number;
  elec: number;
  desolv: number;
  total: number;
}

export function parseMd5Map(pdb: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of pdb.split('\n')) {
    const m = line.match(/^REMARK\s+9\s+MODEL\s+(\d+)\s+MD5\s+([0-9a-f]+)/);
    if (m) map.set(parseInt(m[1], 10), m[2]);
  }
  return map;
}

export function splitModels(pdb: string): { modelId: number; lines: string[] }[] {
  const models: { modelId: number; lines: string[] }[] = [];
  let current: string[] | null = null;
  let currentId = 0;
  for (const line of pdb.split('\n')) {
    const mStart = line.match(/^MODEL\s+(\d+)/);
    if (mStart) {
      current = [];
      currentId = parseInt(mStart[1], 10);
    } else if (line.startsWith('ENDMDL')) {
      if (current) { models.push({ modelId: currentId, lines: current }); current = null; }
    } else if (current) {
      current.push(line);
    }
  }
  return models;
}

export function detectChains(models: { modelId: number; lines: string[] }[]): string[] {
  const seen = new Set<string>();
  for (const line of (models[0]?.lines ?? [])) {
    if ((line.startsWith('ATOM') || line.startsWith('HETATM')) && line.length > 21) {
      const c = line[21];
      if (c && c.trim()) seen.add(c);
    }
  }
  return Array.from(seen).sort();
}

/** Extract chains and rename them all to `newChain` so the scorer sees a clean single-chain PDB. */
export function extractAndRename(lines: string[], chainIds: string[], newChain: string): string {
  const set = new Set(chainIds);
  return lines
    .filter(l => (l.startsWith('ATOM') || l.startsWith('HETATM')) && l.length > 21 && set.has(l[21]))
    .map(l => l.slice(0, 21) + newChain + l.slice(22))
    .join('\n');
}

/** Extract chains keeping original chain IDs (for submission output).
 *  Emits TER after each chain — using the source record if present, or
 *  a synthetic one if the ensemble omits them. */
export function extractOriginal(lines: string[], chainIds: string[]): string[] {
  const set = new Set(chainIds);
  const result: string[] = [];
  let prevChain: string | null = null;
  let needsTer = false;

  for (const l of lines) {
    if ((l.startsWith('ATOM') || l.startsWith('HETATM')) && l.length > 21 && set.has(l[21])) {
      const chain = l[21];
      if (prevChain !== null && chain !== prevChain && needsTer) {
        result.push('TER');
        needsTer = false;
      }
      result.push(l);
      prevChain = chain;
      needsTer = true;
    } else if (l.startsWith('TER') && needsTer) {
      result.push(l);
      needsTer = false;
    }
  }

  if (needsTer) result.push('TER');

  return result;
}
