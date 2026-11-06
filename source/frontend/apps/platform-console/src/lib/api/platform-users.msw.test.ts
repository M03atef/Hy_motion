import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  changePlatformUserRole,
  createPlatformUser,
  disablePlatformUser,
  fetchPlatformUsers,
  reactivatePlatformUser,
} from './platform-users-api'
import { setAccessToken } from './token'
import { ApiClientError } from './errors'
import type { PlatformUserDto } from './types'

let users: PlatformUserDto[] = [
  {
    id: 'admin-1',
    email: 'admin@HyMotion.com',
    fullName: 'Platform Admin',
    role: 'platform_admin',
    isActive: true,
    mfaEnabled: true,
    lastLoginAtUtc: '2026-08-27T09:00:00Z',
    createdAtUtc: '2026-07-26T00:00:00Z',
  },
  {
    id: 'ops-1',
    email: 'sarah.ops@HyMotion.com',
    fullName: 'Sarah Nabil',
    role: 'platform_ops',
    isActive: true,
    mfaEnabled: true,
    lastLoginAtUtc: '2026-08-27T08:12:00Z',
    createdAtUtc: '2026-08-02T00:00:00Z',
  },
]

const server = setupServer(
  http.get('*/platform-api/platform-users', ({ request }) => {
    const auth = request.headers.get('Authorization') ?? ''
    if (!auth.includes('admin-token')) {
      return HttpResponse.json({ errorCode: 'FORBIDDEN', errorMessage: 'Forbidden' }, { status: 403 })
    }
    return HttpResponse.json(users)
  }),
  http.post('*/platform-api/platform-users', async ({ request }) => {
    const body = (await request.json()) as { email: string; fullName: string; role: string }
    const created = {
      id: 'new-user-1',
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      isActive: true,
      mfaEnabled: false,
      lastLoginAtUtc: null,
      createdAtUtc: '2026-08-27T12:00:00Z',
    }
    users = [...users, created]
    return HttpResponse.json(created, { status: 201 })
  }),
  http.post('*/platform-api/platform-users/:id/disable', ({ params }) => {
    if (params.id === 'admin-1') {
      return HttpResponse.json({ success: false, errorCode: 'SELF_PROTECTED', errorMessage: "You can't disable your own account." }, { status: 400 })
    }
    const row = users.find((u) => u.id === params.id)
    if (!row) return HttpResponse.json({ success: false, errorCode: 'NOT_FOUND' }, { status: 404 })
    row.isActive = false
    return HttpResponse.json(row)
  }),
  http.post('*/platform-api/platform-users/:id/reactivate', ({ params }) => {
    const row = users.find((u) => u.id === params.id)
    if (!row) return HttpResponse.json({ success: false, errorCode: 'NOT_FOUND' }, { status: 404 })
    row.isActive = true
    return HttpResponse.json(row)
  }),
  http.put('*/platform-api/platform-users/:id/role', async ({ params, request }) => {
    if (params.id === 'admin-1') {
      return HttpResponse.json({ success: false, errorCode: 'SELF_PROTECTED', errorMessage: "You can't change your own role." }, { status: 400 })
    }
    const body = (await request.json()) as { role: string }
    const row = users.find((u) => u.id === params.id)
    if (!row) return HttpResponse.json({ success: false, errorCode: 'NOT_FOUND' }, { status: 404 })
    row.role = body.role
    return HttpResponse.json(row)
  }),
)

beforeAll(() => {
  setAccessToken('admin-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  users = users.filter((u) => u.id === 'admin-1' || u.id === 'ops-1')
  users[1].isActive = true
  users[1].role = 'platform_ops'
  setAccessToken('admin-token')
  server.resetHandlers()
})
afterAll(() => server.close())

describe('platform users API (MSW)', () => {
  it('lists platform users for an admin token', async () => {
    const list = await fetchPlatformUsers()
    expect(list).toHaveLength(2)
    expect(list[0]?.role).toBe('platform_admin')
  })

  it('is forbidden for a non-admin token (whole resource is PlatformAdminOnly)', async () => {
    setAccessToken('ops-token')
    await expect(fetchPlatformUsers()).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiClientError>)
  })

  it('creates a user and it appears in the list', async () => {
    const created = await createPlatformUser({
      email: 'new@HyMotion.com',
      fullName: 'New Person',
      role: 'platform_support',
      password: 'aVeryLongPassword123',
    })
    expect(created.id).toBe('new-user-1')
    const list = await fetchPlatformUsers()
    expect(list.some((u) => u.id === 'new-user-1')).toBe(true)
  })

  it('disables and reactivates a non-self user', async () => {
    const disabled = await disablePlatformUser('ops-1')
    expect(disabled.isActive).toBe(false)
    const reactivated = await reactivatePlatformUser('ops-1')
    expect(reactivated.isActive).toBe(true)
  })

  it('changes role for a non-self user', async () => {
    const updated = await changePlatformUserRole('ops-1', { role: 'platform_admin' })
    expect(updated.role).toBe('platform_admin')
  })

  it('backend rejects self-disable and self-role-change (SELF_PROTECTED)', async () => {
    await expect(disablePlatformUser('admin-1')).rejects.toMatchObject({ errorCode: 'SELF_PROTECTED' })
    await expect(changePlatformUserRole('admin-1', { role: 'platform_ops' })).rejects.toMatchObject({
      errorCode: 'SELF_PROTECTED',
    })
  })
})
