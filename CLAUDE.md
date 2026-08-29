# deploylog-widget

The embeddable changelog widget for DeployLog: a button plus panel, dropped onto any
site with one script tag, served from `cdn.deploylog.dev` via Cloudflare Pages. One of
three satellites around `../deploylog`.

## Run it

```bash
npm run dev        # local harness in dev/
npm run typecheck
npm test
npm run lint
npm run build      # esbuild IIFE bundle
```

## Shape

`src/` is vanilla TypeScript with no framework and no runtime dependencies. The widget
mounts into a Shadow DOM and reads its configuration from `data-` attributes on its own
script tag. `dev/` is the local page used to look at it.

## Decisions

- **Size is a feature, and it is budgeted.** About 4 KB gzipped today, ceiling 15 KB.
  A dependency that is not worth a measurable slice of that budget is not worth adding.
  This is the reason there is no framework here.
- **Shadow DOM, always.** The widget lands on sites whose CSS we have never seen. Style
  isolation is the whole reason it can be a drop-in.
- **`defer` on the script tag.** It must never block a host page's render; a widget that
  costs the host their Core Web Vitals gets removed.
- **The `data-` attribute surface is a public contract.** Renaming one breaks every
  embed already in the wild, silently. Add attributes; do not repurpose them.

## Conventions

Strict TypeScript, `vitest`, one concern per commit. Test through the mounted widget's
public behaviour rather than its internals - the internals are not the contract.
