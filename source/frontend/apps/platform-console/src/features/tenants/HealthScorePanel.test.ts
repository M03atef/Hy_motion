import { describe, expect, it } from 'vitest'
import {
  factorLabel,
  impactFromScore,
  toHealthScoreView,
} from '@/features/tenants/HealthScorePanel'
import type { TenantHealthScoreDto } from '@/lib/api/types'

describe('HealthScorePanel helpers', () => {
  const health: TenantHealthScoreDto = {
    score: 42,
    riskBand: 'at_risk',
    computedAtUtc: '2026-07-30T03:00:00Z',
    confidence: 0.9,
    summary: 'Weak login + payment pressure.',
    contributingFactorsJson: JSON.stringify({
      model: 'rules_v1',
      signals: [
        {
          key: 'login_frequency',
          label: 'Login frequency',
          available: true,
          score: 10,
          configuredWeight: 0.2,
          summary: 'Staff quiet for 45 day(s).',
        },
        {
          key: 'payment_health',
          label: 'Payment health',
          available: true,
          score: 25,
          configuredWeight: 0.3,
          summary: '1 unpaid invoice.',
        },
        {
          key: 'usage_vs_cap',
          available: true,
          score: 90,
          configuredWeight: 0.15,
          summary: 'Well under caps.',
        },
      ],
    }),
  }

  it('returns null view when health is not yet computed', () => {
    expect(toHealthScoreView(null)).toBeNull()
    expect(toHealthScoreView(undefined)).toBeNull()
  })

  it('parses contributingFactorsJson and sorts by weight descending', () => {
    const view = toHealthScoreView(health)
    expect(view?.score).toBe(42)
    expect(view?.riskBand).toBe('at_risk')
    expect(view?.contributingFactors.map((f) => f.factor)).toEqual([
      'payment_health',
      'login_frequency',
      'usage_vs_cap',
    ])
    expect(view?.contributingFactors[0]?.weight).toBe(0.3)
  })

  it('maps keys to readable labels when API label missing', () => {
    expect(factorLabel('login_frequency')).toBe('Owner login frequency')
    expect(factorLabel('login_frequency', 'Login frequency')).toBe('Login frequency')
  })

  it('derives impact from signal score', () => {
    expect(impactFromScore(90, true)).toBe('positive')
    expect(impactFromScore(50, true)).toBe('neutral')
    expect(impactFromScore(10, true)).toBe('negative')
    expect(impactFromScore(null, false)).toBe('neutral')
  })
})
