import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type CopyKey, type Locale } from './i18n'
import { applyDsDocument, DS_DEFAULT_THEME, type DsTheme } from './theme'

export type Theme = DsTheme
export type Viewport = 'desktop' | 'tablet' | 'mobile'

interface PreviewContextValue {
  theme: Theme
  locale: Locale
  dir: 'ltr' | 'rtl'
  viewport: Viewport
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  setViewport: (viewport: Viewport) => void
  t: (key: CopyKey) => string
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

function applyDocument(theme: Theme, locale: Locale) {
  applyDsDocument(theme, locale)
}

function readQuery(): { theme: Theme; locale: Locale } {
  if (typeof window === 'undefined') return { theme: DS_DEFAULT_THEME, locale: 'en' }
  const q = new URLSearchParams(window.location.search)
  return {
    theme: q.get('theme') === 'light' ? 'light' : DS_DEFAULT_THEME,
    locale: q.get('lang') === 'ar' ? 'ar' : 'en',
  }
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readQuery().theme)
  const [locale, setLocaleState] = useState<Locale>(() => readQuery().locale)
  const [viewport, setViewport] = useState<Viewport>('desktop')

  useEffect(() => {
    applyDocument(theme, locale)
  }, [theme, locale])

  const setTheme = useCallback(
    (next: Theme) => {
      applyDocument(next, locale)
      setThemeState(next)
    },
    [locale],
  )

  const setLocale = useCallback(
    (next: Locale) => {
      applyDocument(theme, next)
      setLocaleState(next)
    },
    [theme],
  )

  const t = useCallback((key: CopyKey) => translate(locale, key), [locale])

  const value = useMemo(
    () => ({
      theme,
      locale,
      dir: locale === 'ar' ? ('rtl' as const) : ('ltr' as const),
      viewport,
      setTheme,
      setLocale,
      setViewport,
      t,
    }),
    [theme, locale, viewport, t, setTheme, setLocale],
  )

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
}

export function usePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview must be used inside PreviewProvider')
  return ctx
}
