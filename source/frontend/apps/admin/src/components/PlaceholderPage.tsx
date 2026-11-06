import { tLabel } from '@/lib/i18n/bilingual'
import { useUiStore } from '@/stores/ui-store'

/** Placeholder content for routes not yet implemented (Prompt 2 shell only). */
export function PlaceholderPage({
  titleEn,
  titleAr,
  hintEn,
  hintAr,
}: {
  titleEn: string
  titleAr: string
  hintEn?: string
  hintAr?: string
}) {
  const locale = useUiStore((s) => s.locale)
  return (
    <div className="rounded-[16px] border border-[var(--lbd)] bg-white p-8">
      <h1 className="font-[family-name:var(--fd)] text-2xl font-bold text-[var(--ltp)]">
        {tLabel(titleEn, titleAr, locale)}
      </h1>
      <p className="mt-2 text-sm text-[var(--ltt)]">
        {tLabel(
          hintEn ?? 'Coming in a later prompt.',
          hintAr ?? 'سيُبنى في مطالبة لاحقة.',
          locale,
        )}
      </p>
    </div>
  )
}
