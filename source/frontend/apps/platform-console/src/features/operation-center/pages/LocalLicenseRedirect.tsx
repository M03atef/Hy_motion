import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsEmptyState } from '@/design-system'
import { fetchLocalLicenseDetail } from '@/lib/api'
import type { LocalLicenseDetailDto } from '@/lib/api/types'
import { OcLoadError, OcSkeletons } from '../ui'
import { useOcCopy } from '../useOcCopy'

/** Pure destination for legacy `/local-licenses/:id` bookmarks. */
export function localLicenseRedirectPath(license: Pick<LocalLicenseDetailDto, 'id' | 'customerId'>): string {
  if (license.customerId) return `/oc/gyms/local/${license.customerId}`
  return `/oc/gyms/licenses/${license.id}`
}

/**
 * Compatibility entry for Control Plane `/local-licenses/:id`.
 * Linked licenses → Local Gym360; unlinked → OC unlinked license page.
 */
export function LocalLicenseRedirect() {
  const { id = '' } = useParams()
  const t = useOcCopy()
  const query = useQuery({
    queryKey: ['local-license', id],
    queryFn: () => fetchLocalLicenseDetail(id),
    enabled: Boolean(id),
    retry: false,
  })

  if (!id) return <Navigate to="/oc/gyms?filter=unlinked" replace />
  if (query.isLoading) return <OcSkeletons rows={3} />
  if (query.isError) {
    return (
      <OcLoadError
        error={query.error}
        source={`GET /platform-api/local-licenses/${id}`}
        onRetry={() => void query.refetch()}
      />
    )
  }
  const license = query.data
  if (!license) return <DsEmptyState title={t('gyms.notFound')} />
  return <Navigate to={localLicenseRedirectPath(license)} replace />
}
