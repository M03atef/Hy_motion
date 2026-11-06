import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchAuditLog } from './audit-api'
import { setAccessToken } from './token'

const server = setupServer(
  http.get('*/platform-api/audit', ({ request }) => {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')
    const items = [
      {
        id: '1',
        actorPlatformUserId: 'actor-1',
        actorName: 'Platform Admin',
        action: 'platform.tenant.change_tier',
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        tenantName: 'Fitness Factory',
        gymCode: 'GYM-0142',
        beforeJson: '{"Reason":"Customer requested more capacity"}',
        afterJson: null,
        createdAtUtc: '2026-08-27T15:20:00Z',
      },
    ].filter((row) => !tenantId || row.tenantId === tenantId)

    return HttpResponse.json({
      items,
      totalCount: items.length,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    })
  }),
)

beforeAll(() => {
  setAccessToken('support-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('global audit log API (MSW)', () => {
  it('returns a paged result with tenant name/gym code on each row', async () => {
    const result = await fetchAuditLog({ page: 1, pageSize: 20 })
    expect(result.totalCount).toBe(1)
    expect(result.items[0]?.tenantName).toBe('Fitness Factory')
  })

  it('passes tenantId through as a query filter', async () => {
    const result = await fetchAuditLog({ tenantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', page: 1, pageSize: 20 })
    expect(result.items).toHaveLength(0)
  })
})
