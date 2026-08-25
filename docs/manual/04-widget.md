---
number: "04"
title: "The widget"
---

# The widget

The widget is two things on your page: the trigger button, a fixed pill in a bottom corner labelled "What's New", and the panel, the dialog of changelog entries it opens.

## The embed

The embed is the script tag on your page plus its `data-` attributes.

```html
<script
  src="https://cdn.deploylog.dev/widget.js"
  data-project="your-project-id"
  defer
></script>
```

The tag loads `widget.js` from the DeployLog CDN with `defer`, so it never blocks render.

- `data-project` is required and carries your project ID, the identifier shown next to the embed snippet on the project's settings page; without it no widget mounts and the script writes one warning to the console.
- `data-position` defaults to `bottom-right`; `bottom-left` is the only other accepted value, and anything else falls back to `bottom-right`.
- `data-theme` defaults to `auto`; `light` and `dark` pin the theme, and an unrecognised value falls back to `auto`.
- `data-accent` takes a 3- or 6-digit hex colour and colours entry titles in the panel; anything else is ignored, and titles keep the theme's text colour.
- `data-api-url` defaults to `https://deploylog.dev`. It exists for DeployLog's own testing; leave it out.

Use a classic script tag. A module script never initialises: it logs one warning and stops. Drop a second copy of the tag on the same page and the second run is a silent no-op, so exactly one widget mounts.

## The button and the panel

The trigger button is dark on the light theme and light on the dark theme, always. The accent never touches it; it colours entry titles inside the panel and nothing else.

The unread badge is the red count on the button, and it counts entries published after the last time this browser opened the panel. Ten or more unread entries render as `9+`.

Clicking the button toggles the panel: open, then closed. Escape closes it while it is open. So does the close control in the panel header. On open, focus moves to that close control; on close, focus returns to the button.

Each entry shows a title, an optional type badge, an optional version badge (the version is the release number you gave the entry), a date and the body. Five entry types get a coloured badge: `feature`, `fix`, `improvement`, `breaking` and `announcement`. Any other type renders as a plain badge with no colour. Dates format in the visitor's locale.

The whole thing renders inside a closed shadow root, an isolated DOM subtree: your page CSS cannot restyle the widget, and the widget's CSS cannot leak into your page.

## Where appearance comes from

Widget config is the appearance saved in the Widget Appearance section of the project's settings page: position, theme and accent. The widget merges it over the script attributes on every load, so the dashboard wins, not the script tag. A valid saved position or theme overrides the attributes, which hold only until the dashboard has set one.

The accent is the exception. The dashboard's neutral default colour means "no accent", so a colour from the script tag survives it; only a custom saved colour overrides the script.

Only two positions exist, both at the bottom. Any other value, from the script tag or the dashboard, falls back to the bottom right corner. Auto theme means the widget follows the visitor's OS colour scheme, and it re-resolves when the OS flips between light and dark; an unknown theme value falls back to auto theme.

## What it loads, and when

The widget fetches the changelog feed, the list of your published entries, once, on mount, from `/api/widget-data` with your project ID. It never polls and never refreshes. Publish an entry and a visitor with the page already open sees it on their next page load.

A feed that fails to load surfaces no error. The button still appears, clicking it does nothing, and nothing is written to the console.

## Unread state

Unread is per browser, not per account. The last-seen time lives in the visitor's browser storage under a key that ends in the project ID. Another browser, or cleared storage, starts with everything unread.

Opening the panel marks everything seen at once, up to the newest entry. There is no per-entry read state.

## Empty changelog

An empty changelog still shows the button, with no badge. The panel reads "No updates yet. Check back soon!", followed by the subscribe form, and on the free plan the footer link.

## The subscribe form, the footer and views

The email subscribe form always appears at the bottom of the panel; no attribute hides it.

The footer link inviting visitors to create their own changelog appears on the free plan only, and no attribute switches it off.

Each entry rendered in an opened panel counts as one view, once per page load.
