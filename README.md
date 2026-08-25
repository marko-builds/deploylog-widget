# DeployLog Widget

The embeddable changelog widget for [DeployLog](https://deploylog.dev). It is a small,
dependency-free button + panel that shows your latest changelog entries on any site.

- **Tiny:** about 4 KB gzipped, vanilla TypeScript, no framework.
- **Isolated:** renders in a Shadow DOM, so it can't clash with your page's styles.
- **Drop-in:** one script tag, loaded with `defer`, so it never blocks render.

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
| `data-project` | ✅ | none | Your DeployLog project ID. |
| `data-position` | | `bottom-right` | Widget position: `bottom-right` or `bottom-left`. An unsupported value falls back to the default. |
| `data-theme` | | `auto` | `auto` (follows the OS), `light`, or `dark`. |
| `data-accent` | | none | A hex color, leading `#` plus 3 or 6 digits, upper or lower case. It colors entry titles in the panel. Anything else is ignored: the widget falls back to `#18181b`, which it reads as no accent, so titles keep the theme's text color. |
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

- [DeployLog](https://deploylog.dev): the changelog platform
- [CLI](https://www.npmjs.com/package/deploylog) · [GitHub Action](https://github.com/marketplace/actions/publish-to-deploylog)
- [Support](https://github.com/deploylogdev/deploylog/issues)
