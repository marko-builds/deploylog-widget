import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeAccent, escapeHtml, init } from './widget'

const DEFAULT_ACCENT = '#18181b'

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
