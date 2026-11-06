import { useMemo } from 'react'
import { NAV_CATEGORIES, type NavCategory } from '@/config/nav'
import { filterVisibleNav } from '@/config/nav-visibility'
import { useAuthStore } from '@/stores/auth-store'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'

export { canAccess, filterVisibleNav, isNavItemVisible } from '@/config/nav-visibility'

/**
 * Categories visible for the current session JWT + cached feature-flag registry.
 * Re-evaluates when access token / role / module probe cache changes (login/refresh),
 * not on a timer — claims are baked into the JWT.
 */
export function useVisibleNav(): NavCategory[] {
  const accessToken = useAuthStore((s) => s.session?.accessToken)
  const role = useAuthStore((s) => s.user?.role)
  const isModuleAvailable = useFeatureFlagsStore((s) => s.isModuleAvailable)
  const modules = useFeatureFlagsStore((s) => s.modules)
  const status = useFeatureFlagsStore((s) => s.status)

  return useMemo(
    () =>
      filterVisibleNav(NAV_CATEGORIES, {
        accessToken,
        role,
        isModuleAvailable,
      }),
    [accessToken, role, isModuleAvailable, modules, status],
  )
}
