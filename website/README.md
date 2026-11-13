# gdock-website

React + Vite + Tailwind landing page with an in-browser docking engine (gdock-wasm).

## Dev

```bash
npm run dev          # start dev server (http://localhost:5173)
npm run build        # tsc + vite build → dist/
npm run preview      # serve dist/ locally to check prod build
npm run lint         # eslint
```

## WASM dependency

`gdock-wasm` comes from the `wasm/` directory of this repository, not from npm.
Build it before `npm ci`, and build it again after a change in `src/` or `wasm/`:

```bash
npm run wasm         # needs wasm-pack and the wasm32-unknown-unknown target
```

## Key files

| Path | What it does |
|---|---|
| `src/components/sections/Gdock.tsx` | Score + Dock tabs, .gdock save/restore |
| `src/hooks/useGdockWasm.ts` | `scoreStructures()` / `runDocking()` — spawn workers |
| `src/docking.worker.ts` | Web Worker that calls WASM `run_docking` |
| `src/components/MolstarViewer.tsx` | Mol* v5 viewer (all panels hidden) |
| `src/components/DockResultCard.tsx` | Per-pose card with 3D viewer |

## .gdock file format

Gzip-compressed JSON (`fflate.gzipSync`):

```json
{
  "version": 1,
  "receptorPdb": "...",
  "ligandPdb": "...",
  "restraintPairs": [[933, 6], [936, 8]],
  "result": {
    "generationsRun": 66,
    "executionTimeMs": 14300,
    "clusteredPoses": [...],
    "rankedPoses": [...]
  }
}
```

Filename: `gdock_<8hexchars>.gdock` — djb2 hash of receptor + ligand + restraint pairs.

## Deployment

Static site — just serve `dist/`. No server-side component.

```bash
npm run build
# upload dist/ to hosting
```

Workers and WASM are bundled by Vite; no extra headers needed (COOP/COEP not required since SharedArrayBuffer isn't used).
