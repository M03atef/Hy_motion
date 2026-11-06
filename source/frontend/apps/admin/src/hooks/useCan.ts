import { useMemo } from 'react'
import type { PermissionKey } from '@/lib/api'
import { canPermission, matchesRolePolicy, type RolePolicy } from '@/lib/authz'
import type { NavAccess } from '@/config/nav'
import { canAccess } from '@/config/nav-visibility'
import { useAuthStore } from '@/stores/auth-store'

type CanArg = NavAccess | PermissionKey | PermissionKey[]

function isNavAccess(arg: CanArg): arg is NavAccess {
  return typeof arg === 'object' && arg !== null && 'kind' in arg
}

/**
 * Gate against JWT `perm` claims / role policies / any-staff.
 * Never branch on the role string outside this helper for item-level gating.
 *
 * Overloads:
 * - `useCan({ kind: 'permission', value: 'sales.sell' })`
 * - `useCan('members.edit')` / `useCan(['a','b'])` — permission any-of (legacy)
 */
export function useCan(access: CanArg): boolean {
  const accessToken = useAuthStore((s) => s.session?.accessToken)
  const role = useAuthStore((s) => s.user?.role)

  const key = isNavAccess(access)
    ? access.kind === 'permission'
      ? `p:${Array.isArray(access.value) ? access.value.join('|') : access.value}`
      : access.kind === 'policy'
        ? `pol:${access.value}`
        : 'any'
    : Array.isArray(access)
      ? access.join('|')
      : access

  return useMemo(() => {
    if (isNavAccess(access)) {
      return canAccess(access, { accessToken, role })
    }
    return canPermission(accessToken, access)
    // key captures identity without unstable array refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, role, key])
}

/** True if the login user's role satisfies a named ASP.NET role policy. */
export function useCanRole(policy: RolePolicy): boolean {
  const role = useAuthStore((s) => s.user?.role)
  return useMemo(() => matchesRolePolicy(role, policy), [role, policy])
}

/** Combined gate: every provided constraint must pass. */
export function useCanAccess(opts: {
  permission?: PermissionKey | PermissionKey[]
  role?: RolePolicy
}): boolean {
  const accessToken = useAuthStore((s) => s.session?.accessToken)
  const userRole = useAuthStore((s) => s.user?.role)
  const permKey = opts.permission
    ? Array.isArray(opts.permission)
      ? opts.permission.join('|')
      : opts.permission
    : ''

  return useMemo(() => {
    const permOk =
      opts.permission === undefined ? true : canPermission(accessToken, opts.permission)
    const roleOk = opts.role === undefined ? true : matchesRolePolicy(userRole, opts.role)
    return permOk && roleOk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userRole, permKey, opts.role])
}
