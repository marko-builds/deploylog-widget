import { getStyles } from './styles'
import type { WidgetConfig, WidgetData, Entry } from './types'

const DEFAULT_API_URL = 'https://deploylog.dev'
const STORAGE_KEY_PREFIX = 'deploylog_seen_'
// Matches WIDGET_CONFIG_DEFAULT.accent_color in the dashboard. Treated as
// "no custom accent" so entry titles follow the theme by default.
const DEFAULT_ACCENT = '#18181b'

// Accent flows into generated <style> text, so constrain it to a hex color
// (what the dashboard produces) before use — guards against CSS injection or
// malformed values from data-accent or an unexpected API payload.
const SAFE_ACCENT_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeAccent(input: string | null | undefined): string {
  const v = input?.trim()
  return v && SAFE_ACCENT_RE.test(v) ? v : DEFAULT_ACCENT
}

// Known entry types (must match the dl-type-* classes in styles.ts). Used to
// gate entry_type before it's placed in a class name.
const KNOWN_ENTRY_TYPES = new Set(['feature', 'fix', 'improvement', 'breaking', 'announcement'])

// The only two positions styles.ts/types.ts implement. Kept in sync with the README.
const KNOWN_POSITIONS = new Set<WidgetConfig['position']>(['bottom-right', 'bottom-left'])
const KNOWN_THEMES = new Set<WidgetConfig['theme']>(['auto', 'light', 'dark'])

// Escape text for safe interpolation into innerHTML (element-content context).
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Dashboard "Widget Appearance" wins over the script's data-attributes — except
// accent_color, where the API always sends the DEFAULT_ACCENT placeholder when
// the dashboard hasn't set a custom color. Treating that placeholder as "no
// accent" (same rule accentForStyles already applies) keeps a script-tag
// data-accent from being silently clobbered on every fetch.
export function mergeConfig(
  scriptConfig: WidgetConfig,
  wc: WidgetData['widget_config'] | null | undefined,
): WidgetConfig {
  if (!wc) return scriptConfig

  const accentColor =
    wc.accent_color && normalizeAccent(wc.accent_color).toLowerCase() !== DEFAULT_ACCENT
      ? normalizeAccent(wc.accent_color)
      : scriptConfig.accentColor

  // Gate through the same known-value sets parseConfig uses. `??` let any non-null
  // dashboard value through — including '' and an unimplemented 'top-right' — which
  // clobbered a valid script-tag value and re-opened the drift this slice closed.
  // parseWidgetData casts the API body without validating widget_config, so this is
  // the only place the dashboard side is checked.
  const position = KNOWN_POSITIONS.has(wc.position as WidgetConfig['position'])
    ? (wc.position as WidgetConfig['position'])
    : scriptConfig.position
  const theme = KNOWN_THEMES.has(wc.theme as WidgetConfig['theme'])
    ? (wc.theme as WidgetConfig['theme'])
    : scriptConfig.theme

  return {
    ...scriptConfig,
    position,
    theme,
    accentColor,
  }
}

// entries[0] is assumed latest; unread = strictly after lastSeen. A null lastSeen
// (never opened) counts everything.
//
// Compared as INSTANTS, not as strings. Both sides come from the API, but not
// necessarily in the same textual form: setLastSeenTimestamp stores whatever the
// server sent at the time, so a later payload that drops milliseconds or uses an
// offset instead of Z compares wrong lexically — '…T00:00:00Z' > '…T00:00:00.000Z'
// because 'Z' > '.', which leaves an already-seen entry unread forever. Falls back
// to the raw string comparison only when either side is unparseable, so junk input
// behaves exactly as it did before.
export function unreadCount(entries: Entry[], lastSeen: string | null): number {
  if (entries.length === 0) return 0
  if (lastSeen === null) return entries.length

  const seenAt = Date.parse(lastSeen)
  return entries.filter((e) => {
    const publishedAt = Date.parse(e.published_at)
    if (Number.isNaN(publishedAt) || Number.isNaN(seenAt)) return e.published_at > lastSeen
    return publishedAt > seenAt
  }).length
}

// A malformed 200 body (missing/wrong-shaped fields, or not even an object)
// must not throw later when the widget reads project/entries — normalize it
// to null instead.
export function parseWidgetData(json: unknown): WidgetData | null {
  if (!json || typeof json !== 'object') return null
  const data = (json as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  const candidate = data as Partial<WidgetData>
  if (!Array.isArray(candidate.entries) || !candidate.project) return null
  return candidate as WidgetData
}

// Pure render of a single entry's innerHTML. title/entry_type/version are escaped;
// body_html is passed through raw on the server-sanitized contract documented on
// WidgetData['entries'][number]['body_html'] in types.ts. entry_type only drives a
// class name when it's a known value — gated the same way parseConfig gates position/theme.
export function renderEntryHTML(entry: Entry): string {
  let typeBadge = ''
  if (entry.entry_type) {
    const typeClass = KNOWN_ENTRY_TYPES.has(entry.entry_type) ? ` dl-type-${entry.entry_type}` : ''
    typeBadge = `<span class="dl-entry-type${typeClass}">${escapeHtml(entry.entry_type)}</span>`
  }

  let versionBadge = ''
  if (entry.version) {
    versionBadge = `<span class="dl-entry-version">v${escapeHtml(entry.version)}</span>`
  }

  const date = new Date(entry.published_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `
      <div class="dl-entry-header">
        <span class="dl-entry-title">${escapeHtml(entry.title)}</span>
        ${typeBadge}
        ${versionBadge}
      </div>
      <div class="dl-entry-date">${date}</div>
      <div class="dl-entry-body">${entry.body_html}</div>
    `
}

// URL construction + res.ok gate + parseWidgetData. Never throws — a malformed body,
// a non-200, a rejected fetch, or a rejected res.json() all normalize to null so the
// widget can never break the host page on a fetch failure.
export async function fetchWidgetData(apiUrl: string, projectId: string): Promise<WidgetData | null> {
  try {
    const res = await fetch(`${apiUrl}/api/widget-data?projectId=${encodeURIComponent(projectId)}`)
    if (!res.ok) return null
    const json = await res.json()
    return parseWidgetData(json)
  } catch {
    return null
  }
}

// Validates data-position/data-theme/data-accent against the sets the rest of
// the widget actually implements, instead of `as`-casting an arbitrary string
// through. An unsupported value (e.g. a top-* position) normalizes to the
// default rather than type-checking in and silently rendering somewhere else.
export function parseConfig(script: HTMLScriptElement, projectId: string): WidgetConfig {
  const position = script.getAttribute('data-position')
  const theme = script.getAttribute('data-theme')

  return {
    projectId,
    position: KNOWN_POSITIONS.has(position as WidgetConfig['position'])
      ? (position as WidgetConfig['position'])
      : 'bottom-right',
    theme: KNOWN_THEMES.has(theme as WidgetConfig['theme'])
      ? (theme as WidgetConfig['theme'])
      : 'auto',
    accentColor: normalizeAccent(script.getAttribute('data-accent')),
    apiUrl: script.getAttribute('data-api-url') ?? DEFAULT_API_URL,
  }
}

export function init() {
  const script = document.currentScript as HTMLScriptElement | null
  if (!script) {
    console.warn('[DeployLog] Widget requires a classic script tag (document.currentScript is null)')
    return
  }

  // Double-init guard: a second embed execution (SPA navigation, GTM re-fire) is a no-op
  if ((window as any).__deploylogMounted) return
  ;(window as any).__deploylogMounted = true

  const projectId = script.getAttribute('data-project')
  if (!projectId) {
    console.warn('[DeployLog] Missing data-project attribute')
    return
  }

  const config = parseConfig(script, projectId)

  const widget = new DeployLogWidget(config)
  widget.mount()
}

class DeployLogWidget {
  private config: WidgetConfig
  private shadow: ShadowRoot | null = null
  private styleEl: HTMLStyleElement | null = null
  private container: HTMLElement | null = null
  private isOpen = false
  private data: WidgetData | null = null
  private viewedEntries: string[] = []

  constructor(config: WidgetConfig) {
    this.config = config
  }

  mount() {
    const doMount = () => {
      // Create host element
      this.container = document.createElement('div')
      this.container.id = 'deploylog-widget'
      document.body.appendChild(this.container)

      // Shadow DOM for style isolation
      this.shadow = this.container.attachShadow({ mode: 'closed' })

      // Add styles
      this.styleEl = document.createElement('style')
      this.applyStyles()
      this.shadow.appendChild(this.styleEl)

      // Re-resolve an 'auto' theme on OS changes. Registered unconditionally so it
      // still applies if the dashboard config later switches the theme to 'auto';
      // the handler is a no-op for fixed light/dark themes.
      // Safari 13.0 lacks MediaQueryList.addEventListener — fall back to addListener.
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const themeListener = () => { if (this.config.theme === 'auto') this.applyStyles() }
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', themeListener)
      } else if (typeof (mq as any).addListener === 'function') {
        ;(mq as any).addListener(themeListener)
      }

      // Render trigger button
      this.renderTrigger()

      // Fetch data
      this.fetchData()

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close()
      })
    }

    // Guard: defer body.appendChild when the DOM isn't ready yet (head embed without defer)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doMount, { once: true })
    } else {
      doMount()
    }
  }

  private resolveTheme(): 'light' | 'dark' {
    if (this.config.theme === 'light') return 'light'
    if (this.config.theme === 'dark') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // The neutral default means "no custom accent" — let titles follow the theme.
  private accentForStyles(): string | undefined {
    const accent = this.config.accentColor
    return accent && accent.toLowerCase() !== DEFAULT_ACCENT ? accent : undefined
  }

  private applyStyles() {
    if (this.styleEl) {
      this.styleEl.textContent = getStyles(this.resolveTheme(), this.accentForStyles())
    }
  }

  private getStorageKey(): string {
    return STORAGE_KEY_PREFIX + this.config.projectId
  }

  private getLastSeenTimestamp(): string | null {
    try {
      return localStorage.getItem(this.getStorageKey())
    } catch {
      return null
    }
  }

  private setLastSeenTimestamp(timestamp: string) {
    try {
      localStorage.setItem(this.getStorageKey(), timestamp)
    } catch {
      // localStorage unavailable
    }
  }

  private getUnreadCount(): number {
    if (!this.data) return 0
    return unreadCount(this.data.entries, this.getLastSeenTimestamp())
  }

  private async fetchData() {
    try {
      this.data = await fetchWidgetData(this.config.apiUrl, this.config.projectId)
      if (!this.data) return

      // Apply the dashboard-saved appearance over the script defaults, then
      // re-render the parts that depend on it: styles (theme + accent) and the
      // trigger (position). "Widget Appearance" in the dashboard is the source
      // of truth, so it wins over the script's data-attributes.
      if (this.data.widget_config) {
        this.config = mergeConfig(this.config, this.data.widget_config)
        this.applyStyles()
      }

      this.renderTrigger()
    } catch {
      // Silently fail — widget should never break host site
    }
  }

  private renderTrigger() {
    if (!this.shadow) return

    // Remove existing trigger
    const existing = this.shadow.querySelector('.dl-trigger')
    if (existing) existing.remove()

    const posClass = this.config.position === 'bottom-left' ? 'dl-trigger--bl' : 'dl-trigger--br'
    const unreadCount = this.getUnreadCount()

    const button = document.createElement('button')
    button.className = `dl-trigger ${posClass}`
    button.setAttribute('aria-label', `What's new${unreadCount ? ` (${unreadCount} unread)` : ''}`)
    button.setAttribute('type', 'button')

    // Bell icon SVG
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
      What's New
      ${unreadCount > 0 ? `<span class="dl-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
    `

    button.addEventListener('click', () => {
      if (this.isOpen) {
        this.close()
      } else {
        this.open()
      }
    })

    this.shadow.appendChild(button)
  }

  private open() {
    if (!this.shadow || !this.data) return
    this.isOpen = true

    // Mark as seen
    if (this.data.entries.length > 0) {
      const latest = this.data.entries[0]!
      this.setLastSeenTimestamp(latest.published_at)
    }

    // Update trigger (removes badge)
    this.renderTrigger()

    // Build panel
    const posClass = this.config.position === 'bottom-left' ? 'dl-panel--bl' : 'dl-panel--br'

    const panel = document.createElement('div')
    panel.className = `dl-panel ${posClass}`
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Changelog')

    // Header
    const header = document.createElement('div')
    header.className = 'dl-header'
    header.innerHTML = `
      <span>${escapeHtml(this.data.project.name)} Changelog</span>
      <button class="dl-close" aria-label="Close changelog" type="button">&times;</button>
    `
    header.querySelector('.dl-close')!.addEventListener('click', () => this.close())
    panel.appendChild(header)

    // Entries
    const entriesContainer = document.createElement('div')
    entriesContainer.className = 'dl-entries'

    if (this.data.entries.length === 0) {
      entriesContainer.innerHTML = '<div class="dl-empty">No updates yet. Check back soon!</div>'
    } else {
      for (const entry of this.data.entries) {
        entriesContainer.appendChild(this.renderEntry(entry))
      }
    }
    panel.appendChild(entriesContainer)

    // Email subscribe form
    panel.appendChild(this.renderSubscribeForm())

    // Action-CTA footer (free tier only) — converts better than a passive logo.
    if (this.data.plan === 'free') {
      const footer = document.createElement('div')
      footer.className = 'dl-footer'
      footer.innerHTML = `<a href="https://deploylog.dev/?utm_source=widget&utm_medium=badge" target="_blank" rel="noopener">Create your own changelog →</a>`
      panel.appendChild(footer)
    }

    this.shadow.appendChild(panel)

    // Track views
    this.trackViews()

    // Focus trap — focus close button
    const closeBtn = panel.querySelector<HTMLButtonElement>('.dl-close')
    closeBtn?.focus()
  }

  private close() {
    if (!this.shadow) return
    this.isOpen = false

    const panel = this.shadow.querySelector('.dl-panel')
    if (panel) panel.remove()

    // Return focus to trigger
    const trigger = this.shadow.querySelector<HTMLButtonElement>('.dl-trigger')
    trigger?.focus()
  }

  private renderEntry(entry: Entry): HTMLElement {
    const el = document.createElement('div')
    el.className = 'dl-entry'
    el.innerHTML = renderEntryHTML(entry)
    return el
  }

  private renderSubscribeForm(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'dl-subscribe'

    const form = document.createElement('form')
    form.className = 'dl-subscribe-form'
    form.innerHTML = `
      <input type="email" class="dl-subscribe-input" placeholder="Get notified by email" required aria-label="Email address" />
      <button type="submit" class="dl-subscribe-btn">Subscribe</button>
    `

    const msgEl = document.createElement('div')
    msgEl.className = 'dl-subscribe-msg'
    msgEl.style.display = 'none'

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const input = form.querySelector<HTMLInputElement>('.dl-subscribe-input')!
      const btn = form.querySelector<HTMLButtonElement>('.dl-subscribe-btn')!
      const email = input.value.trim()

      if (!email) return

      btn.disabled = true
      btn.textContent = '...'
      msgEl.style.display = 'none'

      try {
        const res = await fetch(`${this.config.apiUrl}/api/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, projectId: this.config.projectId }),
        })

        const json = await res.json()

        if (res.ok) {
          msgEl.textContent = json.data?.message ?? 'Subscribed!'
          msgEl.className = 'dl-subscribe-msg'
          input.value = ''
        } else {
          msgEl.textContent = json.error?.message ?? 'Something went wrong'
          msgEl.className = 'dl-subscribe-msg dl-subscribe-msg--error'
        }
      } catch {
        msgEl.textContent = 'Network error. Try again.'
        msgEl.className = 'dl-subscribe-msg dl-subscribe-msg--error'
      }

      msgEl.style.display = 'block'
      btn.disabled = false
      btn.textContent = 'Subscribe'
    })

    container.appendChild(form)
    container.appendChild(msgEl)
    return container
  }

  private trackViews() {
    if (!this.data?.entries.length) return

    const newViews = this.data.entries
      .filter((e) => !this.viewedEntries.includes(e.id))
      .map((e) => ({ entry_id: e.id, source: 'widget' as const }))

    if (newViews.length === 0) return

    this.viewedEntries.push(...newViews.map((v) => v.entry_id))

    // Fire and forget — don't block UI
    fetch(`${this.config.apiUrl}/api/widget-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: newViews }),
    }).catch(() => {
      // Silently fail
    })
  }

}

// Auto-initialize when script loads; fail-quiet per the never-break-host contract
try { init() } catch { }
