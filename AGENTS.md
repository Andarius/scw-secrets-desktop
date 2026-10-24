# AGENTS.md

SCW Secrets Desktop: desktop UI for browsing and managing Scaleway Secret Manager secrets. A Tauri 2 Rust backend
(`src-tauri/src/`) owns native commands and the Scaleway client; the React frontend (`src/mainview/`) calls it
through a typed client (`src/mainview/lib/rpc.ts`, contract in `src/shared/rpc.ts`).

Setup, workflow, PR and release conventions: see `CONTRIBUTING.md`.

## Stack

- Tauri 2, Rust (pinned in `rust-toolchain.toml`), Bun 1.3 (frontend toolchain, unit tests), React, TypeScript,
  Tailwind CSS 3, Vite, Playwright, just.
- The `justfile` hides the frontend/native toolchains; `just --list` for everything.

## Structure

- `src-tauri/` — Rust backend, Tauri configuration and capabilities
- `src/shared/` — frontend types (`models.ts`) and native command contract (`rpc.ts`)
- `src/mainview/lib/` — frontend logic: API client, settings, value parsing, secret list/version helpers
- `src/mainview/hooks/` — React hooks, one per file (`useXxx.ts`)
- `src/mainview/components/` — grouped by role: `layout/`, `panels/`, `modals/`, `secret-value/`, `inputs/`, `search/`
- `src/mainview/mock/` — mock mode (`just mock`): `MockApp` sample data and the mock API used by e2e tests
- `src-tauri/src/` — Rust unit tests; `tests/mainview/` — Bun unit tests; `tests/e2e/` — Playwright mock tests

## Verify

Match CI (`.github/workflows/ci.yml`):

```bash
just ci        # typecheck + build + Rust checks + unit tests + e2e
```

Or piecemeal: `just typecheck`, `just build && just rust-check`, `just test`, `just e2e`. CI also runs `just audit`
(npm and Rust advisory scan; needs `cargo-deny`).

## Rules linters don't catch

- Native commands are a security boundary: keep credential handling and input validation in Rust, and cover
  changes with Rust tests. Grant only the capabilities the frontend needs.
- Scaleway secret versions are immutable: saving a value creates a new revision. `Secret.version_count` also counts
  versions scheduled for deletion; use the active counts (`useActiveVersionCounts`) for anything user-facing.
- `MockApp` mirrors parts of `App`; when a UI change touches shared state, update both and the mock API so e2e covers it.
- Every UI behavior change comes with a Playwright test in `tests/e2e/mock-app.e2e.ts`.
- Every PR that changes the UI embeds a screenshot of it in the description, taken from mock mode (`just mock`).
  Push images to the orphan `pr-assets` branch as `<pr-number>/<name>.png`, never to the feature branch, and embed
  `https://raw.githubusercontent.com/Andarius/scw-secrets-desktop/refs/heads/pr-assets/<pr-number>/<name>.png`.
- Scaleway API reference: there is no public OpenAPI spec. The Go SDK is the most reliable source for endpoints and
  fields: https://raw.githubusercontent.com/scaleway/scaleway-sdk-go/master/api/secret/v1beta1/secret_sdk.go
