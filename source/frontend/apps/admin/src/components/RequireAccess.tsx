import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { PermissionKey } from '@/lib/api'
import type { RolePolicy } from '@/lib/authz'
import type { FeatureModuleKey } from '@/lib/features/probe'
import { tLabel } from '@/lib/i18n/bilingual'
import { useCanAccess } from '@/hooks/useCan'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'
import { useUiStore } from '@/stores/ui-store'

export function RequireAccess({
  permission,
  role,
  featureModule,
  children,
}: {
  permission?: PermissionKey | PermissionKey[]
  role?: RolePolicy
  featureModule?: FeatureModuleKey
  children: ReactNode
}) {
  const allowed = useCanAccess({ permission, role })
  const moduleOk = useFeatureFlagsStore((s) =>
    featureModule ? s.isModuleAvailable(featureModule) : true,
  )
  const status = useFeatureFlagsStore((s) => s.status)
  const locale = useUiStore((s) => s.locale)

  if (featureModule && status !== 'ready') {
    return (
      <p className="text-sm text-[var(--ltt)]">
        {tLabel('Checking module availability…', 'جارٍ التحقق من توفر الوحدة…', locale)}
      </p>
    )
  }

  if (!moduleOk) {
    // Never render a clickable-but-broken module surface.
    return <Navigate to="/app" replace />
  }

  if (!allowed) {
    return <Navigate to="/app" replace />
  }

  return children
}
