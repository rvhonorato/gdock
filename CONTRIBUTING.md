# Contributing to gdock

Thank you for your interest in contributing to gdock! This document provides
guidelines to help you get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report
unacceptable behavior to <email@rvhonorato.me>.

## AI Policy

Read the [AI Policy](AI_POLICY.md) before you open an issue or a pull request,
even if you do not use AI tools. It tells you what AI use is permitted and
what you must disclose.

## How to Contribute

### Reporting Bugs

Open an [issue](https://codeberg.org/rvhonorato/gdock/issues) with:

- A clear description of the problem
- Steps to reproduce the behavior
- Input files (PDB and restraints) if applicable
- Expected vs actual output
- Rust version (`rustc --version`) and OS

### Suggesting Features

Open an [issue](https://codeberg.org/rvhonorato/gdock/issues) describing the
feature, its use case, and how it fits into the existing docking workflow.

### Submitting Pull Requests

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Ensure all checks pass (see below)
4. Open a pull request against `main`

## Development Setup

```bash
git clone https://codeberg.org/<your-username>/gdock.git
cd gdock
cargo build
```

Requires [Rust](https://www.rust-lang.org/tools/install) 1.85 or later.

## Quality Checks

All pull requests must pass the CI checks. Run these locally before submitting:

```bash
# Run the test suite
cargo test

# Check formatting
cargo fmt --all -- --check

# Run linting
cargo clippy -- -D warnings
```

To auto-format your code:

```bash
cargo fmt
```

The commands above check the core crate only. The bindings and the website
have their own checks:

### Python bindings (`py/`)

You need [uv](https://docs.astral.sh/uv/) and the Python development headers.

```bash
cargo fmt -p gdock-py -- --check
cargo clippy -p gdock-py --no-default-features --all-targets -- -D warnings
cargo test -p gdock-py --no-default-features

cd py
uv venv .venv
source .venv/bin/activate
uv pip install maturin pytest
maturin develop --uv
pytest tests/
```

### WebAssembly bindings (`wasm/`)

You need [wasm-pack](https://rustwasm.github.io/wasm-pack/), Node.js and the
`wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`).

```bash
cargo clippy -p gdock-wasm --target wasm32-unknown-unknown --all-targets -- -D warnings

cd wasm
wasm-pack test --node
```

### Website (`website/`)

The setup and the commands are in the
[Website](README.md#website) section of the README. Run `npm run lint`,
`npm test` and `npm run build` before you open a pull request.

## Project Structure

| Directory | Contents |
|-----------|----------|
| `src/` | Rust source code |
| `py/` | Python bindings |
| `wasm/` | WebAssembly bindings |
| `website/` | gdock.org website |
| `data/` | Test PDB files |
| `paper/` | JOSS paper draft |
| `.forgejo/workflows/` | CI and release workflows |

The core crate, the Python bindings and the WebAssembly bindings share one
version number. It is in the `[workspace.package]` section of `Cargo.toml`.

See the [README](README.md) for a description of the subcommands and usage.

## Releases

Only the maintainers make releases. The procedure is:

1. Set the version in the `[workspace.package]` section of `Cargo.toml`.
2. Update `version` and `date-released` in `CITATION.cff`.
3. Push a tag with the name `v<version>`, for example `v2.3.0`.

The tag starts the `release` workflow. The workflow stops if the tag is not
equal to the version in `Cargo.toml`. It builds the crate, the Python source
distribution and the Python wheels. Then it publishes the Python package to
PyPI and the crate to crates.io.

The website has no release. Each push to `main` that changes `website/`,
`wasm/` or `src/` deploys [gdock.org](https://gdock.org).

## License

By contributing, you agree that your contributions will be licensed under the
[BSD Zero Clause License](LICENSE).
