// `accent` is the dashboard-configured accent color. It is only passed when the
// user has set a non-default color (the neutral default is treated as "follow
// the theme"), so entry titles stay readable in both light and dark by default.
export function getStyles(theme: 'light' | 'dark', accent?: string): string {
  const bg = theme === 'dark' ? '#18181b' : '#ffffff'
  const bgHover = theme === 'dark' ? '#27272a' : '#f4f4f5'
  const border = theme === 'dark' ? '#3f3f46' : '#e4e4e7'
  const text = theme === 'dark' ? '#fafafa' : '#18181b'
  const textMuted = theme === 'dark' ? '#a1a1aa' : '#71717a'
  const triggerBg = theme === 'dark' ? '#fafafa' : '#18181b'
  const triggerText = theme === 'dark' ? '#18181b' : '#fafafa'

  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: ${text};
      ${accent ? `--dl-accent: ${accent};` : ''}
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .dl-trigger {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border: none;
      border-radius: 24px;
      background: ${triggerBg};
      color: ${triggerText};
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .dl-trigger:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }

    .dl-trigger:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .dl-trigger--br { bottom: 20px; right: 20px; }
    .dl-trigger--bl { bottom: 20px; left: 20px; }

    .dl-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: #ef4444;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
    }

    .dl-panel {
      position: fixed;
      z-index: 2147483647;
      width: 380px;
      max-height: 520px;
      border-radius: 12px;
      background: ${bg};
      border: 1px solid ${border};
      box-shadow: 0 16px 48px rgba(0,0,0,0.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: dl-slide-in 0.2s ease;
    }

    .dl-panel--br { bottom: 72px; right: 20px; }
    .dl-panel--bl { bottom: 72px; left: 20px; }

    @keyframes dl-slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dl-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid ${border};
      font-weight: 600;
      font-size: 14px;
    }

    .dl-close {
      background: none;
      border: none;
      color: ${textMuted};
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 18px;
      line-height: 1;
      font-family: inherit;
    }

    .dl-close:hover { color: ${text}; background: ${bgHover}; }
    .dl-close:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

    .dl-entries {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .dl-entry {
      padding: 14px 16px;
      border-bottom: 1px solid ${border};
    }

    .dl-entry:last-child { border-bottom: none; }

    .dl-entry-header {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .dl-entry-title {
      font-weight: 600;
      font-size: 13px;
      /* Uses the configured accent when set; falls back to the theme text
         color so default (un-customized) widgets stay readable in dark mode. */
      color: var(--dl-accent, ${text});
    }

    .dl-entry-type {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .dl-type-feature { background: #dbeafe; color: #1d4ed8; }
    .dl-type-fix { background: #ffedd5; color: #c2410c; }
    .dl-type-improvement { background: #f3e8ff; color: #7e22ce; }
    .dl-type-breaking { background: #fee2e2; color: #dc2626; }
    .dl-type-announcement { background: #fef9c3; color: #a16207; }

    .dl-entry-version {
      font-size: 11px;
      color: ${textMuted};
      background: ${bgHover};
      padding: 1px 6px;
      border-radius: 4px;
    }

    .dl-entry-date {
      font-size: 11px;
      color: ${textMuted};
      margin-top: 4px;
    }

    .dl-entry-body {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.5;
      color: ${textMuted};
    }

    .dl-entry-body h1, .dl-entry-body h2, .dl-entry-body h3 {
      font-size: 13px;
      font-weight: 600;
      color: ${text};
      margin: 8px 0 4px;
    }

    .dl-entry-body p { margin: 4px 0; }
    .dl-entry-body ul, .dl-entry-body ol { padding-left: 18px; margin: 4px 0; }
    .dl-entry-body code {
      background: ${bgHover};
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    .dl-entry-body pre {
      background: ${bgHover};
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 6px 0;
    }
    .dl-entry-body a { color: #3b82f6; }

    .dl-empty {
      padding: 32px 16px;
      text-align: center;
      color: ${textMuted};
      font-size: 13px;
    }

    .dl-footer {
      padding: 10px 16px;
      border-top: 1px solid ${border};
      font-size: 11px;
      text-align: center;
    }

    .dl-footer a {
      color: ${textMuted};
      text-decoration: none;
    }

    .dl-footer a:hover { color: ${text}; }

    .dl-subscribe {
      padding: 12px 16px;
      border-top: 1px solid ${border};
    }

    .dl-subscribe-form {
      display: flex;
      gap: 6px;
    }

    .dl-subscribe-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid ${border};
      border-radius: 6px;
      font-size: 12px;
      background: ${bg};
      color: ${text};
      font-family: inherit;
    }

    .dl-subscribe-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
    }

    .dl-subscribe-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: ${triggerBg};
      color: ${triggerText};
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }

    .dl-subscribe-btn:hover { opacity: 0.9; }
    .dl-subscribe-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .dl-subscribe-msg {
      font-size: 12px;
      color: ${textMuted};
      margin-top: 6px;
    }

    .dl-subscribe-msg--error { color: #ef4444; }

    @media (max-width: 420px) {
      .dl-panel { width: calc(100vw - 24px); right: 12px !important; left: 12px !important; }
    }
  `
}
