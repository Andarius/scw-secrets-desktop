# CLAUDE

This is a desktop UI for managing Scaleway secrets.
## Project

- **Name**: SCW Secrets Desktop
- **Stack**: Deno desktop (Deno 2.9+), React, TypeScript, Tailwind CSS 3, Vite, Bun (frontend tooling)
- **Runtime**: Deno (backend, in-process HTTP server + native window), webkit webview (frontend)

## Structure

- `src/mainview/` — React frontend entry (App.tsx, main.tsx, index.css, index.html)
- `src/mainview/components/` — UI components (Header, StatsCards, Navigator, Inventory, DetailPanel)
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
