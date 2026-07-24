set quiet

# List available recipes
default:
    @just --list

# Install dependencies (frontend toolchain)
[group('setup')]
install:
    bun install

# Desktop app: vite build + native window (Deno 2.9+, backend hot-reload)
[group('dev')]
dev:
    bun run dev

# Frontend HMR on :5181 (proxies /api) + headless deno backend on :8790
[group('dev')]
dev-hmr:
    bun run dev:hmr

# Headless backend only — open http://localhost:8790 in a browser
[group('dev')]
serve:
    deno task serve

# Run mock frontend (Vite only, no backend, sample data) on :5199
[group('dev')]
mock:
    bun run mock

# Vite production build → dist/ (also regenerates src/deno/embed.ts)
[group('build')]
build:
    bun run build

# Linux AppImage → build/linux/ScwSecrets.AppImage
[group('build')]
bundle: build
    deno task bundle

# Linux .deb
[group('build')]
bundle-deb: build
    deno task bundle:deb

# Plain directory bundle (snap source) → build/linux/scw-secrets
[group('build')]
bundle-dir: build
    deno task bundle:dir

# macOS .dmg
[group('build')]
bundle-mac: build
    deno task bundle:mac

# Windows .msi
[group('build')]
bundle-msi: build
    deno task bundle:msi

# Run unit tests (bun test)
[group('test')]
test *args:
    bun test {{ args }}

# Run Playwright e2e tests
[group('test')]
e2e *args:
    bun run test:e2e {{ args }}

# Record e2e test run
[group('test')]
e2e-record:
    bun run test:e2e:record

# TypeScript check (frontend)
[group('check')]
typecheck:
    bun run typecheck

# Type-check the deno backend (needs embed.ts in sync — `just build` regenerates it)
[group('check')]
deno-check:
    deno task check

# Typecheck + deno check + unit tests + e2e
[group('check')]
ci: typecheck build deno-check test e2e

# Update screenshot
[group('tools')]
screenshot:
    bun run screenshot

# Bump version in package.json + deno.json (e.g. just bump patch)
[group('tools')]
bump *args:
    bun run bump {{ args }}

# Clean build artifacts
[confirm('Delete dist/, build/, test-results/, videos/? Continue?')]
[group('tools')]
clean:
    rm -rf dist build test-results videos

# Build .snap package (dir bundle first — snapcraft dumps build/linux/scw-secrets)
[group('snap')]
snap-build: bundle-dir
    snapcraft pack

# Install the locally-built .snap (classic confinement, unsigned)
[group('snap')]
snap-install:
    sudo snap install --dangerous --classic scw-secrets_*.snap

# Download and install the latest GitHub release .snap (or pass tag as arg)
[group('snap')]
snap-install-release tag="latest":
    bin/snap-install-release.sh {{ tag }}

# Build and install in one step
[group('snap')]
snap: snap-build snap-install

# Remove the installed snap
[confirm('Remove the installed scw-secrets snap?')]
[group('snap')]
snap-remove:
    sudo snap remove scw-secrets

# Clean snapcraft build state
[group('snap')]
snap-clean:
    snapcraft clean
