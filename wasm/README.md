# gdock-wasm

WebAssembly bindings for [gdock](https://crates.io/crates/gdock), a genetic-algorithm–based protein–protein docking engine.

Runs entirely in the browser — no server required.

> **The main source repository has moved to
> [Codeberg](https://codeberg.org/rvhonorato/gdock).** GitHub remains
> available as a mirror; please open issues and pull requests on Codeberg.

## Exposed API

### `score_structures(receptor_pdb, ligand_pdb, w_vdw, w_elec, w_desolv)`

Scores a receptor–ligand complex and returns `{ vdw, elec, desolv, total }`.

### `run_docking(receptor_pdb, ligand_pdb, restraint_pairs_json, max_generations?, seed?)`

Runs a full docking GA and returns:

```jsonc
{
  "generationsRun": 100,
  "clusteredPoses": [{ "rank": 1, "fitness": -42.0, "vdw": "...", "ligandPdb": "..." }],
  "rankedPoses":    [{ "rank": 1, "fitness": -42.0, "vdw": "...", "ligandPdb": "..." }]
}
```

`restraint_pairs_json` is a JSON array of `[receptorResnum, ligandResnum]` pairs, e.g. `"[[10,5],[22,8]]"`. Pass `"[]"` for unrestrained docking.

## Build

```bash
# Install wasm-pack if needed
cargo install wasm-pack

# Build for web
wasm-pack build --target web
```

Output lands in `pkg/`.

## Usage (JavaScript/TypeScript)

```ts
import init, { run_docking, score_structures } from "./pkg/gdock_wasm.js";

await init();

const result = await run_docking(receptorPdb, ligandPdb, "[]");
console.log(result.clusteredPoses[0].ligandPdb);
```

## Links

- Homepage: <https://gdock.org>
- Core library: [gdock on crates.io](https://crates.io/crates/gdock)
- Source: [codeberg.org/rvhonorato/gdock](https://codeberg.org/rvhonorato/gdock) (directory `wasm/`)

## License

0BSD
