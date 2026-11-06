import { apiRequest } from './client'
import { USAGE_ENDPOINTS, type PlatformUsageSummaryDto } from './types'

/** PlatformSupportOrAbove — same table the per-tenant UsagePanel reads, aggregated cross-tenant. */
export function fetchUsageSummary() {
  return apiRequest<PlatformUsageSummaryDto>({
    method: 'GET',
    url: USAGE_ENDPOINTS.summary,
  })
}
