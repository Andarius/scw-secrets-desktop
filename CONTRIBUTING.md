# Contributing

## Issues

Include the app version, OS, install method (snap, AppImage, .dmg, source) and steps to reproduce. Never paste
secret values, API keys or the `#token=...` launch URL.

Open an issue to discuss before starting a large feature or a change to the local API.

## Setup

Requires [Bun](https://bun.sh) 1.3+, [Deno](https://deno.com) 2.9+ and [just](https://github.com/casey/just).

```bash
just install    # bun install
just dev        # desktop window
just mock       # browser preview with sample data, no Scaleway account needed (port 5199)
```

Run `just` to list all recipes.

## Checks

CI runs these on every PR; run them before opening one:

```bash
just ci         # typecheck + build + deno check + unit tests + e2e
```

E2E tests run Playwright against mock mode; install the browser once with `bunx playwright install chromium`. On a
PR, CI runs them only once a maintainer adds the `e2e` label; the run records every test into a single video and
links it in a PR comment (`bun run test:e2e:record` produces the same `videos/e2e.mp4` locally, needs ffmpeg).

## Guidelines

- UI behavior changes come with a Playwright test in `tests/e2e/`; logic in `src/mainview/lib/` and `src/deno/`
  comes with unit tests.
- Changes to the local API checks (`src/deno/http.ts`) must be covered in `tests/deno/http.test.ts`.
- Don't commit generated files: `src/deno/embed.ts` is rebuilt by `just build`.
- Update `README.md` for user-facing changes.

## Pull requests

- Title in [Conventional Commits](https://www.conventionalcommits.org/) form (`feat:`, `fix:`, `refactor:`, ...).
- Keep the description short: what changed and why.

## Use of AI

AI tools are welcome; `AGENTS.md` gives them the repo's commands and rules. You remain responsible for your change:
you must understand it and explain it in your own words, in the PR body and in review replies.

## Releases

Releases are cut by maintainers: `just bump <patch|minor|major|x.y.z>` bumps `package.json` and `deno.json`, commits
and tags `v<version>`. Pushing the tag runs the `Release` workflow, which checks the tag matches `package.json` and
builds a draft GitHub release.
