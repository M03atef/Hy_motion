import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@gymflowpro/i18n'
import { t as tCatalog } from '@gymflowpro/i18n'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  message: string
  tone: ToastTone
  durationMs?: number
}

interface UiState {
  locale: Locale
  dir: 'ltr' | 'rtl'
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  banner: string | null
  toast: ToastMessage | null
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  applyDocumentDirection: () => void
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setBanner: (message: string | null) => void
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void
  /** Toast from catalog key */
  showToastKey: (key: string, tone?: ToastTone, params?: Record<string, string | number>) => void
  clearToast: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

function applyDom(locale: Locale) {
  const dir = dirFor(locale)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    document.documentElement.setAttribute('data-locale', locale)
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      dir: 'ltr',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      banner: null,
      toast: null,
      setLocale: (locale) => {
        const dir = dirFor(locale)
        set({ locale, dir })
        applyDom(locale)
      },
      toggleLocale: () => {
        const next = get().locale === 'ar' ? 'en' : 'ar'
        get().setLocale(next)
      },
      applyDocumentDirection: () => {
        applyDom(get().locale)
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setBanner: (banner) => set({ banner }),
      showToast: (message, tone = 'info', durationMs = 4000) =>
        set({ toast: { message, tone, durationMs } }),
      showToastKey: (key, tone = 'info', params) => {
        const message = tCatalog(key, params, get().locale)
        set({ toast: { message, tone, durationMs: 4000 } })
      },
      clearToast: () => set({ toast: null }),
      t: (key, params) => tCatalog(key, params, get().locale),
    }),
    {
      name: 'gymflowpro.platform.ui',
      partialize: (s) => ({ locale: s.locale, dir: s.dir, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
