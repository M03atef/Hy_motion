import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  fetchChurnMetrics,
  fetchConversionMetrics,
  fetchMrr,
  fetchMrrMovement,
  fetchTierDistribution,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { setAccessToken } from '@/lib/api/token'
import { formatEgp, formatPercent } from '@/lib/format'

const server = setupServer(
  http.get('*/platform-api/metrics/mrr', ({ request }) => {
    const asOf = new URL(request.url).searchParams.get('asOf') ?? '2026-08-06'
    return HttpResponse.json({
      asOf,
      mrrEgp: 3998,
      arrEgp: 47976,
      payingTenantCount: 2,
      computedAtUtc: '2026-08-06T10:00:00Z',
      currency: 'EGP',
    })
  }),
  http.get('*/platform-api/metrics/movement', ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (!from || !to) {
      return HttpResponse.json(
        { errorCode: 'RANGE_REQUIRED', errorMessage: 'from and to (yyyy-MM-dd) are required.' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      from,
      to,
      startingMrrEgp: 3000,
      newMrrEgp: 999,
      expansionMrrEgp: 200,
      contractionMrrEgp: 100,
      churnedMrrEgp: 101,
      endingMrrEgp: 3998,
      endingMrrDirectEgp: 3998,
      reconciles: true,
      computedAtUtc: '2026-08-06T10:00:00Z',
    })
  }),
  http.get('*/platform-api/metrics/churn', ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (!from || !to) {
      return HttpResponse.json(
        { errorCode: 'RANGE_REQUIRED', errorMessage: 'from and to (yyyy-MM-dd) are required.' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      from,
      to,
      grossChurnRate: 0.033,
      startingMrrEgp: 3000,
      churnedMrrEgp: 101,
      startingPayingTenants: 3,
      churnedTenants: 1,
      cohorts: [
        { cohortMonth: '2026-06', signedUp: 4, retainedPaying: 2, retentionRate: 0.5 },
      ],
      computedAtUtc: '2026-08-06T10:00:00Z',
    })
  }),
  http.get('*/platform-api/metrics/conversion', ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (!from || !to) {
      return HttpResponse.json(
        { errorCode: 'RANGE_REQUIRED', errorMessage: 'from and to (yyyy-MM-dd) are required.' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      from,
      to,
      trialsStarted: 10,
      convertedToPaid: 4,
      conversionRate: 0.4,
      computedAtUtc: '2026-08-06T10:00:00Z',
    })
  }),
  http.get('*/platform-api/metrics/tier-distribution', ({ request }) => {
    const asOf = new URL(request.url).searchParams.get('asOf') ?? '2026-08-06'
    return HttpResponse.json({
      asOf,
      tiers: [
        { planTier: 'growth', tenantCount: 1, mrrEgp: 1999 },
        { planTier: 'starter', tenantCount: 1, mrrEgp: 999 },
      ],
      totalMrrEgp: 2998,
      totalPayingTenants: 2,
      computedAtUtc: '2026-08-06T10:00:00Z',
    })
  }),
)

beforeAll(() => {
  setAccessToken('support-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('metrics API (MSW)', () => {
  it('loads MRR snapshot and formats EGP without re-dividing annual', async () => {
    const mrr = await fetchMrr('2026-08-06')
    expect(mrr.payingTenantCount).toBe(2)
    expect(formatEgp(mrr.mrrEgp)).toBe('3,998.00 EGP')
    expect(formatEgp(mrr.arrEgp)).toBe('47,976.00 EGP')
  })

  it('requires from/to for movement (400)', async () => {
    await expect(fetchMrrMovement('', '')).rejects.toMatchObject({
      status: 400,
    } satisfies Partial<ApiClientError>)
  })

  it('loads movement, churn, conversion, and tier distribution', async () => {
    const [movement, churn, conversion, tiers] = await Promise.all([
      fetchMrrMovement('2026-08-01', '2026-08-06'),
      fetchChurnMetrics('2026-08-01', '2026-08-06'),
      fetchConversionMetrics('2026-08-01', '2026-08-06'),
      fetchTierDistribution('2026-08-06'),
    ])
    expect(movement.reconciles).toBe(true)
    expect(formatEgp(movement.newMrrEgp)).toBe('999.00 EGP')
    expect(formatPercent(churn.grossChurnRate)).toBe('3.3%')
    expect(churn.cohorts[0]?.cohortMonth).toBe('2026-06')
    expect(formatPercent(conversion.conversionRate)).toBe('40.0%')
    expect(tiers.tiers).toHaveLength(2)
    expect(tiers.totalPayingTenants).toBe(2)
  })
})
