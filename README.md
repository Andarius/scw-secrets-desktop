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
│   ├── App.tsx               # React application shell
│   ├── rpc.ts                # Typed fetch client for the /api backend
│   ├── main.tsx              # React entry point
│   ├── secret-list.ts        # Filtering, sorting, and selection reconciliation
│   ├── secret-versions.ts    # Version pruning plan logic
│   ├── inventory-selection.ts # Row click and select-all state helpers
│   └── components/
│       ├── Header.tsx        # Profile/project dropdowns, metadata bar
│       ├── StatsCards.tsx     # Gradient stat cards
│       ├── Navigator.tsx     # Path tree with count badges
│       ├── Inventory.tsx     # Secrets table with multi-select
│       ├── DetailPanel.tsx   # Secret detail and action buttons
│       ├── ValueModal.tsx    # Full-screen value overlay
│       ├── EditModal.tsx     # Edit secret value modal
│       ├── CreateSecretModal.tsx # Create new secret modal
│       └── HistoryModal.tsx  # Version history modal with actions
└── shared/
    ├── models.ts             # Shared types
    └── rpc.ts                # API contract (POST /api/<method>)
```
