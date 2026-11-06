import { describe, expect, it } from 'vitest'
import { planTierRank, PLAN_TIERS } from '@/lib/api/types'

describe('planTierRank', () => {
  it('orders starter < growth < pro < enterprise', () => {
    expect(planTierRank('starter')).toBeLessThan(planTierRank('growth'))
    expect(planTierRank('growth')).toBeLessThan(planTierRank('pro'))
    expect(planTierRank('pro')).toBeLessThan(planTierRank('enterprise'))
  })

  it('covers every known tier', () => {
    PLAN_TIERS.forEach((tier) => expect(planTierRank(tier)).toBeGreaterThanOrEqual(0))
  })

  it('returns -1 for an unknown tier rather than throwing', () => {
    expect(planTierRank('unknown')).toBe(-1)
  })
})
