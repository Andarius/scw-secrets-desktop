# GPUIX POC

Read-only port of the SCW Secrets main screen: header with profile/project selects, stats cards, Paths tree,
Inventory table (search, status/tag/type filters, sorting, multi-select), Detail panel and the value view
(Table/Formatted/TOML/Raw, key filter).

Exploration only, not for merge. Verdict: keep Tauri. gpuix uses less memory but needs a full UI rewrite, and the
stack is pre-1.0 (hermes-node has no Windows build).

- UI: React rendered by GPUI through `@gpuix/react` 0.10.0 (no webview, no DOM). Views are rewritten in `ui/`;
  filtering, sorting, selection and value parsing reuse `src/mainview/lib/` unchanged.
- Backend: a Node-API addon (`native/`) that compiles `src-tauri/src/{scw,profiles,rpc}.rs` unchanged and only
  accepts `getProfiles`, `getProjects`, `getSecrets`, `getSecretValue`, `getActiveVersionCounts`.
- Sample mode uses the same data as the app's mock mode.

## Run

```bash
(cd ../.. && bun install --frozen-lockfile)   # src/mainview/lib needs smol-toml
bun install --frozen-lockfile
bun run native                      # build the Rust addon into scw-native.node
SCW_GPUIX_SAMPLE=1 bun app.tsx      # sample data; drop the variable for real Scaleway profiles
bun e2e.ts                          # automation checks (opens a window)
bun web/serve.ts & bun web/shot.ts out/ click:500,550 shot:home   # WASM build in headless Chromium
bun run build && ./dist/scw-secrets # standalone binary on Bun (140 MB)
# build:hermes needs github.com/tmikov/hermes-node v0.0.2 linux-x64 extracted in hermes/ (or HERMES_NODE=path)
# macOS: build hermes-node v0.0.2 from source without -Wl,-dead_strip (tools/hermes-node/CMakeLists.txt), then
# HERMES_NODE=<build>/bin/hermes-node HERMES_KIT=<build>/kit bun run build:hermes
bun run build:hermes && ./dist-hermes/scw-secrets  # on hermes-node: exe + 2 .node files beside it (55 MB)
APP_BINARY=$PWD/dist-hermes/scw-secrets bun e2e.ts
# headless (no desktop): run the e2e inside a virtual KWin; add VK_ICD_FILENAMES=.../lvp_icd.json for software Vulkan
kwin_wayland --virtual --no-lockscreen --socket wayland-e2e & WAYLAND_DISPLAY=wayland-e2e bun e2e.ts
cd native && RUSTC_WRAPPER= cargo test --release
```

## Results (Linux x64, Rust 1.99.0, Bun 1.4.0)

| | GPUIX + Rust addon | Tauri 2 (earlier runs, same machine) |
|---|---:|---:|
| Rust cold release build | 21.9 s | 134–238 s |
| Rust build after a one-line `scw.rs` edit | 1.7 s | 23–36 s |
| Rust crates (deps tree) | 157 | 333 |
| Shipped binary | 140 MB (Bun 82 + renderer 50 + addon 6) | 18.4 MB |

## Findings

- `bun build --compile` does not embed the GPUIX renderer; `main.ts` embeds it and sets
  `NAPI_RS_NATIVE_LIBRARY_PATH`.
- No webview: the existing DOM/Tailwind components cannot be reused; the UI is a rewrite.
- No `Button` export in 0.10.0 and no JS clipboard API; a Copy button needs native code.
- Linux headless: no render under Xvfb, nor on a locked desktop session (no frames). A virtual KWin
  (`kwin_wayland --virtual`) renders, with the GPU or lavapipe, and the e2e passes there. The WASM build (`web/`)
  also renders in headless Chromium (WebGL2 on SwiftShader) for layout screenshots.
- No Bun at runtime: `hermes/` bundles the app to CJS and runs it on hermes-node 0.0.2 (Hermes JS engine, 11.6 MB).
  Hermes has no `import()`, so the automation client's builtin imports become `require()`, and the napi-rs loader is
  replaced by `process.dlopen`: a hermes-node executable refuses to `require()` a `.node` outside its bundle.
  The addon's `dist` Cargo profile (LTO, `opt-level = "s"`, stripped; panics still unwind) is 2.7 MB vs 5.8 MB.
- Shipped size and requirements (Linux x64):

  | | Size | Compressed | glibc |
  |---|---:|---:|---:|
  | Bun build | 140 MB | | 2.39 |
  | Hermes build (exe 15 + renderer 37 + addon 2.7) | 55 MB | 15.6 MB `.tar.xz` | 2.39 (renderer) |
  | Tauri 0.11.0 binary / AppImage / snap | 18.5 / 83.7 / 140 MB | | 2.34 |

- Idle footprint after loading the same real project, each app alone in a virtual KWin, sampled 30 s:

  | | Processes | PSS | RSS | Idle CPU | Start to first mount |
  |---|---:|---:|---:|---:|---:|
  | Tauri 0.11.0 | 3 | 281 MiB | 493 MiB | 0.0 % | |
  | gpuix on Bun | 1 | 241 MiB | 338 MiB | 1.5 % | 635 ms |
  | gpuix on Hermes | 1 | 219 MiB | 308 MiB | 1.3 % | 582 ms |
- Idle CPU was gpuix's 8 ms JS timer polling `tick()`, which off macOS only detects the last window closing.
  `app.tsx` polls every 250 ms instead: Hermes idle CPU 1.3 % → 0.27 %, the rest is GPUI's UI thread.
- Memory with the test compositor on Intel (like the desktop), real project: Tauri 279 MiB, Hermes 180 MiB. Both load
  the NVIDIA driver while listing GPUs; skipping it (`VK_LOADER_DRIVERS_SELECT='*intel*'`, Mesa-only
  `__EGL_VENDOR_LIBRARY_FILENAMES`) gives Tauri 256 MiB and Hermes 134 MiB. Machine-specific, so not set by the app.
- Tauri packages, same setup (heap / total PSS, total swings under memory pressure): binary 150 / 273–297 MiB,
  AppImage 141–158 / 305–331 MiB, snap 139–143 / 265 MiB; Hermes 93 / 137–209 MiB. All idle at 0.03–0.1 % CPU.
- macOS (M2 Pro, macOS 26.6.1), real project: Tauri .app 100–106 MiB footprint, 0.2–1.4 % idle CPU; Hermes 72–80 MiB,
  2.2–2.5 % (the 8 ms loop pumps AppKit). Hermes build: 33 MB (exe 13.8 + renderer 18.6 + addon 2.4), 10.5 MB
  `.tar.xz`, unsigned; Tauri .app 15 MB, 5.2 MB zip. Cold Rust build: Tauri 44 s, addon 23 s. e2e passes on both runtimes.
- Not ported: writes (create, edit, history, duplicate, share, delete, cleanup; shown disabled), copy buttons (no
  clipboard API), Spotlight search, keyboard shortcuts, settings/logs, the JSON tree in "Formatted" (plain JSON).
- GPUI gaps worked around: no letter-spacing, no vertical text (pane rails stack letters), no auto-width table
  columns (fixed widths; value keys sized from the monospace advance).
