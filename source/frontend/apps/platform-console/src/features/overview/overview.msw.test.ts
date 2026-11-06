import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchTenantStatusCounts } from '@/lib/api'
import { setAccessToken } from '@/lib/api/token'

const TENANTS = [
  { id: '1', status: 'active' },
  { id: '2', status: 'active' },
  { id: '3', status: 'trialing' },
  { id: '4', status: 'past_due' },
  { id: '5', status: 'suspended' },
]

const server = setupServer(
  http.get('*/platform-api/tenants', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? ''
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20')
    const filtered = status ? TENANTS.filter((t) => t.status === status) : TENANTS
    return HttpResponse.json({
      items: filtered.slice(0, pageSize),
      totalCount: filtered.length,
      page: 1,
      pageSize,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    })
  }),
)

beforeAll(() => {
  setAccessToken('test-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchTenantStatusCounts', () => {
  it('reads totalCount per status without fetching full tenant rows', async () => {
    const result = await fetchTenantStatusCounts()

    expect(result.total).toBe(5)
    expect(result.byStatus).toEqual({
      trialing: 1,
      active: 2,
      past_due: 1,
      suspended: 1,
      cancelled: 0,
    })
  })
})
