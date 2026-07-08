# 01 — Widget CI workflow (B8)

**Status:** done · **Type:** AFK · **Lane:** deploylog-widget
**Parent:** deploylog/docs/prd-satellites-hardening.md
**Blocked by:** None — can start immediately (do first: makes 02-04 tests load-bearing)
**Verification:** contract B8.1 — a PR that breaks any widget test fails the required CI check. Signal: the workflow runs typecheck + vitest and is a required status.

## What to build

Add a CI workflow so the widget's tests actually run on every push/PR. Today the repo's only
GitHub workflow is the release-publish action (`deploylog.yml`), so vitest never runs
automatically — a refactor that loosens the payload guard can ship green to Cloudflare Pages.

- New workflow (e.g. `.github/workflows/ci.yml`) running on push + pull_request: install, then
  `typecheck` + `vitest run` (add the scripts to `package.json` if missing). Optionally gate the
  esbuild bundle build too.
- Keep it minimal and fast; no deploy steps (publish stays in the existing workflow).

## Acceptance criteria

- [ ] A CI workflow runs typecheck + vitest on push and pull_request.
- [ ] A deliberately-broken test causes the workflow to fail (verified once, then reverted).
- [ ] `package.json` has the `typecheck` / `test` scripts the workflow invokes.
