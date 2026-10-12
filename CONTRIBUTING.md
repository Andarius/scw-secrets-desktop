# Contributing

## Issues

Include the app version, OS, install method (snap, AppImage, .dmg, source) and steps to reproduce. Never paste
secret values or API keys.

Open an issue to discuss before starting a large feature or a change to native commands.

## Setup

Requires [Bun](https://bun.sh) 1.3+, [Rust](https://rustup.rs) (rustup installs the version pinned in `rust-toolchain.toml`) and [just](https://github.com/casey/just).
Install the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform first.

```bash
just install    # bun install
just dev        # desktop window
just mock       # browser preview with sample data, no Scaleway account needed (port 5199)
```

Run `just` to list all recipes.

## Checks

CI runs these on every PR; run them before opening one:

```bash
just ci         # typecheck + build + Rust checks + unit tests + e2e
```

E2E tests run Playwright against mock mode; install the browser once with `bunx playwright install chromium`. On a
PR, CI runs them only once a maintainer adds the `e2e` label; the run records every test into a single video and
links it in a PR comment (`bun run test:e2e:record` produces the same `videos/e2e.mp4` locally, needs ffmpeg).

Rust uses uv-style pedantic Clippy rules in `src-tauri/Cargo.toml` and Rust 2024 formatting in
`src-tauri/rustfmt.toml`. CI treats lint warnings as errors; the crate language edition remains 2021.

## Guidelines

- UI behavior changes come with a Playwright test in `tests/e2e/`; logic in `src/mainview/lib/` and `src-tauri/src/`
  comes with unit tests.
- Changes to credential handling, native command validation and capabilities need Rust regression tests.
- Don't commit generated build outputs (`dist/` and `src-tauri/target/`).
- Update `README.md` for user-facing changes.

## Pull requests

- Title in [Conventional Commits](https://www.conventionalcommits.org/) form (`feat:`, `fix:`, `refactor:`, ...).
- Keep the description short: what changed and why.

## Use of AI

AI tools are welcome; `AGENTS.md` gives them the repo's commands and rules. You remain responsible for your change:
you must understand it and explain it in your own words, in the PR body and in review replies.

## Releases

Releases are cut by maintainers: `just bump <patch|minor|major|x.y.z>` bumps `package.json`
(which `src-tauri/tauri.conf.json` reads), `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, then commits and tags `v<version>`. Pushing the tag runs the `Release` workflow, which checks the tag matches `package.json` and `Cargo.toml` and
builds a draft GitHub release whose notes are that version's `CHANGELOG.md` entry; add it in the release PR.
