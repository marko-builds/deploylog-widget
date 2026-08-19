import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeAccent,
  escapeHtml,
  init,
  mergeConfig,
  unreadCount,
  parseWidgetData,
  parseConfig,
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
})

describe('unreadCount', () => {
  it('null lastSeen counts all entries', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]
    expect(unreadCount(entries, null)).toBe(2)
  })

  it('counts entries published after lastSeen using ISO-string comparison', () => {
    const entries = [
      makeEntry({ id: 'a', published_at: '2026-03-01T00:00:00.000Z' }),
      makeEntry({ id: 'b', published_at: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(unreadCount(entries, '2026-02-01T00:00:00.000Z')).toBe(1)
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
