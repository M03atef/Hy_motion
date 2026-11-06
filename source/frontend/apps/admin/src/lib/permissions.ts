import type { PermissionKey } from '@/lib/api'

/** Decode JWT payload (no signature verify — server is authority). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getPermClaims(accessToken: string | null | undefined): PermissionKey[] {
  if (!accessToken) return []
  const payload = decodeJwtPayload(accessToken)
  if (!payload) return []
  const raw = payload.perm
  if (Array.isArray(raw)) return raw.filter((p): p is PermissionKey => typeof p === 'string')
  if (typeof raw === 'string') return [raw as PermissionKey]
  return []
}

export function hasPermission(
  accessToken: string | null | undefined,
  permission: PermissionKey,
): boolean {
  return getPermClaims(accessToken).includes(permission)
}
