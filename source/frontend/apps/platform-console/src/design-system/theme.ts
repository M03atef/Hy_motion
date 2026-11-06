export type DsTheme = 'dark' | 'light'
export type DsLocale = 'en' | 'ar'

export const DS_DEFAULT_THEME: DsTheme = 'dark'

export function applyDsTheme(theme: DsTheme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme
}

export function applyDsLocale(locale: DsLocale, root: HTMLElement = document.documentElement) {
  root.lang = locale
  root.dir = locale === 'ar' ? 'rtl' : 'ltr'
  root.dataset.locale = locale
}

export function applyDsDocument(theme: DsTheme, locale: DsLocale, root: HTMLElement = document.documentElement) {
  applyDsTheme(theme, root)
  applyDsLocale(locale, root)
}
