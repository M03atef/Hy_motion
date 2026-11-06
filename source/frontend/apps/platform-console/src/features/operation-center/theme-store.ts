import { create } from 'zustand'
import { DS_DEFAULT_THEME, type DsTheme } from '@/design-system'

export const OC_THEME_KEY = 'hymotion.oc.theme'

function readTheme(): DsTheme {
  if (typeof localStorage === 'undefined') return DS_DEFAULT_THEME
  const value = localStorage.getItem(OC_THEME_KEY)
  return value === 'light' || value === 'dark' ? value : DS_DEFAULT_THEME
}

interface OcThemeState {
  theme: DsTheme
  setTheme: (theme: DsTheme) => void
}

export const useOcThemeStore = create<OcThemeState>((set) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(OC_THEME_KEY, theme)
    } catch {
      /* ignore quota / private mode */
    }
    set({ theme })
  },
}))
