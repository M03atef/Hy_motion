import type { PermissionKey } from '@/lib/api'
import {
  canPermission,
  getRoleFromToken,
  matchesRolePolicy,
  type RolePolicy,
} from '@/lib/authz'
import type { FeatureModuleKey } from '@/lib/features/probe'
import type { NavAccess, NavCategory, NavItem } from '@/config/nav'

/**
 * Pure access check — never branch on role string at call sites; use this against claims.
 * Claims are baked into the JWT at login; re-evaluate on login/refresh only.
 */
export function canAccess(
  access: NavAccess,
  opts: {
    accessToken: string | null | undefined
    /** Prefer login user.role; falls back to JWT role claim. */
    role?: string | null
  },
): boolean {
  const role = opts.role ?? getRoleFromToken(opts.accessToken ?? null)

  switch (access.kind) {
    case 'permission':
      return canPermission(opts.accessToken, access.value as PermissionKey | PermissionKey[])
    case 'policy':
      return matchesRolePolicy(role, access.value as RolePolicy)
    case 'any':
      return matchesRolePolicy(role, 'AnyStaff')
    default:
      return false
  }
}

export function isNavItemVisible(
  item: NavItem,
  opts: {
    accessToken: string | null | undefined
    role?: string | null
    isModuleAvailable: (key: FeatureModuleKey) => boolean
  },
): boolean {
  if (item.featureFlag && !opts.isModuleAvailable(item.featureFlag)) {
    return false
  }
  return canAccess(item.access, { accessToken: opts.accessToken, role: opts.role })
}

/** Filter categories by access + feature flags; drop empty categories. */
export function filterVisibleNav(
  categories: NavCategory[],
  opts: {
    accessToken: string | null | undefined
    role?: string | null
    isModuleAvailable: (key: FeatureModuleKey) => boolean
  },
): NavCategory[] {
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => isNavItemVisible(item, opts)),
    }))
    .filter((cat) => cat.items.length > 0)
}
