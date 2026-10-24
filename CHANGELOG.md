# Changelog

Earlier releases: [GitHub Releases](https://github.com/Andarius/scw-secrets-desktop/releases).

## 0.12.0 (2026-10-23)

Release assets are signed and the updater verifies them before installing. The macOS app is signed and notarized, and the snap is much smaller.

### Features

- **Signed releases**: every release asset ships with a minisign signature. The in-app updater, `bin/quickstart.sh` and `bin/snap-install-release.sh` refuse an asset whose signature doesn't match the embedded key or names another version or file. Apps on 0.11.0 and earlier don't verify; updates from 0.12.0 on do. (#31)
- **Signed and notarized macOS app**: the .app is signed with a Developer ID certificate and notarized, so Gatekeeper opens it without the quarantine workaround. (#31)

### Fixes

- **Crafted TOML secrets can't freeze the viewer**: `smol-toml` 1.9.1 fixes a quadratic parse (GHSA-r4xh-jqrq-34v2). The scw config is now read with `serde-saphyr` instead of the unmaintained `serde_yaml`, and dependencies are refreshed past known advisories. (#30)
- **Smaller snap**: the snap no longer bundles WebKitGTK libraries it never loaded, going from 140 MB to 4.5 MB (491 MB to 18 MB installed). It runs on the system WebKitGTK 4.1 as before; the README lists it as a requirement and the quickstart warns when it's missing. (#28)

### Dev

- CI caches the Rust build, and the snap job reuses the Linux binary from the AppImage build instead of recompiling it. The snapcraft image is pinned by digest. (#26)
- Release builds restore a Rust cache warmed from `master` by `warm-release-cache.yml`. (#29)
- CI runs an `audit` job (`bun audit` + `cargo deny check advisories`), also available as `just audit`. (#30)

## 0.11.0 (2026-10-13)

The desktop runtime moves from Deno to Tauri 2 with a Rust backend. The UI, features and update flow stay the same.

### Features

- **Tauri 2 runtime**: Scaleway calls, credentials and self-updates now live in a Rust backend that the UI reaches over Tauri IPC, not a local HTTP server. Profiles and the saved window size carry over; UI preferences start fresh because the WebView storage origin changed. (#24)
- **Native clipboard**: copies go through the Tauri clipboard plugin. Secret values still clear after 45 seconds unless the clipboard has changed since. (#24)

### Fixes

- **Updates only replace this app's AppImage**: the updater trusts `$APPIMAGE` only when the running binary sits inside that AppImage's mount, so a .deb build launched from another AppImage can't overwrite it. (#24)
- **Projects, profiles and secrets sort case-insensitively**, as before. (#24)

### Dev

- Rust 1.99 is pinned in `rust-toolchain.toml`, and CI runs clippy with `-D warnings` and the Rust tests. (#24)
- The Tauri version comes from `package.json`, and the release workflow also checks `Cargo.toml` against the tag. (#24)

## 0.10.0 (2026-10-12)

Key/Value secrets save numbers and booleans, and Scaleway's validation errors show up in the app instead of "request failed".

### Features

- **Scaleway validation errors are shown**: when Scaleway rejects a value (400 `invalid_arguments`), the app shows its message, e.g. `invalid value: N: Invalid type. Expected: string, given: integer`. Other upstream failures still read "request failed". (#20)

### Fixes

- **Key/Value secrets accept numbers and booleans**: Scaleway only stores strings in `key_value` secrets, so top-level numbers and booleans are quoted before saving or creating one, keeping their exact digits. `null`, objects and arrays are refused with `Key/Value secrets only accept string values: <keys>`, and the structure editor no longer offers "add section" for these secrets. (#19)

### Dev

- E2E coverage for the Key/Value structure editor and save validation. (#21)
