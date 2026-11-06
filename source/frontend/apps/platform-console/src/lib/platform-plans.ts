/**
 * Trial default when not specified at provision. Plan list prices come from GET /platform-api/plans.
 */
export const PLATFORM_TRIAL_DAYS = 14

export function planDisplayLabel(tier: string | null | undefined, plans?: { tier: string; displayName: string }[]): string {
  if (!tier) return '—'
  const hit = plans?.find((p) => p.tier === tier.toLowerCase())
  if (hit) return hit.displayName
  const normalized = tier.toLowerCase()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
