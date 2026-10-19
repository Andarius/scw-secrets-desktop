set quiet

# List available recipes
default:
    @just --list

# Install dependencies (frontend toolchain)
[group('setup')]
install:
    bun install

# Tauri desktop app with frontend HMR
[group('dev')]
dev:
    bun run dev

# Run mock frontend (Vite only, no backend, sample data) on :5199
[group('dev')]
mock:
    bun run mock

# Vite production build → dist/
[group('build')]
build:
    bun run build

# Native desktop bundles → src-tauri/target/release/bundle/
[group('build')]
bundle:
    bun run bundle

# Linux .deb
[group('build')]
bundle-deb:
    bun run tauri build --bundles deb

# Stage the Linux binary for snapcraft
[group('build')]
bundle-dir:
    bun run tauri build --no-bundle
    mkdir -p build/linux/scw-secrets
    cp src-tauri/target/release/scw-secrets build/linux/scw-secrets/
    cp icon.png build/linux/scw-secrets/AppIcon.png

# macOS .app and .dmg
[group('build')]
bundle-mac:
    bun run tauri build --bundles app,dmg

# Windows .msi
[group('build')]
bundle-msi:
    bun run tauri build --bundles msi

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

# Rust formatting, lint and unit tests
[group('check')]
rust-check:
    cargo fmt --manifest-path src-tauri/Cargo.toml --check
    cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
    cargo test --manifest-path src-tauri/Cargo.toml --locked

# Known-advisory scan of npm and Rust dependencies (needs cargo-deny)
[group('check')]
audit:
    bun audit --ignore=GHSA-vfj7-8cjw-p6xm --ignore=GHSA-rj75-hqrm-r3gf
    cargo deny --manifest-path src-tauri/Cargo.toml check advisories

# Frontend and Rust checks, unit tests and e2e
[group('check')]
ci: typecheck build rust-check test e2e

# Update screenshot
[group('tools')]
screenshot:
    bun run screenshot

# Bump frontend and Rust package versions (e.g. just bump patch)
[group('tools')]
bump *args:
    bun run bump {{ args }}

# Clean build artifacts
[confirm('Delete dist/, build/, src-tauri/target/, test-results/, videos/? Continue?')]
[group('tools')]
clean:
    rm -rf dist build src-tauri/target test-results videos

# Build .snap package from the staged Linux binary
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
