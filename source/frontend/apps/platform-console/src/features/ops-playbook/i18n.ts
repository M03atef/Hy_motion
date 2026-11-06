import type { Locale } from '@gymflowpro/i18n'
import { pickBilingual } from '@gymflowpro/i18n'
import type { Bi } from './types'

export function tx(locale: Locale, value: Bi): string {
  return pickBilingual(value.en, value.ar, locale) || value.en
}

export function bi(en: string, ar: string): Bi {
  return { en, ar }
}
