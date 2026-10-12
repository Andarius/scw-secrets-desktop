# Changelog

Earlier releases: [GitHub Releases](https://github.com/Andarius/scw-secrets-desktop/releases).

## 0.10.0 (2026-10-12)

Key/Value secrets save numbers and booleans, and Scaleway's validation errors show up in the app instead of "request failed".

### Features

- **Scaleway validation errors are shown**: when Scaleway rejects a value (400 `invalid_arguments`), the app shows its message, e.g. `invalid value: N: Invalid type. Expected: string, given: integer`. Other upstream failures still read "request failed". (#20)

### Fixes

- **Key/Value secrets accept numbers and booleans**: Scaleway only stores strings in `key_value` secrets, so top-level numbers and booleans are quoted before saving or creating one, keeping their exact digits. `null`, objects and arrays are refused with `Key/Value secrets only accept string values: <keys>`, and the structure editor no longer offers "add section" for these secrets. (#19)

### Dev

- E2E coverage for the Key/Value structure editor and save validation. (#21)
