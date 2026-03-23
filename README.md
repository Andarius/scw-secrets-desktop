# SCW Secrets Desktop

Desktop app for browsing and managing [Scaleway Secret Manager](https://www.scaleway.com/en/secret-manager/) secrets.

Built with [Electrobun](https://electrobun.dev), React, TypeScript, and Tailwind CSS.

![SCW Secrets Desktop](docs/screenshot.png)

## Features

- **Profile & project switching** — reads `~/.config/scw/config.yaml` and environment variables
- **Path navigator** — browse secrets organized by path hierarchy
- **Secrets inventory** — searchable table with status and version badges, filter by status
- **Multi-select** — shift+click for range, ctrl+click to toggle, batch operations
- **View secret values** — single or batch, displayed in a full-screen overlay with copy support
- **Copy as KEY=VALUE** — batch-copy selected secrets for `.env` files
- **Version history** — view all versions of a secret with revision, status, and timestamps
- **Manage secret** — opens the Scaleway console for the selected secret
- **Delete secrets** — single or batch delete with confirmation

## Setup

```bash
bun install
```

## Development

```bash
bun run dev          # Electrobun dev mode
bun run dev:hmr      # Electrobun + Vite HMR
bun run mock         # Browser preview with mock data (port 5199)
```

## Build

```bash
bun run build        # Vite production build
bun run typecheck    # TypeScript check
```

## Project Structure

```
src/
├── bun/
│   ├── index.ts              # Electrobun main process and RPC handlers
│   └── scw.ts                # Scaleway config parsing and API client
├── mainview/
│   ├── App.tsx               # React application shell
│   ├── rpc.ts                # Typed Electrobun webview RPC setup
│   ├── main.tsx              # React entry point
│   └── components/
│       ├── Header.tsx        # Profile/project dropdowns, metadata bar
│       ├── StatsCards.tsx     # Gradient stat cards
│       ├── Navigator.tsx     # Path tree with count badges
│       ├── Inventory.tsx     # Secrets table with multi-select
│       ├── DetailPanel.tsx   # Secret detail, actions, version history
│       └── ValueModal.tsx    # Full-screen value overlay
└── shared/
    ├── models.ts             # Shared types
    └── rpc.ts                # RPC contract
```
