# 02 — Widget crash-safety pass: head-embed, Safari-13, double-init, currentScript (A1)

**Status:** ready-for-agent · **Type:** AFK · **Lane:** deploylog-widget
**Parent:** deploylog/docs/prd-satellites-hardening.md
**Blocked by:** issues/01-widget-ci-workflow.md
**Verification:** contract A1.2-4 — red-first tests: head-embed does not throw, Safari-13-class env still mounts, double-embed yields one instance. Signal: `vitest run` + esbuild build with an explicit target.

## What to build

Net-new defects from the 2026-07-07 review (NOT in the 2026-07-02 security audit). The widget's
own fail-quiet contract is currently violated by four crash/UX paths. Bundle them: all are small,
same file (`src/widget.ts`), same theme ("never break the host page").

- **Head-embed crash (#2):** `mount()` calls `document.body.appendChild` with no readiness check
  and `init()` runs bare at top level. Guard on `document.readyState` / `DOMContentLoaded` and wrap
  the top-level IIFE in try/catch so a `<head>` embed without `defer` fails quiet, not with an
  uncaught TypeError on the host page.
- **Safari-13 crash (#9):** `matchMedia(...).addEventListener('change', …)` throws on Safari
  13.1-13.7 (no `MediaQueryList.addEventListener`). Feature-guard (fallback to `addListener` or
  skip) and set an esbuild `--target` so the bundle doesn't ship syntax older Safari can't parse.
- **Double-init (#3):** the `deploylog-widget` id is set but never queried and there's no window
  flag. A SPA/GTM double-execution stacks two triggers/panels + duplicate listeners + double
  analytics. Add a guard (query the id or set a window flag) so a second execution is a no-op.
- **currentScript-null (#8):** silent bare return when `document.currentScript` is null (module
  script / tag-manager eval). Warn (consistent with the adjacent missing-`data-project` path)
  instead of failing silently.

## Acceptance criteria

- [ ] Head-embed without `defer` does not throw on the host page (test via jsdom with body not-yet-parsed / a readyState stub); the top-level init is wrapped so any throw is swallowed per the fail-quiet contract.
- [ ] A Safari-13-class environment (no `MediaQueryList.addEventListener`) still mounts and renders the trigger; no uncaught TypeError. esbuild build sets an explicit `--target`.
- [ ] Executing the embed twice yields exactly one trigger/panel, one keydown + one matchMedia listener, one fetch, one analytics view.
- [ ] Null `currentScript` emits a console warning, not a silent return.
- [ ] `vitest run` + the esbuild build pass.
