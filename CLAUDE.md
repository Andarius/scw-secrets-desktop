# CLAUDE

This is a desktop UI for managing Scaleway secrets.
## Project

- **Name**: SCW Secrets Desktop
- **Stack**: Electrobun, React, TypeScript, Tailwind CSS 3, Vite, Bun
- **Runtime**: Bun (backend/main process), Chromium webview (frontend)

## Structure

- `src/mainview/` — React frontend entry (App.tsx, main.tsx, index.css, index.html)
- `src/mainview/components/` — UI components (Header, StatsCards, Navigator, Inventory, DetailPanel)
- `src/bun/` — Bun backend (Electrobun main process, Scaleway API calls)
- `src/shared/` — Shared types (models.ts) and RPC contract (rpc.ts)
- `src/types/` — TypeScript type declarations

## Commands

- `bun run dev` — Start Electrobun in dev mode
- `bun run dev:hmr` — Start with Vite HMR
- `bun run build` — Vite production build
- `bun run typecheck` — TypeScript check (`tsc --noEmit`)
