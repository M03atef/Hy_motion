import { useUiStore } from '@/stores/ui-store'
import { ocCopy, type OcCopyKey, type OcLocale } from './i18n'

export function useOcCopy() {
  const locale = useUiStore((s) => s.locale) as OcLocale
  return (key: OcCopyKey) => ocCopy(key, locale === 'ar' ? 'ar' : 'en')
}
