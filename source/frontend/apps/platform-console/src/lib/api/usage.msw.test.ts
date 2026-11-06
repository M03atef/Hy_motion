import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchUsageSummary } from './usage-api'
import { setAccessToken } from './token'
import { ApiClientError } from './errors'

const server = setupServer(
  http.get('*/platform-api/usage/summary', () =>
    HttpResponse.json({
      period: '2026-08',
      totals: [
        { metric: 'active_members', totalCount: 48210, tenantCount: 146 },
        { metric: 'whatsapp_messages', totalCount: 612900, tenantCount: 98 },
      ],
      tenantsNearLimit: [
        {
          tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          tenantName: 'Urban Strength',
          gymCode: 'GYM-0177',
          metric: 'whatsapp_messages',
          count: 4600,
          cap: 5000,
          percentOfCap: 92,
        },
      ],
      computedAtUtc: '2026-08-27T03:00:00Z',
    }),
  ),
)

beforeAll(() => {
  setAccessToken('support-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('usage summary API (MSW)', () => {
  it('returns the real response shape unchanged', async () => {
    const summary = await fetchUsageSummary()
    expect(summary.period).toBe('2026-08')
    expect(summary.totals).toHaveLength(2)
    expect(summary.tenantsNearLimit[0]?.percentOfCap).toBe(92)
  })

  it('surfaces a 403 as an ApiClientError (Support/Ops/Admin all allowed server-side)', async () => {
    server.use(
      http.get('*/platform-api/usage/summary', () =>
        HttpResponse.json({ errorCode: 'FORBIDDEN', errorMessage: 'Forbidden' }, { status: 403 }),
      ),
    )
    await expect(fetchUsageSummary()).rejects.toBeInstanceOf(ApiClientError)
  })
})
