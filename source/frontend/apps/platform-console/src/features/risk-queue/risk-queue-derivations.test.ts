import { describe, expect, it } from 'vitest'
import { deriveStatus, primaryDrivers } from './RiskQueuePage'
import type { RiskQueueItemDto } from '@/lib/api/types'

function baseRow(overrides: Partial<RiskQueueItemDto> = {}): RiskQueueItemDto {
  return {
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Test Gym',
    gymCode: 'GYM-TEST',
    planTier: 'growth',
    subscriptionStatus: 'active',
    score: 30,
    riskBand: 'at_risk',
    computedAtUtc: '2026-08-06T01:00:00Z',
    assignedPlatformUserId: null,
    assignedAtUtc: null,
    recentOutcomes: [],
    ...overrides,
  }
}

describe('deriveStatus (UX-only grouping, not a persisted field)', () => {
  it('is "new" when no outcome has been recorded', () => {
    expect(deriveStatus(baseRow())).toBe('new')
  })

  it('is "in_progress" for a non-terminal outcome', () => {
    const row = baseRow({
      recentOutcomes: [
        { id: '1', tenantId: 't1', platformUserId: 'u1', outcome: 'contacted', createdAtUtc: '2026-08-06T00:00:00Z' },
      ],
    })
    expect(deriveStatus(row)).toBe('in_progress')
  })

  it('is "resolved" when the latest outcome is terminal (retained or churned)', () => {
    const retained = baseRow({
      recentOutcomes: [
        { id: '1', tenantId: 't1', platformUserId: 'u1', outcome: 'retained', createdAtUtc: '2026-08-06T00:00:00Z' },
      ],
    })
    const churned = baseRow({
      recentOutcomes: [
        { id: '1', tenantId: 't1', platformUserId: 'u1', outcome: 'churned', createdAtUtc: '2026-08-06T00:00:00Z' },
      ],
    })
    expect(deriveStatus(retained)).toBe('resolved')
    expect(deriveStatus(churned)).toBe('resolved')
  })

  it('uses only the most recent outcome, not history', () => {
    const row = baseRow({
      recentOutcomes: [
        { id: '2', tenantId: 't1', platformUserId: 'u1', outcome: 'no_answer', createdAtUtc: '2026-08-07T00:00:00Z' },
        { id: '1', tenantId: 't1', platformUserId: 'u1', outcome: 'retained', createdAtUtc: '2026-08-06T00:00:00Z' },
      ],
    })
    expect(deriveStatus(row)).toBe('in_progress')
  })
})

describe('primaryDrivers', () => {
  it('returns empty array when no contributing factors are present', () => {
    expect(primaryDrivers(null)).toEqual([])
    expect(primaryDrivers(undefined)).toEqual([])
  })

  it('returns empty array on unparsable JSON rather than throwing', () => {
    expect(primaryDrivers('not json')).toEqual([])
  })

  it('picks the two lowest-scoring available signals, sorted ascending', () => {
    const json = JSON.stringify({
      signals: [
        { key: 'login_frequency', label: 'Login frequency', available: true, score: 80 },
        { key: 'payment_health', label: 'Payment health', available: true, score: 10 },
        { key: 'usage_vs_cap', label: 'Usage vs cap', available: true, score: 40 },
        { key: 'support_ticket_volume', available: false, score: null },
      ],
    })
    expect(primaryDrivers(json)).toEqual(['Payment health', 'Usage vs cap'])
  })
})
