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

## Scaleway API Reference

When working on API-related features, refer to:
- **Web docs**: https://www.scaleway.com/en/developers/api/secret-manager/ (client-rendered, may not be scrapable)
- **Go SDK source** (most reliable): https://raw.githubusercontent.com/scaleway/scaleway-sdk-go/master/api/secret/v1beta1/secret_sdk.go

There is no public OpenAPI spec. The Go SDK file contains all endpoint paths, request/response types, and supported fields.

## Commands

- `bun run dev` — Start Electrobun in dev mode
- `bun run dev:hmr` — Start with Vite HMR
- `bun run build` — Vite production build
- `bun run typecheck` — TypeScript check (`tsc --noEmit`)
