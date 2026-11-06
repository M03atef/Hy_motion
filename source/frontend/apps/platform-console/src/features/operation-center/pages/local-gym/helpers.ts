import type { LocalInstallationDto, LocalLicenseDetailDto, LocalLicenseListItemDto } from '@/lib/api/types'
import { statusLabel, type Locale } from '@gymflowpro/i18n'

export const CUSTOMER_STATUSES = ['prospect', 'active', 'inactive', 'churned'] as const

export function customerStatusOption(value: string, locale: Locale): string {
  const labeled = statusLabel(value, locale)
  return labeled && labeled !== value ? labeled : value.replace(/_/g, ' ')
}

export function customerLicenses(profile: {
  licenses?: LocalLicenseListItemDto[] | null
  license?: LocalLicenseListItemDto | null
}): LocalLicenseListItemDto[] {
  if (profile.licenses?.length) return profile.licenses
  return profile.license ? [profile.license] : []
}

export function resolveLocalGymIdentity(args: {
  selectedDetail: LocalLicenseDetailDto | null
  details: LocalLicenseDetailDto[]
  licenses: LocalLicenseListItemDto[]
}): { gymCode: string | null; gymName: string | null; appVersion: string | null } {
  const pick = (row?: {
    gymCode?: string | null
    gymName?: string | null
    appVersion?: string | null
    installations?: LocalInstallationDto[]
  } | null) => {
    if (!row) return { gymCode: null as string | null, gymName: null as string | null, appVersion: null as string | null }
    const inst = row.installations?.find((item) => item.gymCode || item.gymName || item.appVersion)
    return {
      gymCode: row.gymCode || inst?.gymCode || null,
      gymName: row.gymName || inst?.gymName || null,
      appVersion: row.appVersion || inst?.appVersion || null,
    }
  }
  const selected = pick(args.selectedDetail)
  if (selected.gymCode || selected.gymName || selected.appVersion) return selected
  for (const detail of args.details) {
    const next = pick(detail)
    if (next.gymCode || next.gymName || next.appVersion) return next
  }
  for (const license of args.licenses) {
    const next = pick(license)
    if (next.gymCode || next.gymName || next.appVersion) return next
  }
  return { gymCode: null, gymName: null, appVersion: null }
}

export function formatOwnerAccount(
  customer: { ownerEmail?: string | null; ownerUsername?: string | null; ownerAccountStatus?: string | null },
  noneLabel: string,
  locale: Locale = 'en',
): string {
  const login = ownerAccountLogin(customer)
  const status = labelOwnerAccountStatus(customer.ownerAccountStatus, locale)
  if (login && status) return `${login} · ${status}`
  if (login) return login
  if (status) return status
  return noneLabel
}

export function ownerAccountLogin(customer: {
  ownerEmail?: string | null
  ownerUsername?: string | null
}): string {
  return customer.ownerEmail?.trim() || customer.ownerUsername?.trim() || ''
}

/** Never dump raw snake_case (e.g. reset_requested) into the UI. */
export function labelOwnerAccountStatus(
  status: string | null | undefined,
  locale: Locale = 'en',
): string {
  const raw = status?.trim() || ''
  if (!raw || raw === 'unknown') return ''
  const labeled = statusLabel(raw, locale)
  if (labeled && labeled !== raw) return labeled
  return raw.replace(/_/g, ' ')
}

export function deriveLiveLicenseStatus(licenses: LocalLicenseListItemDto[], selectedLicenseId: string): string | null {
  if (selectedLicenseId) {
    return licenses.find((row) => row.id === selectedLicenseId)?.status ?? null
  }
  if (licenses.length === 1) return licenses[0]?.status ?? null
  return null
}
