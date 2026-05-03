set quiet

# List available recipes
default:
    @just --list

# Install dependencies
[group('setup')]
install:
    bun install

# Start Electrobun in dev mode (watch)
[group('dev')]
dev:
    bun run dev

# Start with Vite HMR (concurrent)
[group('dev')]
dev-hmr:
    bun run dev:hmr

# Run mock frontend (Vite only, no Electrobun)
[group('dev')]
mock:
    bun run mock

# Vite production build
[group('build')]
build:
    bun run build

# Build canary release
[group('build')]
build-canary:
    bun run build:canary

# Build stable release
[group('build')]
build-stable:
    bun run build:stable

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

# TypeScript check
[group('check')]
typecheck:
    bun run typecheck

# Typecheck + unit tests + e2e
[group('check')]
ci: typecheck test e2e

# Update screenshot
[group('tools')]
screenshot:
    bun run screenshot

# Bump version (e.g. just bump patch)
[group('tools')]
bump *args:
    bun run bump {{ args }}

# Clean build artifacts
[confirm('Delete dist/, build/, artifacts/, test-results/? Continue?')]
[group('tools')]
clean:
    rm -rf dist build artifacts test-results videos

# Build .snap package (runs a stable electrobun build first)
[group('snap')]
snap-build:
    bun run build:stable
    snapcraft pack

# Install the locally-built .snap (classic confinement, unsigned)
[group('snap')]
snap-install:
    sudo snap install --dangerous --classic scw-secrets_*.snap

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
