# 04 — renderEntryHTML + fetchWidgetData seams + hostile-input tests (B7)

**Status:** ready-for-agent · **Type:** AFK · **Lane:** deploylog-widget
**Parent:** deploylog/docs/prd-satellites-hardening.md
**Blocked by:** issues/03-pure-decision-core.md
**Verification:** contract B7.1-2 — hostile-input tests on `renderEntryHTML` (fields escaped, unknown type gated) + fetch-stub tests on `fetchWidgetData` (non-200/malformed → null, never throws). Signal: `vitest run`.

## What to build

Make the widget's XSS boundary and its network "never break the host site" guarantee testable pure
functions.

- `renderEntryHTML(entry): string` — returns the entry innerHTML; `renderEntry` becomes
  `el.innerHTML = renderEntryHTML(entry)`. Contract: `title`, `entry_type`, `version` escaped via
  `escapeHtml`; `body_html` passed through raw on the **documented server-sanitized contract**
  (pinned server-side by deploylog issue 37 — no DOMPurify added, per the <15KB budget decision);
  `KNOWN_ENTRY_TYPES` gated. Add a one-line comment on `body_html` in `types.ts` stating the
  server-sanitized contract (an interface invariant currently living nowhere).
- `fetchWidgetData(apiUrl, projectId): Promise<WidgetData | null>` — URL construction + `res.ok`
  gate + `parseWidgetData` (from issue 03). Leave the subscribe + analytics fetches inline
  (fire-and-forget, trivial).
- **Security posture (do NOT let an agent decide):** whether `data-api-url` needs an origin
  allowlist is a human-only call. **Default: deferred** (the embedder controls their own script tag,
  so an allowlist buys little) — implement one ONLY on Marko's explicit say-so. The AFK core of this
  slice (`renderEntryHTML`, `fetchWidgetData`, the tests) proceeds either way; the allowlist is not
  part of it.

## Acceptance criteria

- [ ] `renderEntryHTML` escapes `title` / `entry_type` / `version` (hostile values do not execute or break out — asserted via a jsdom parse), passes `body_html` through, and gates unknown `entry_type`.
- [ ] `types.ts` documents the `body_html` server-sanitized contract.
- [ ] `fetchWidgetData` returns null on non-200 and on malformed body, parsed data on happy path, and never throws (fetch-stub tests).
- [ ] The `data-api-url` origin-allowlist stays deferred unless Marko explicitly requests it (not an agent decision).
- [ ] `vitest run` passes.
