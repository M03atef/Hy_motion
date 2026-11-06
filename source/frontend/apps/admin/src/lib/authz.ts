import type { PermissionKey } from '@/lib/api'
import { decodeJwtPayload, getPermClaims, hasPermission } from '@/lib/permissions'

export type StaffRoleName = 'owner' | 'manager' | 'trainer' | 'receptionist' | 'member'

export type RolePolicy =
  | 'OwnerOnly'
  | 'ManagerOrAbove'
  | 'AnyStaff'
  | 'AuthenticatedMember'
  | 'AnyAuthenticated'

export function normalizeRole(role: string | null | undefined): StaffRoleName | string {
  return (role ?? '').trim().toLowerCase()
}

export function matchesRolePolicy(
  role: string | null | undefined,
  policy: RolePolicy,
): boolean {
  const r = normalizeRole(role)
  switch (policy) {
    case 'OwnerOnly':
      return r === 'owner'
    case 'ManagerOrAbove':
      return r === 'owner' || r === 'manager'
    case 'AnyStaff':
      return r === 'owner' || r === 'manager' || r === 'trainer' || r === 'receptionist'
    case 'AuthenticatedMember':
      return r === 'member'
    case 'AnyAuthenticated':
      return Boolean(r)
    default:
      return false
  }
}

export function canPermission(
  accessToken: string | null | undefined,
  permission: PermissionKey | PermissionKey[],
): boolean {
  const required = Array.isArray(permission) ? permission : [permission]
  return required.some((p) => hasPermission(accessToken, p))
}

export function getRoleFromToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null
  const payload = decodeJwtPayload(accessToken)
  const raw = payload?.role ?? payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : null
  return typeof raw === 'string' ? raw : null
}

export { getPermClaims, hasPermission, decodeJwtPayload }
