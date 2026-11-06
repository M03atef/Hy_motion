import type { Locale } from '@/lib/i18n/bilingual'
import { tLabel } from '@/lib/i18n/bilingual'

export function memberDisplayName(
  fullName: string,
  fullNameAr: string,
  locale: Locale,
): string {
  return tLabel(fullName, fullNameAr, locale)
}

export function membershipStatusLabel(status: string | null | undefined, locale: Locale): string {
  const key = (status ?? '').toLowerCase()
  const map: Record<string, [string, string]> = {
    active: ['Active', 'نشطة'],
    expired: ['Expired', 'منتهية'],
    frozen: ['Frozen', 'مجمّدة'],
    cancelled: ['Cancelled', 'ملغاة'],
    pending: ['Pending payment', 'بانتظار الدفع'],
  }
  const pair = map[key]
  if (!pair) return status ?? '—'
  return tLabel(pair[0], pair[1], locale)
}

export function formatDateOnly(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—'
  // DateOnly comes as yyyy-MM-dd
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTimeUtc(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(amount)
}
