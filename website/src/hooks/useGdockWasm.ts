import init, {
  score_structures,
  ScoreResult,
  compute_contacts,
  cluster_from_contacts,
  generate_restraints,
  tbl_to_pairs,
} from "gdock-wasm";

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export interface ScoreOutput {
  vdw: number;
  elec: number;
  desolv: number;
  clash: number;
  total: number;
}

export async function scoreStructures(
  receptorText: string,
  ligandText: string,
  wVdw = 0.4,
  wElec = 0.05,
  wDesolv = 3.4,
): Promise<ScoreOutput> {
  await ensureInit();
  const result: ScoreResult = score_structures(receptorText, ligandText, wVdw, wElec, wDesolv);
  return {
    vdw: result.vdw,
    elec: result.elec,
    desolv: result.desolv,
    clash: result.clash,
    total: result.total,
  };
}

export interface PoseOutput {
  rank: number;
  fitness: number;
  vdw: number;
  elec: number;
  desolv: number;
  air: number;
  clash: number;
  clusterSize: number;
  ligandPdb: string;
}

export interface DockingOutput {
  generationsRun: number;
  /** True if the GA stopped before the maximum number of generations */
  convergedEarly: boolean;
  /** Wall-clock time for the GA run in milliseconds (measured in the worker) */
  executionTimeMs: number;
  /** Cluster centres sorted by fitness (diverse poses, mirrors model_1…model_5 from CLI) */
  clusteredPoses: PoseOutput[];
  /** Top entries from Hall of Fame sorted purely by fitness (mirrors ranked_1…ranked_5 from CLI) */
  rankedPoses: PoseOutput[];
}

export interface ClusterResult {
  centerIdx: number;
  members: number[];
  size: number;
}

export async function computeContacts(
  receptorPdb: string,
  ligandPdb: string,
): Promise<string[]> {
  await ensureInit();
  return compute_contacts(receptorPdb, ligandPdb) as string[];
}

export async function clusterFromContacts(
  allContacts: string[][],
  fccCutoff?: number,
  minClusterSize?: number,
): Promise<ClusterResult[]> {
  await ensureInit();
  return cluster_from_contacts(
    JSON.stringify(allContacts),
    fccCutoff,
    minClusterSize,
  ) as ClusterResult[];
}

/** Restraint pairs from the interface of a complex in the bound position. */
export async function generateRestraints(
  receptorPdb: string,
  ligandPdb: string,
  cutoff?: number,
  mode?: 'ambig' | 'unambig',
): Promise<[number, number][]> {
  await ensureInit();
  return generate_restraints(receptorPdb, ligandPdb, cutoff, mode) as [number, number][];
}

/** Restraint pairs from the text of a HADDOCK AIR .tbl file. */
export async function tblToPairs(tbl: string): Promise<[number, number][]> {
  await ensureInit();
  return tbl_to_pairs(tbl) as [number, number][];
}

export interface DockingOptions {
  maxGenerations?: number;
  seed?: number;
  populationSize?: number;
  /** Keep up to this many poses and return all of them in rankedPoses. */
  sampling?: number;
}

export function runDocking(
  receptorPdb: string,
  ligandPdb: string,
  restraintPairs?: [number, number][],
  maxGenerations?: number,
  options: DockingOptions = {},
): Promise<DockingOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../docking.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.result as DockingOutput)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e)
    }
    worker.postMessage({ receptorPdb, ligandPdb, restraintPairs, maxGenerations, ...options })
  })
}
