import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DS_TOKEN_GROUPS } from './token-names'
import { applyDsDocument, applyDsLocale, applyDsTheme, DS_DEFAULT_THEME } from './theme'

describe('production design tokens', () => {
  const css = readFileSync(path.resolve(__dirname, 'tokens.css'), 'utf8')

  it('defines the approved token groups', () => {
    for (const tokens of Object.values(DS_TOKEN_GROUPS)) {
      for (const token of tokens) {
        expect(css).toContain(`${token}:`)
      }
    }
  })

  it('keeps status colors separate from lime', () => {
    expect(css).toMatch(/--ds-status-success:\s*#3ddc82/)
    expect(css).not.toMatch(/--ds-status-success:\s*var\(--ds-lime/)
    expect(css).not.toMatch(/--ds-status-success:\s*var\(--ds-action/)
  })

  it('defaults the operations theme to dark', () => {
    expect(DS_DEFAULT_THEME).toBe('dark')
    expect(css.indexOf('--ds-bg-canvas: #101010')).toBeGreaterThan(-1)
    expect(css.indexOf('[data-theme=\'light\']')).toBeGreaterThan(css.indexOf('--ds-bg-canvas: #101010'))
  })
})

describe('design system theme helpers', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('dir')
    document.documentElement.lang = 'en'
  })

  it('applies dark and light without touching locale', () => {
    applyDsTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyDsTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('applies Arabic as RTL layout', () => {
    applyDsLocale('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    applyDsDocument('light', 'en')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
