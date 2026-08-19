# 03 — Widget pure decision core + position/accent drift fix (B6 + A1.5)

**Status:** done
**Type:** AFK
**Lane:** deploylog-widget
**Parent:** deploylog/docs/prd-satellites-hardening.md
**Blocked by:** issues/01-widget-ci-workflow.md (done) · **Human gate: SETTLED 2026-08-18 by Marko** — trim the README to the two real values. No open human gate remains; the slice is mechanical AFK.
**Verification:** contract B6.1-4, A1.5 — data-in/data-out unit tests for merge/unread/parse; position validator rejects/normalizes unknown values. Signal: `vitest run`.

## What to build

Extract the widget's subtlest, wholly-untested decision logic into pure functions (exported like
the existing `normalizeAccent`/`escapeHtml`), so the invariants are pinned without standing up
jsdom + four global stubs. The class keeps the side effects and delegates every decision.

- `mergeConfig(scriptConfig, wc)` — dashboard `widget_config` precedence over script data-attrs,
  with the `accent_color === '#18181b'` "no accent" special-case made explicit (today `data-accent`
  is effectively dead config, finding #7, because the API default always clobbers it — fix the
  precedence so a script-tag accent survives when the dashboard hasn't set one).
- `unreadCount(entries, lastSeen)` — pin the invariants: `entries[0]` is latest, unread =
  `published_at > lastSeen` as ISO-string chronological comparison, `null` lastSeen counts all.
- `parseWidgetData(json)` — malformed 200 body → null (not throw).
- `parseConfig(script)` — validate `data-position` / `data-theme` / `data-accent` instead of `as`
  casts. Resolves the README lie (finding #4): `data-position="top-right"` currently type-checks in
  and silently renders bottom-right. **Direction decision — SETTLED 2026-08-18 by Marko: trim the README.**
  The supported set is `bottom-left` and `bottom-right`, and those two only. Do **not** add top
  positions to `styles.ts` / `types.ts`. Update the README so it documents exactly those two
  values, and make `parseConfig` enforce that set — an unknown `data-position` normalizes to the
  default rather than type-checking in and silently rendering somewhere else.

## Acceptance criteria

- [ ] `mergeConfig`, `unreadCount`, `parseWidgetData`, `parseConfig` are exported pure functions with unit tests (no DOM stubbing for the first three).
- [ ] A script-tag `data-accent` is no longer silently clobbered when the dashboard accent is the `#18181b` default.
- [ ] `unreadCount` tests cover the ISO-string comparison and null-lastSeen-counts-all cases.
- [ ] `parseConfig` rejects or normalizes an unknown `data-position`; README and code agree on the supported set (whichever direction chosen).
- [ ] `vitest run` passes.
