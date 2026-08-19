import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeAccent,
  escapeHtml,
  init,
  mergeConfig,
  unreadCount,
  parseWidgetData,
  parseConfig,
  renderEntryHTML,
  fetchWidgetData,
} from './widget'
import type { WidgetConfig, Entry } from './types'

const DEFAULT_ACCENT = '#18181b'

function makeWidgetConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    projectId: 'test-project',
    position: 'bottom-right',
    theme: 'auto',
    accentColor: DEFAULT_ACCENT,
    apiUrl: 'https://deploylog.dev',
    ...overrides,
  }
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    title: 'Title',
    slug: 'title',
    entry_type: null,
    version: null,
    body_html: '<p>body</p>',
    published_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('normalizeAccent', () => {
  it('accepts 6- and 3-digit hex', () => {
    expect(normalizeAccent('#ff0000')).toBe('#ff0000')
    expect(normalizeAccent('#FFF')).toBe('#FFF')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeAccent('  #abcdef  ')).toBe('#abcdef')
  })

  // Anything that isn't a clean hex color must fall back — these are the CSS
  // values that, if interpolated into the <style> block, would break out of the
  // --dl-accent declaration or be malformed.
  it.each([
    'red',
    '#xyz',
    '#ff',
    '#1234567',
    'rgb(0,0,0)',
    'red; } :host { display: none }',
    '#fff;}',
    'var(--x)',
    'url(evil)',
    '',
    null,
    undefined,
  ])('falls back to the default for invalid input: %p', (input) => {
    expect(normalizeAccent(input as string | null | undefined)).toBe(DEFAULT_ACCENT)
  })
})

describe('escapeHtml', () => {
  it('escapes angle brackets and ampersands', () => {
    expect(escapeHtml('<b>tom & jerry</b>')).toBe('&lt;b&gt;tom &amp; jerry&lt;/b&gt;')
  })

  it('neutralizes an injection payload into inert text', () => {
    const out = escapeHtml('<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
    // Rendering the escaped string produces no live element.
    const host = document.createElement('div')
    host.innerHTML = out
    expect(host.querySelector('img')).toBeNull()
  })

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('feature')).toBe('feature')
    expect(escapeHtml('1.2.0')).toBe('1.2.0')
  })
})

describe('mergeConfig', () => {
  it('dashboard widget_config wins over script config for position/theme', () => {
    const script = makeWidgetConfig({ position: 'bottom-left', theme: 'light' })
    const merged = mergeConfig(script, { position: 'bottom-right', theme: 'dark' })
    expect(merged.position).toBe('bottom-right')
    expect(merged.theme).toBe('dark')
  })

  it('falls back to script config when widget_config is undefined', () => {
    const script = makeWidgetConfig({ position: 'bottom-left', theme: 'dark' })
    const merged = mergeConfig(script, undefined)
    expect(merged.position).toBe('bottom-left')
    expect(merged.theme).toBe('dark')
    expect(merged.accentColor).toBe(script.accentColor)
  })

  it('dashboard accent wins when it is a real custom color', () => {
    const script = makeWidgetConfig({ accentColor: '#ff0000' })
    const merged = mergeConfig(script, { accent_color: '#00ff00' })
    expect(merged.accentColor).toBe('#00ff00')
  })

  // finding #7: the API always returns accent_color === DEFAULT_ACCENT when the
  // dashboard hasn't set a custom one, so it must not clobber a script accent.
  it('does not clobber a script-tag accent when dashboard accent is the default (#18181b)', () => {
    const script = makeWidgetConfig({ accentColor: '#ff0000' })
    const merged = mergeConfig(script, { accent_color: DEFAULT_ACCENT })
    expect(merged.accentColor).toBe('#ff0000')
  })

  it('keeps the default accent when neither script nor dashboard set one', () => {
    const script = makeWidgetConfig({ accentColor: DEFAULT_ACCENT })
    const merged = mergeConfig(script, { accent_color: DEFAULT_ACCENT })
    expect(merged.accentColor).toBe(DEFAULT_ACCENT)
  })

  it('preserves projectId and apiUrl untouched', () => {
    const script = makeWidgetConfig({ projectId: 'abc', apiUrl: 'https://x.example' })
    const merged = mergeConfig(script, { position: 'bottom-left' })
    expect(merged.projectId).toBe('abc')
    expect(merged.apiUrl).toBe('https://x.example')
  })

  // The dashboard side is never validated by parseWidgetData, so mergeConfig is the
  // only gate on it. An empty string is not null, so `??` let it through and it
  // clobbered a valid script-tag value.
  it('keeps the script position when the dashboard sends an empty string', () => {
    const script = makeWidgetConfig({ position: 'bottom-left' })
    const merged = mergeConfig(script, { position: '' as WidgetConfig['position'] })
    expect(merged.position).toBe('bottom-left')
  })

  it('keeps the script theme when the dashboard sends an empty string', () => {
    const script = makeWidgetConfig({ theme: 'dark' })
    const merged = mergeConfig(script, { theme: '' as WidgetConfig['theme'] })
    expect(merged.theme).toBe('dark')
  })

  // parseConfig rejects 'top-right' on the script side; the dashboard side must
  // reject it too, or the unimplemented position reaches getStyles anyway.
  it('keeps the script position when the dashboard sends an unimplemented one', () => {
    const script = makeWidgetConfig({ position: 'bottom-left' })
    const merged = mergeConfig(script, { position: 'top-right' as WidgetConfig['position'] })
    expect(merged.position).toBe('bottom-left')
  })

  it('keeps the script theme when the dashboard sends an unknown one', () => {
    const script = makeWidgetConfig({ theme: 'light' })
    const merged = mergeConfig(script, { theme: 'neon' as WidgetConfig['theme'] })
    expect(merged.theme).toBe('light')
  })
})

describe('unreadCount', () => {
  it('null lastSeen counts all entries', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]
    expect(unreadCount(entries, null)).toBe(2)
  })

  it('counts entries published after lastSeen', () => {
    const entries = [
      makeEntry({ id: 'a', published_at: '2026-03-01T00:00:00.000Z' }),
      makeEntry({ id: 'b', published_at: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(unreadCount(entries, '2026-02-01T00:00:00.000Z')).toBe(1)
  })

  // The three cases a lexical `>` gets wrong. lastSeen is whatever the server sent
  // when the panel was last opened, so it need not match the precision or offset of
  // a later payload — and each of these compares to the SAME instant.
  it('treats a millisecond-less timestamp as already seen', () => {
    // '2026-03-01T00:00:00Z' > '2026-03-01T00:00:00.000Z' lexically, because 'Z' > '.'
    const entries = [makeEntry({ id: 'a', published_at: '2026-03-01T00:00:00Z' })]
    expect(unreadCount(entries, '2026-03-01T00:00:00.000Z')).toBe(0)
  })

  it('treats an offset timestamp as already seen when it is the same instant', () => {
    // '2026-03-01T02:00:00+02:00' > '2026-03-01T00:00:00.000Z' lexically, at the hour digit
    const entries = [makeEntry({ id: 'a', published_at: '2026-03-01T02:00:00+02:00' })]
    expect(unreadCount(entries, '2026-03-01T00:00:00.000Z')).toBe(0)
  })

  it('still counts an offset timestamp that really is later', () => {
    const entries = [makeEntry({ id: 'a', published_at: '2026-03-01T03:00:00+02:00' })]
    expect(unreadCount(entries, '2026-03-01T00:00:00.000Z')).toBe(1)
  })

  it('falls back to string comparison when a timestamp is unparseable', () => {
    const entries = [makeEntry({ id: 'a', published_at: 'not-a-date' })]
    expect(unreadCount(entries, '2026-03-01T00:00:00.000Z')).toBe(1)
    expect(unreadCount(entries, 'zzz')).toBe(0)
  })

  it('returns 0 when every entry is at or before lastSeen', () => {
    const entries = [makeEntry({ id: 'a', published_at: '2026-01-01T00:00:00.000Z' })]
    expect(unreadCount(entries, '2026-01-01T00:00:00.000Z')).toBe(0)
  })

  it('returns 0 for an empty entries array regardless of lastSeen', () => {
    expect(unreadCount([], null)).toBe(0)
    expect(unreadCount([], '2026-01-01T00:00:00.000Z')).toBe(0)
  })
})

describe('parseWidgetData', () => {
  it('returns the data payload for a well-formed body', () => {
    const body = { data: { project: { name: 'P', slug: 'p' }, entries: [], plan: 'free' } }
    expect(parseWidgetData(body)).toEqual(body.data)
  })

  it('returns null when entries is missing', () => {
    expect(parseWidgetData({ data: { project: { name: 'P', slug: 'p' }, plan: 'free' } })).toBeNull()
  })

  it('returns null when project is missing', () => {
    expect(parseWidgetData({ data: { entries: [], plan: 'free' } })).toBeNull()
  })

  it('returns null when data is missing entirely', () => {
    expect(parseWidgetData({})).toBeNull()
  })

  it('returns null for null/undefined/non-object input without throwing', () => {
    expect(parseWidgetData(null)).toBeNull()
    expect(parseWidgetData(undefined)).toBeNull()
    expect(parseWidgetData('not json')).toBeNull()
  })
})

describe('parseConfig', () => {
  it('reads valid data-position and data-theme', () => {
    const script = document.createElement('script')
    script.setAttribute('data-position', 'bottom-left')
    script.setAttribute('data-theme', 'dark')
    const config = parseConfig(script, 'proj-1')
    expect(config.position).toBe('bottom-left')
    expect(config.theme).toBe('dark')
    expect(config.projectId).toBe('proj-1')
  })

  it('defaults position to bottom-right when data-position is absent', () => {
    const script = document.createElement('script')
    const config = parseConfig(script, 'proj-1')
    expect(config.position).toBe('bottom-right')
  })

  // README finding #4: an unsupported position (e.g. a top-* value) must not
  // silently type-check in — it normalizes to the default instead.
  it('normalizes an unknown data-position (e.g. top-right) to the default', () => {
    const script = document.createElement('script')
    script.setAttribute('data-position', 'top-right')
    const config = parseConfig(script, 'proj-1')
    expect(config.position).toBe('bottom-right')
  })

  it('defaults theme to auto when data-theme is absent or unknown', () => {
    const absent = document.createElement('script')
    expect(parseConfig(absent, 'proj-1').theme).toBe('auto')

    const unknown = document.createElement('script')
    unknown.setAttribute('data-theme', 'sepia')
    expect(parseConfig(unknown, 'proj-1').theme).toBe('auto')
  })

  it('normalizes data-accent through normalizeAccent', () => {
    const script = document.createElement('script')
    script.setAttribute('data-accent', '#ff0000')
    expect(parseConfig(script, 'proj-1').accentColor).toBe('#ff0000')

    const invalid = document.createElement('script')
    invalid.setAttribute('data-accent', 'rgb(0,0,0)')
    expect(parseConfig(invalid, 'proj-1').accentColor).toBe(DEFAULT_ACCENT)
  })

  it('defaults apiUrl when data-api-url is absent', () => {
    const script = document.createElement('script')
    expect(parseConfig(script, 'proj-1').apiUrl).toBe('https://deploylog.dev')
  })

  it('reads a custom data-api-url', () => {
    const script = document.createElement('script')
    script.setAttribute('data-api-url', 'https://staging.example.com')
    expect(parseConfig(script, 'proj-1').apiUrl).toBe('https://staging.example.com')
  })
})

describe('renderEntryHTML', () => {
  it('escapes a hostile title, entry_type, and version (no live element on parse)', () => {
    const entry = makeEntry({
      title: '<img src=x onerror=alert(1)>',
      entry_type: 'feature',
      version: '<script>alert(2)</script>',
    })
    const html = renderEntryHTML(entry)
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('script')).toBeNull()
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('passes body_html through raw (server-sanitized contract)', () => {
    const entry = makeEntry({ body_html: '<p>Release notes <strong>here</strong></p>' })
    const html = renderEntryHTML(entry)
    expect(html).toContain('<p>Release notes <strong>here</strong></p>')
  })

  it('applies the dl-type-* class for a known entry_type', () => {
    const html = renderEntryHTML(makeEntry({ entry_type: 'fix' }))
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('.dl-type-fix')).not.toBeNull()
  })

  it('gates an unknown entry_type: no dl-type-* class, but the escaped text still shows', () => {
    const html = renderEntryHTML(makeEntry({ entry_type: 'sponsored-content' }))
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('[class*="dl-type-"]')).toBeNull()
    expect(html).toContain('sponsored-content')
  })

  it('omits the version badge when version is null', () => {
    const html = renderEntryHTML(makeEntry({ version: null }))
    expect(html).not.toContain('dl-entry-version')
  })
})

describe('fetchWidgetData', () => {
  const validBody = {
    data: { project: { name: 'P', slug: 'p' }, entries: [], plan: 'free' },
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed data on a 200 with a well-formed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => validBody }),
    )
    const result = await fetchWidgetData('https://deploylog.dev', 'proj-1')
    expect(result).toEqual(validBody.data)
  })

  // Without these two, every test below passes against an implementation that
  // ignores both parameters — URL construction is half of what this seam owns.
  it('builds the widget-data URL from apiUrl and projectId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validBody })
    vi.stubGlobal('fetch', fetchMock)
    await fetchWidgetData('https://deploylog.dev', 'proj-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://deploylog.dev/api/widget-data?projectId=proj-1',
    )
  })

  it('encodes a projectId that would otherwise corrupt the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validBody })
    vi.stubGlobal('fetch', fetchMock)
    await fetchWidgetData('https://deploylog.dev', 'a&b c#d')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://deploylog.dev/api/widget-data?projectId=a%26b%20c%23d',
    )
  })

  it('returns null on a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => validBody }),
    )
    const result = await fetchWidgetData('https://deploylog.dev', 'proj-1')
    expect(result).toBeNull()
  })

  it('returns null on a malformed 200 body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { not: 'valid' } }) }),
    )
    const result = await fetchWidgetData('https://deploylog.dev', 'proj-1')
    expect(result).toBeNull()
  })

  it('returns null instead of throwing when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchWidgetData('https://deploylog.dev', 'proj-1')).resolves.toBeNull()
  })

  it('returns null instead of throwing when res.json() rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('bad json')
        },
      }),
    )
    await expect(fetchWidgetData('https://deploylog.dev', 'proj-1')).resolves.toBeNull()
  })
})

// --- Crash safety (A1) ---

function makeScript(projectId = 'test-project'): HTMLScriptElement {
  const s = document.createElement('script')
  s.setAttribute('data-project', projectId)
  return s
}

function mockCurrentScript(script: HTMLScriptElement | null) {
  Object.defineProperty(document, 'currentScript', {
    get: () => script,
    configurable: true,
  })
}

describe('crash safety', () => {
  beforeEach(() => {
    // jsdom doesn't implement matchMedia; provide a full stub by default
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeListener: vi.fn(),
        addListener: vi.fn(),
      })),
    })
    // Reset double-init guard and DOM between tests
    delete (window as any).__deploylogMounted
    document.getElementById('deploylog-widget')?.remove()
    mockCurrentScript(null)
  })

  afterEach(() => {
    delete (window as any).__deploylogMounted
    document.getElementById('deploylog-widget')?.remove()
    mockCurrentScript(null)
    vi.restoreAllMocks()
  })

  // A1 / #8: null currentScript must warn, not silently return
  it('warns when document.currentScript is null (not a silent return)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    init()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/\[DeployLog\].*currentScript/i))
  })

  // A1 / #3: double-init yields exactly one trigger and one container
  it('second init() call is a no-op (exactly one #deploylog-widget)', () => {
    mockCurrentScript(makeScript())
    init()
    init()
    expect(document.querySelectorAll('#deploylog-widget')).toHaveLength(1)
  })

  // A1 / #2: head-embed defers mount until DOMContentLoaded; no throw
  it('defers mount when readyState is loading, mounts on DOMContentLoaded', () => {
    Object.defineProperty(document, 'readyState', {
      get: () => 'loading' as DocumentReadyState,
      configurable: true,
    })
    mockCurrentScript(makeScript())
    expect(() => init()).not.toThrow()
    // container must not exist before DOMContentLoaded
    expect(document.getElementById('deploylog-widget')).toBeNull()

    document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(document.getElementById('deploylog-widget')).not.toBeNull()

    // restore readyState
    Object.defineProperty(document, 'readyState', {
      get: () => 'complete' as DocumentReadyState,
      configurable: true,
    })
  })

  // A1 / #9: Safari-13 class (no matchMedia.addEventListener) must not throw; uses addListener fallback
  it('does not throw on Safari-13-class env (no matchMedia.addEventListener); calls addListener', () => {
    const addListenerFn = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        // no addEventListener — simulates Safari 13.0
        addListener: addListenerFn,
        removeListener: vi.fn(),
      })),
    })
    mockCurrentScript(makeScript())
    expect(() => init()).not.toThrow()
    expect(addListenerFn).toHaveBeenCalled()
  })
})
