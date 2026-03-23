# Scw Secrets Desktop

An Electrobun desktop client for browsing Scaleway Secret Manager with a Bun main process and a React workspace.

## Getting Started

```bash
# Install dependencies
bun install

# Development with HMR (recommended)
bun run dev:hmr

# Build the webview assets
bun run build

# Type-check the app
bun run typecheck
```

The app uses the published `electrobun` package. The local checkout at
`/home/julien/Projects/explore-libs/electrobun` is still useful as a reference repo for templates and examples.

After changing the dependency, run:

```bash
bun install
```

## Current Scope

- profile discovery from `~/.config/scw/config.yaml` and environment variables
- project loading from the Scaleway account API
- secrets inventory browsing for the selected project
- browse-first three-pane UI with path navigation and detail metadata

## Project Structure

```
├── src/
│   ├── bun/
│   │   ├── index.ts        # Electrobun main process and RPC handlers
│   │   └── scw.ts          # Scaleway config parsing and API client
│   └── mainview/
│       ├── App.tsx         # React application shell
│       ├── rpc.ts          # Typed Electrobun webview RPC setup
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # Tailwind entry + custom theme
│   └── shared/
│       ├── models.ts       # Shared app types
│       └── rpc.ts          # Shared RPC contract
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Next Layer

- reveal the latest secret value on demand
- copy with clipboard timeout
- rotate and version management
- pinned paths and local preferences
