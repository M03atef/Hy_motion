import { apiRequest } from './client'
import {
  AUDIT_ENDPOINTS,
  type PlatformAuditListParams,
  type PlatformAuditLogDto,
  type PlatformPagedResult,
} from './types'

/**
 * PlatformSupportOrAbove — global (cross-tenant) audit feed. Reads the same platform_audit_log
 * table as the per-tenant RecentAudit panel; omit tenantId for the unfiltered feed.
 */
export function fetchAuditLog(params: PlatformAuditListParams) {
  return apiRequest<PlatformPagedResult<PlatformAuditLogDto>>({
    method: 'GET',
    url: AUDIT_ENDPOINTS.list,
    params,
  })
}
