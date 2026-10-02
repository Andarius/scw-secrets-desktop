# Scaleway Secrets Desktop

Desktop app for browsing and managing [Scaleway Secret Manager](https://www.scaleway.com/en/secret-manager/) secrets.

Built with [Deno desktop](https://docs.deno.com/go/desktop), React, TypeScript, and Tailwind CSS.

## Disclaimer

This project is provided as-is, with no guarantee or warranty of any kind. Use it at your own risk.

![SCW Secrets Desktop](docs/screenshot.png)

## Features

- **Profile & project switching** — reads `~/.config/scw/config.yaml` and environment variables
- **Path navigator** — browse secrets organized by path hierarchy
- **Secrets inventory** — searchable table with status and version badges, filter by status
- **Spotlight search** — `Ctrl/Cmd+P` to search across all secrets, with `id:`, `name:`, `path:`, `tag:`, `type:` field prefixes
- **Deep search** — opt-in mode that prefetches secret values for the current project so spotlight matches payload contents (`value:` prefix); cached in memory only, clearable from Settings
- **Cleanup plan** — click the Reclaimable card to review prunable revisions per secret with accurate active-version counts (excludes already-scheduled deletions)
- **Multi-select** — shift+click for range, ctrl+click to toggle, batch operations
- **View secret values** — single or batch, displayed in a full-screen overlay with copy support
- **Create secret** — create new secrets with name, path, type, value, and tags
- **Edit secret values** — modify a value and save as a new version
- **Copy as KEY=VALUE** — batch-copy selected secrets for `.env` files
- **Version history** — modal with all versions, enable/disable/destroy actions
- **Keep Latest** — prune old versions, keeping only the latest revision (single or batch)
- **Column sorting** — sort inventory by name, version count, or updated date
- **Secret types** — displayed in inventory table and detail panel
- **Cost estimates** — storage cost and potential cleanup savings in stats cards
- **Tags** — displayed in the inventory table
- **Select all** — quick button to select all visible secrets
- **Manage secret** — opens the Scaleway console for the selected secret
- **Schedule deletion** — single or batch delete with confirmation

## Install

### Quickstart

```bash
curl -fsSL https://raw.githubusercontent.com/Andarius/scw-secrets-desktop/master/bin/quickstart.sh | bash
```

Installs the latest packaged app for the platform: snap or AppImage on Linux x64
(`SCW_SECRETS_APP=appimage` forces the AppImage, no sudo), zipped `.app` on macOS
(quarantine cleared automatically). `SCW_SECRETS_VERSION=v0.6.0` pins a release,
`SCW_SECRETS_APP=source` clones and builds from the checkout instead
(`SCW_SECRETS_DIR` overrides the default `~/scw-secrets-desktop`).

## Setup

```bash
bun install
```

Requires [Deno](https://deno.com) 2.9+ for `deno desktop`.

### macOS

If macOS shows "app is damaged and can't be opened", clear the quarantine attribute:

```bash
xattr -c "/Applications/Scw Secrets.app"
```

## Development

```bash
bun run dev          # Vite build + desktop window (deno desktop)
bun run dev:hmr      # Vite dev server (port 5181) + headless deno backend (port 8790)
bun run mock         # Browser preview with mock data (port 5199)
```

Headless/HMR startup prints an authenticated launch URL containing `#token=...`; open
that URL for the corresponding port. Treat it as a credential and do not share it.
Each backend restart issues a new token. The desktop window authenticates automatically.
Production assets are embedded at build time; rebuild and restart to update them.

## Testing

```bash
bun run test         # Unit tests (bun test)
bun run test:e2e     # E2E tests (Playwright against mock mode)
```

## Build

```bash
bun run build        # Vite production build
bun run bundle       # Vite build + embed assets + Linux AppImage (build/linux)
deno task bundle:mac # macOS .dmg
deno task bundle:msi # Windows .msi
bun run typecheck    # TypeScript check (frontend)
deno task check      # Type-check the deno backend
```

## Linux Release

Download the Linux release from the GitHub releases page: the `.AppImage`, `.snap`, or the
`scw-secrets` directory bundle. The AppImage is self-contained:

```bash
chmod +x ScwSecrets.AppImage
./ScwSecrets.AppImage
```

The app needs a graphical session (webkit2gtk). If you launch it from a plain shell without
a usable display, GTK will fail with `cannot open display`.

## Project Structure

```
src/
├── deno/
│   ├── main.ts               # Deno-desktop entrypoint: HTTP server, /api routes, window
│   ├── scw.ts                # Scaleway config parsing and API client
│   ├── config.ts             # Env-overridable settings (port, data dir)
│   └── embed.ts              # Generated asset embeds (deno task embed)
├── mainview/
│   ├── main.tsx              # React entry point (loads App, or MockApp with VITE_MOCK=1)
│   ├── App.tsx               # React application shell
│   ├── assets/               # Global styles (index.css)
│   ├── lib/
│   │   ├── rpc.ts            # Typed fetch client for the /api backend
│   │   ├── secret-list.ts    # Filtering, sorting, and selection reconciliation
│   │   ├── secret-versions.ts # Version pruning plan and next revision logic
│   │   ├── inventory-selection.ts # Row click and select-all state helpers
│   │   ├── value-format.ts   # Secret value parsing, conversion, and structure editing
│   │   ├── settings.ts       # Persisted app settings
│   │   └── clipboard.ts, console.ts
│   ├── hooks/                # React hooks, one per file (useSaveSecretValue, useNextRevision…)
│   ├── mock/                 # Mock mode: MockApp (sample data) and the inert mock API
│   └── components/
│       ├── layout/           # Header, PaneRail, StatsCards, UpdateBanner
│       ├── panels/           # Navigator (path tree), Inventory (secrets table), DetailPanel
│       ├── modals/           # ValueModal (view/edit a value), CreateSecret, History, Cleanup, Settings, Logs
│       ├── secret-value/     # ValueViewer, ValueStructureEditor
│       ├── inputs/           # HeaderSelect, HighlightedTextarea, KeyFilterInput
│       └── search/           # SpotlightSearch
└── shared/
    ├── models.ts             # Shared types
    └── rpc.ts                # API contract (POST /api/<method>)
```
