# DeployLog Widget

The embeddable changelog widget for [DeployLog](https://deploylog.dev) — a small,
dependency-free button + panel that shows your latest changelog entries on any site.

- **Tiny:** ~4 KB gzipped, vanilla TypeScript, no framework.
- **Isolated:** renders in a Shadow DOM, so it can't clash with your page's styles.
- **Drop-in:** one script tag, loaded with `defer` — it never blocks render.

## Install

Add one script tag, using your project ID from the DeployLog dashboard:

```html
<script
  src="https://cdn.deploylog.dev/widget.js"
  data-project="your-project-id"
  defer
></script>
```

## Configuration

Configure via `data-` attributes on the script tag:

| Attribute | Required | Default | Description |
| --- | :--: | --- | --- |
| `data-project` | ✅ | — | Your DeployLog project ID. |
| `data-position` | | `bottom-right` | Widget position: `bottom-right`, `bottom-left`, `top-right`, `top-left`. |
| `data-theme` | | `auto` | `auto` (follows the OS), `light`, or `dark`. |
| `data-api-url` | | `https://deploylog.dev` | Override the API base (self-hosted / staging). |

## Development

```bash
npm install
npm run dev        # esbuild dev server with live reload
npm run build      # minified IIFE bundle → dist/widget.js
npm run typecheck
npm run lint
```

The production bundle (`dist/widget.js`) is served from `cdn.deploylog.dev` (Cloudflare Pages).

## Links

- [DeployLog](https://deploylog.dev) — the changelog platform
- [CLI](https://www.npmjs.com/package/deploylog) · [GitHub Action](https://github.com/marketplace/actions/publish-to-deploylog)
- [Support](https://github.com/deploylogdev/deploylog/issues)
