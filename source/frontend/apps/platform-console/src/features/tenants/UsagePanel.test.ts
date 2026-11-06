import { describe, expect, it } from 'vitest'
import {
  capTone,
  formatUsagePeriodLabel,
  toTenantUsageView,
} from '@/features/tenants/UsagePanel'
import type { UsageCounterDto } from '@/lib/api/types'

describe('UsagePanel helpers', () => {
  const sample: UsageCounterDto[] = [
    {
      period: '2026-07',
      metric: 'active_members',
      count: 412,
      cap: 500,
      overageBilledEgp: null,
      updatedAtUtc: '2026-07-30T01:30:00Z',
    },
    {
      period: '2026-07',
      metric: 'whatsapp_messages',
      count: 980,
      cap: 500,
      overageBilledEgp: 340,
      updatedAtUtc: '2026-07-30T02:00:00Z',
    },
    {
      period: '2026-07',
      metric: 'staff_seats',
      count: 4,
      cap: null,
      overageBilledEgp: null,
      updatedAtUtc: '2026-07-30T01:30:00Z',
    },
  ]

  it('derives nested usage view from flat usageCounters without inventing wire shape', () => {
    const view = toTenantUsageView(sample)
    expect(view?.period).toBe('2026-07')
    expect(view?.asOfUtc).toBe('2026-07-30T02:00:00Z')
    expect(view?.metrics.map((m) => m.metric)).toEqual([
      'active_members',
      'whatsapp_messages',
      'staff_seats',
    ])
  })

  it('formats YYYY-MM period for the panel header', () => {
    expect(formatUsagePeriodLabel('2026-07')).toBe('July 2026')
  })

  it('applies unmissable cap color thresholds', () => {
    expect(capTone(79, 100)).toBe('green')
    expect(capTone(80, 100)).toBe('amber')
    expect(capTone(99, 100)).toBe('amber')
    expect(capTone(100, 100)).toBe('red')
    expect(capTone(4, null)).toBe('unlimited')
  })
})
