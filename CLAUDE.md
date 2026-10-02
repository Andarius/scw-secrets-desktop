# CLAUDE

This is a desktop UI for managing Scaleway secrets.
## Project

- **Name**: SCW Secrets Desktop
- **Stack**: Deno desktop (Deno 2.9+), React, TypeScript, Tailwind CSS 3, Vite, Bun (frontend tooling)
- **Runtime**: Deno (backend, in-process HTTP server + native window), webkit webview (frontend)

## Structure

- `src/mainview/` — React frontend entry (App.tsx, main.tsx, index.html)
- `src/mainview/assets/` — global styles (index.css: Tailwind layers)
- `src/mainview/lib/` — frontend logic: API client (rpc.ts), settings, value parsing, secret list/version helpers
- `src/mainview/mock/` — mock mode (`just mock`): MockApp sample data and the inert mock API
- `src/mainview/components/` — UI components, grouped by role:
  - `layout/` — Header, PaneRail, StatsCards, UpdateBanner
  - `panels/` — the three main columns: Navigator, Inventory, DetailPanel
  - `modals/` — dialogs, including ValueModal (view/edit a secret value)
  - `secret-value/` — value rendering and editing (ValueViewer, ValueStructureEditor)
  - `inputs/` — reusable inputs (HeaderSelect, HighlightedTextarea, KeyFilterInput)
  - `search/` — SpotlightSearch
- `src/mainview/hooks/` — React hooks, one per file (`useXxx.ts`)
- `src/deno/` — Deno backend (main.ts entrypoint, Scaleway API calls, generated embed.ts)
- `src/shared/` — Shared types (models.ts) and API contract (rpc.ts, POST /api/<method>)
- `src/types/` — TypeScript type declarations

## Scaleway API Reference

When working on API-related features, refer to:
- **Web docs**: https://www.scaleway.com/en/developers/api/secret-manager/ (client-rendered, may not be scrapable)
- **Go SDK source** (most reliable): https://raw.githubusercontent.com/scaleway/scaleway-sdk-go/master/api/secret/v1beta1/secret_sdk.go

There is no public OpenAPI spec. The Go SDK file contains all endpoint paths, request/response types, and supported fields.

## Commands

The `justfile` abstracts the bun (frontend toolchain) / deno (app runtime) split — `just --list` for everything.

- `just dev` — Vite build + desktop window (`deno desktop`)
- `just dev-hmr` — Vite dev server (5181, proxies /api) + headless deno backend (8790)
- `just mock` — browser preview with sample data (5199)
- `just bundle` — Linux AppImage (build/linux/)
- `just ci` — typecheck + deno check + unit tests + e2e
