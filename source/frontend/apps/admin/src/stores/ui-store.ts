import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@/lib/i18n/bilingual'

interface UiState {
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  applyDocumentDirection: () => void
}

function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      locale: 'ar',
      dir: 'rtl',
      setLocale: (locale) => {
        const dir = dirFor(locale)
        set({ locale, dir })
        document.documentElement.lang = locale
        document.documentElement.dir = dir
      },
      toggleLocale: () => {
        const next = get().locale === 'ar' ? 'en' : 'ar'
        get().setLocale(next)
      },
      applyDocumentDirection: () => {
        const { locale, dir } = get()
        document.documentElement.lang = locale
        document.documentElement.dir = dir
      },
    }),
    {
      name: 'gymflowpro.ui',
      partialize: (s) => ({ locale: s.locale, dir: s.dir }),
    },
  ),
)
