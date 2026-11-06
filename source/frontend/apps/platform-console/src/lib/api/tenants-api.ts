import { apiRequest } from './client'
import {
  TENANT_ENDPOINTS,
  type PlatformInvoiceDto,
  type PlatformPagedResult,
  type PlatformTenantDetailDto,
  type PlatformTenantListItemDto,
  type ProvisionTenantRequest,
  type ProvisionTenantResponse,
  type SubscriptionChangeDto,
} from './types'

export interface TenantListParams {
  status?: string
  tier?: string
  /** CSV of healthy|watch|at_risk|critical — same ParseCsv as status/tier on the API. */
  riskBand?: string
  search?: string
  page?: number
  pageSize?: number
  /** yyyy-MM-dd — only tenants whose live subscription's CurrentPeriodEnd is on or before this date. */
  renewingBefore?: string
  /** When false, tenants with no platform subscription row (orphaned provisioning). */
  hasSubscription?: boolean
}

export function fetchTenants(params: TenantListParams) {
  return apiRequest<PlatformPagedResult<PlatformTenantListItemDto>>({
    method: 'GET',
    url: TENANT_ENDPOINTS.list,
    params,
  })
}

/** Same status vocabulary as Badges.tsx STATUS_STYLES / backend SubscriptionStatuses. */
export const TENANT_STATUSES = ['trialing', 'active', 'past_due', 'suspended', 'cancelled'] as const

export interface TenantStatusCounts {
  total: number
  byStatus: Record<(typeof TENANT_STATUSES)[number], number>
}

/**
 * Dashboard tile counts, without loading tenant rows into the browser — each call asks the
 * existing paged list endpoint for pageSize=1 and reads only `totalCount` from the response.
 * There is no dedicated counts/aggregate endpoint on the backend; this is the lightest honest
 * way to get real numbers from data that already exists.
 */
export async function fetchTenantStatusCounts(): Promise<TenantStatusCounts> {
  const [totalResult, ...statusResults] = await Promise.all([
    fetchTenants({ pageSize: 1 }),
    ...TENANT_STATUSES.map((status) => fetchTenants({ status, pageSize: 1 })),
  ])

  const byStatus = Object.fromEntries(
    TENANT_STATUSES.map((status, i) => [status, statusResults[i].totalCount]),
  ) as TenantStatusCounts['byStatus']

  return { total: totalResult.totalCount, byStatus }
}

export function fetchTenantDetail(id: string) {
  return apiRequest<PlatformTenantDetailDto>({
    method: 'GET',
    url: TENANT_ENDPOINTS.detail(id),
  })
}

export function fetchSubscriptionChanges(id: string) {
  return apiRequest<SubscriptionChangeDto[]>({
    method: 'GET',
    url: TENANT_ENDPOINTS.changes(id),
  })
}

export function fetchTenantInvoices(id: string) {
  return apiRequest<PlatformInvoiceDto[]>({
    method: 'GET',
    url: TENANT_ENDPOINTS.invoices(id),
  })
}

/** Ops+ only — creates Tenant + Owner + StartTrial. Never log `ownerPassword`. */
export function provisionTenant(body: ProvisionTenantRequest) {
  return apiRequest<ProvisionTenantResponse>({
    method: 'POST',
    url: TENANT_ENDPOINTS.provision,
    data: body,
  })
}
