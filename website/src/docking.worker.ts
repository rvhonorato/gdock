import init, { run_docking } from 'gdock-wasm'

let initialized = false

self.onmessage = async (e: MessageEvent) => {
  const { receptorPdb, ligandPdb, restraintPairs, maxGenerations, seed, populationSize, sampling } = e.data
  try {
    if (!initialized) {
      await init()
      initialized = true
    }
    const t0 = performance.now()
    const result = run_docking(
      receptorPdb,
      ligandPdb,
      JSON.stringify(restraintPairs ?? []),
      maxGenerations != null ? BigInt(maxGenerations) : undefined,
      seed != null ? BigInt(seed) : undefined,
      populationSize ?? undefined,
      sampling ?? undefined,
    )
    const executionTimeMs = Math.round(performance.now() - t0)
    self.postMessage({ ok: true, result: { ...result, executionTimeMs } })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) })
  }
}
