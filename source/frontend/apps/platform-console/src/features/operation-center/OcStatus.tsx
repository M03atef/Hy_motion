import { statusLabel, type Locale } from '@gymflowpro/i18n'
import { DsBadge } from '@/design-system'
import { statusTone } from '@/components/Status'
import { useUiStore } from '@/stores/ui-store'

export function OcStatus({ value }: { value?: string | null }) {
  const locale = useUiStore((s) => s.locale) as Locale
  if (!value) return <span className="text-[var(--ds-text-faint)]">—</span>
  const labeled = statusLabel(value, locale)
  const text = labeled && labeled !== value ? labeled : value.replace(/_/g, ' ')
  return <DsBadge tone={statusTone(value)}>{text}</DsBadge>
}

const LICENSE_EXPLANATION: Record<string, { en: string; ar: string }> = {
  created: {
    en: 'Issued — waiting for first device',
    ar: 'صدرت — في انتظار أول جهاز',
  },
  pending_activation: {
    en: 'Issued — waiting for first device',
    ar: 'صدرت — في انتظار أول جهاز',
  },
  active: { en: 'Active', ar: 'نشطة' },
  suspended: { en: 'Suspended', ar: 'موقوفة' },
  revoked: { en: 'Revoked', ar: 'ملغاة' },
}

export function licenseStatusExplanation(status: string, locale: Locale = 'en'): string {
  const key = status.toLowerCase()
  const mapped = LICENSE_EXPLANATION[key]
  if (mapped) return mapped[locale] ?? mapped.en
  return status.replace(/_/g, ' ')
}

export function OcLicenseStatus({ value, showCode = true }: { value?: string | null; showCode?: boolean }) {
  if (!value) return <span className="text-[var(--ds-text-faint)]">—</span>
  const locale = useUiStore((s) => s.locale) as Locale
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <DsBadge tone={statusTone(value)}>{licenseStatusExplanation(value, locale)}</DsBadge>
      {showCode ? <span className="oc-mono text-[11px] text-[var(--ds-text-faint)]">{value}</span> : null}
    </span>
  )
}
