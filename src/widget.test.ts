import { describe, it, expect } from 'vitest'
import { normalizeAccent, escapeHtml } from './widget'

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
