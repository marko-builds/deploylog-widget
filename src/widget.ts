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

function normalizeAccent(input: string | null | undefined): string {
  const v = input?.trim()
  return v && SAFE_ACCENT_RE.test(v) ? v : DEFAULT_ACCENT
}

function init() {
  const script = document.currentScript as HTMLScriptElement | null
  if (!script) return

  const projectId = script.getAttribute('data-project')
  if (!projectId) {
    console.warn('[DeployLog] Missing data-project attribute')
    return
  }

  const config: WidgetConfig = {
    projectId,
    position: (script.getAttribute('data-position') as WidgetConfig['position']) ?? 'bottom-right',
    theme: (script.getAttribute('data-theme') as WidgetConfig['theme']) ?? 'auto',
    accentColor: normalizeAccent(script.getAttribute('data-accent')),
    apiUrl: script.getAttribute('data-api-url') ?? DEFAULT_API_URL,
  }

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
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.config.theme === 'auto') this.applyStyles()
    })

    // Render trigger button
    this.renderTrigger()

    // Fetch data
    this.fetchData()

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    })
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
    if (!this.data?.entries.length) return 0
    const lastSeen = this.getLastSeenTimestamp()
    if (!lastSeen) return this.data.entries.length
    return this.data.entries.filter((e) => e.published_at > lastSeen).length
  }

  private async fetchData() {
    try {
      const res = await fetch(
        `${this.config.apiUrl}/api/widget-data?projectId=${this.config.projectId}`,
      )
      if (!res.ok) return

      const json = await res.json()
      this.data = json.data

      // Apply the dashboard-saved appearance over the script defaults, then
      // re-render the parts that depend on it: styles (theme + accent) and the
      // trigger (position). "Widget Appearance" in the dashboard is the source
      // of truth, so it wins over the script's data-attributes.
      const wc = this.data?.widget_config
      if (wc) {
        if (wc.position) this.config.position = wc.position
        if (wc.theme) this.config.theme = wc.theme
        if (wc.accent_color) this.config.accentColor = normalizeAccent(wc.accent_color)
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
      <span>${this.data.project.name} Changelog</span>
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

    let typeBadge = ''
    if (entry.entry_type) {
      typeBadge = `<span class="dl-entry-type dl-type-${entry.entry_type}">${entry.entry_type}</span>`
    }

    let versionBadge = ''
    if (entry.version) {
      versionBadge = `<span class="dl-entry-version">v${entry.version}</span>`
    }

    const date = new Date(entry.published_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    el.innerHTML = `
      <div class="dl-entry-header">
        <span class="dl-entry-title">${this.escapeHtml(entry.title)}</span>
        ${typeBadge}
        ${versionBadge}
      </div>
      <div class="dl-entry-date">${date}</div>
      <div class="dl-entry-body">${entry.body_html}</div>
    `

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

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Auto-initialize when script loads
init()
