import type { PlatformRole } from '@/lib/api/types'

/** Live controller policies (prefer these over aspirational product matrix). */
export function isOpsOrAbove(role: string | null | undefined): boolean {
  return role === 'platform_ops' || role === 'platform_admin'
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'platform_admin'
}

export function isSupport(role: string | null | undefined): boolean {
  return role === 'platform_support'
}

export function isSales(role: string | null | undefined): boolean {
  return role === 'platform_sales'
}

export function isSalesOrAbove(role: string | null | undefined): boolean {
  return role === 'platform_sales' || isOpsOrAbove(role)
}

export function isSupportOrAbove(role: string | null | undefined): boolean {
  return role === 'platform_support' || isOpsOrAbove(role)
}

export function isCustomerAccess(role: string | null | undefined): boolean {
  return isSalesOrAbove(role) || isSupport(role)
}

export function normalizeRole(role: string | null | undefined): PlatformRole | string | null {
  return role ?? null
}

export const MIN_REASON_LENGTH = 10

export function validateReason(reason: string): string | null {
  const trimmed = reason.trim()
  if (trimmed.length < MIN_REASON_LENGTH) {
    return `Reason must be at least ${MIN_REASON_LENGTH} characters (required for the audit log).`
  }
  return null
}
