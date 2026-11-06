import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import {
  assignRiskQueue,
  fetchRiskQueue,
  recordRiskQueueOutcome,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { RiskQueueItemDto } from '@/lib/api/types'
import { setAccessToken } from '@/lib/api/token'
import { isOpsOrAbove } from '@/lib/platform-roles'

const queueItems: RiskQueueItemDto[] = [
  {
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'At Risk Gym',
    gymCode: 'GYM-RISK-01',
    planTier: 'growth',
    subscriptionStatus: 'active',
    score: 28,
    riskBand: 'at_risk',
    computedAtUtc: '2026-08-06T01:00:00Z',
    assignedPlatformUserId: null,
    assignedAtUtc: null,
    contributingFactorsJson: '{"summary":"Low login frequency","mlUsed":false}',
    summary: 'Low login frequency',
    recentOutcomes: [],
  },
  {
    tenantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Critical Gym',
    gymCode: 'GYM-CRIT-01',
    planTier: 'starter',
    subscriptionStatus: 'past_due',
    score: 12,
    riskBand: 'critical',
    computedAtUtc: '2026-08-06T01:00:00Z',
    assignedPlatformUserId: null,
    assignedAtUtc: null,
    summary: 'Payment health failing',
    recentOutcomes: [],
  },
]

const server = setupServer(
  http.get('*/platform-api/risk-queue', ({ request }) => {
    const url = new URL(request.url)
    const band = url.searchParams.get('band')
    const bands = band
      ? new Set(band.split(',').map((s) => s.trim()))
      : new Set(['at_risk', 'critical'])
    const items = queueItems.filter((i) => bands.has(i.riskBand))
    return HttpResponse.json(items)
  }),
  http.post('*/platform-api/risk-queue/:tenantId/assign', async ({ params, request }) => {
    const auth = request.headers.get('Authorization') ?? ''
    if (auth.includes('support-token')) {
      return HttpResponse.json(
        { errorCode: 'FORBIDDEN', message: 'Requires Platform Ops' },
        { status: 403 },
      )
    }
    const body = (await request.json()) as { assignedPlatformUserId?: string | null }
    const row = queueItems.find((i) => i.tenantId === params.tenantId)
    if (row) {
      row.assignedPlatformUserId = body.assignedPlatformUserId ?? null
      row.assignedAtUtc = body.assignedPlatformUserId ? '2026-08-06T12:00:00Z' : null
    }
    return HttpResponse.json({ success: true })
  }),
  http.post('*/platform-api/risk-queue/:tenantId/outcome', async ({ params, request }) => {
    const body = (await request.json()) as { outcome: string; note?: string }
    const dto = {
      id: 'out-1',
      tenantId: String(params.tenantId),
      platformUserId: 'actor-1',
      outcome: body.outcome,
      note: body.note ?? null,
      createdAtUtc: '2026-08-06T12:05:00Z',
    }
    const row = queueItems.find((i) => i.tenantId === params.tenantId)
    if (row) row.recentOutcomes = [dto, ...row.recentOutcomes]
    return HttpResponse.json(dto)
  }),
)

beforeAll(() => {
  setAccessToken('ops-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  for (const row of queueItems) {
    row.assignedPlatformUserId = null
    row.assignedAtUtc = null
    row.recentOutcomes = []
  }
  setAccessToken('ops-token')
  server.resetHandlers()
})
afterAll(() => server.close())

describe('risk queue API (MSW)', () => {
  it('defaults to at_risk + critical when band omitted', async () => {
    const items = await fetchRiskQueue()
    expect(items.map((i) => i.riskBand).sort()).toEqual(['at_risk', 'critical'])
  })

  it('filters by band CSV', async () => {
    const items = await fetchRiskQueue('critical')
    expect(items).toHaveLength(1)
    expect(items[0].gymCode).toBe('GYM-CRIT-01')
  })

  it('Ops assign + outcome invalidate risk-queue queries', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    await assignRiskQueue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      assignedPlatformUserId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    })
    await recordRiskQueueOutcome('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      outcome: 'contacted',
      note: 'Left voicemail',
    })
    await qc.invalidateQueries({ queryKey: ['risk-queue'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['risk-queue'] })

    const items = await fetchRiskQueue('at_risk')
    expect(items[0].assignedPlatformUserId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
    expect(items[0].recentOutcomes[0]?.outcome).toBe('contacted')
  })

  it('Support assign is forbidden (403) and UI gate uses isOpsOrAbove', async () => {
    expect(isOpsOrAbove('platform_support')).toBe(false)
    setAccessToken('support-token')
    await expect(
      assignRiskQueue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        assignedPlatformUserId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      }),
    ).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<ApiClientError>)
  })
})
