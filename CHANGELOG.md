# Changelog

Earlier releases: [GitHub Releases](https://github.com/Andarius/scw-secrets-desktop/releases).

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
