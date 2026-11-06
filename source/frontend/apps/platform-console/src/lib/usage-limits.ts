import type { TenantNearLimitDto } from '@/lib/api/types'

export type LimitTier = 'approaching' | 'critical' | 'exceeded'

export function limitTier(percentOfCap: number): LimitTier {
  if (percentOfCap >= 100) return 'exceeded'
  if (percentOfCap >= 90) return 'critical'
  return 'approaching'
}

export const LIMIT_TIER_LABEL: Record<LimitTier, string> = {
  approaching: '≥ 80%',
  critical: '≥ 90%',
  exceeded: '≥ 100%',
}

export const LIMIT_TIER_BADGE: Record<LimitTier, string> = {
  approaching: 'cp-status cp-status-warning',
  critical: 'cp-status cp-status-danger',
  exceeded: 'cp-status cp-status-danger',
}

export function groupByLimitTier(rows: TenantNearLimitDto[]): Record<LimitTier, TenantNearLimitDto[]> {
  const groups: Record<LimitTier, TenantNearLimitDto[]> = { exceeded: [], critical: [], approaching: [] }
  for (const row of rows) {
    groups[limitTier(row.percentOfCap)].push(row)
  }
  return groups
}
