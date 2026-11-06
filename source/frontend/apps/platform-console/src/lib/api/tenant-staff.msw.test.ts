import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  changeTenantStaffRole,
  createTenantStaff,
  disableTenantStaff,
  fetchTenantStaff,
  reactivateTenantStaff,
} from './tenant-staff-api'
import { setAccessToken } from './token'
import { ApiClientError } from './errors'
import type { TenantStaffDto } from './types'

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

let staffByTenant: Record<string, TenantStaffDto[]> = {
  [TENANT_A]: [
    {
      id: 'owner-1',
      fullName: 'Amira Owner',
      email: 'amira@gym-a.test',
      role: 'Owner',
      isActive: true,
      lastLoginAt: '2026-08-20T09:00:00Z',
      createdAtUtc: '2026-01-01T00:00:00Z',
    },
    {
      id: 'trainer-1',
      fullName: 'Karim Trainer',
      email: 'karim@gym-a.test',
      role: 'Trainer',
      isActive: true,
      lastLoginAt: '2026-08-25T09:00:00Z',
      createdAtUtc: '2026-02-01T00:00:00Z',
    },
  ],
  [TENANT_B]: [],
}

function reset() {
  staffByTenant = {
    [TENANT_A]: [
      {
        id: 'owner-1',
        fullName: 'Amira Owner',
        email: 'amira@gym-a.test',
        role: 'Owner',
        isActive: true,
        lastLoginAt: '2026-08-20T09:00:00Z',
        createdAtUtc: '2026-01-01T00:00:00Z',
      },
      {
        id: 'trainer-1',
        fullName: 'Karim Trainer',
        email: 'karim@gym-a.test',
        role: 'Trainer',
        isActive: true,
        lastLoginAt: '2026-08-25T09:00:00Z',
        createdAtUtc: '2026-02-01T00:00:00Z',
      },
    ],
    [TENANT_B]: [],
  }
}

const server = setupServer(
  http.get('*/platform-api/tenants/:tenantId/users', ({ params }) => {
    const tenantId = params.tenantId as string
    return HttpResponse.json(staffByTenant[tenantId] ?? [])
  }),
  http.post('*/platform-api/tenants/:tenantId/users', async ({ params, request }) => {
    const tenantId = params.tenantId as string
    const body = (await request.json()) as { fullName: string; email: string; role: string }
    if (body.role === 'Owner') {
      return HttpResponse.json(
        { errorCode: 'BAD_REQUEST', errorMessage: 'Cannot create owner role via this endpoint.' },
        { status: 400 },
      )
    }
    const created: TenantStaffDto = {
      id: 'new-staff-1',
      fullName: body.fullName,
      email: body.email,
      role: body.role,
      isActive: true,
      lastLoginAt: null,
      createdAtUtc: '2026-08-27T12:00:00Z',
    }
    staffByTenant[tenantId] = [...(staffByTenant[tenantId] ?? []), created]
    return HttpResponse.json(created, { status: 201 })
  }),
  http.post('*/platform-api/tenants/:tenantId/users/:staffId/disable', ({ params }) => {
    const tenantId = params.tenantId as string
    const staffId = params.staffId as string
    const row = (staffByTenant[tenantId] ?? []).find((u) => u.id === staffId)
    if (!row) {
      return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Staff user not found.' }, { status: 404 })
    }
    if (row.role === 'Owner') {
      return HttpResponse.json(
        { errorCode: 'OWNER_PROTECTED', errorMessage: 'The gym owner cannot be disabled.' },
        { status: 403 },
      )
    }
    row.isActive = false
    return HttpResponse.json(row)
  }),
  http.post('*/platform-api/tenants/:tenantId/users/:staffId/reactivate', ({ params }) => {
    const tenantId = params.tenantId as string
    const staffId = params.staffId as string
    const row = (staffByTenant[tenantId] ?? []).find((u) => u.id === staffId)
    if (!row) {
      return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Staff user not found.' }, { status: 404 })
    }
    row.isActive = true
    return HttpResponse.json(row)
  }),
  http.put('*/platform-api/tenants/:tenantId/users/:staffId/role', async ({ params, request }) => {
    const tenantId = params.tenantId as string
    const staffId = params.staffId as string
    const row = (staffByTenant[tenantId] ?? []).find((u) => u.id === staffId)
    if (!row) {
      return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Staff user not found.' }, { status: 404 })
    }
    if (row.role === 'Owner') {
      return HttpResponse.json(
        { errorCode: 'OWNER_PROTECTED', errorMessage: 'The gym owner cannot be demoted.' },
        { status: 403 },
      )
    }
    const body = (await request.json()) as { role: string }
    row.role = body.role
    return HttpResponse.json(row)
  }),
)

beforeAll(() => {
  setAccessToken('ops-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  reset()
  setAccessToken('ops-token')
  server.resetHandlers()
})
afterAll(() => server.close())

describe('tenant staff API (MSW)', () => {
  it('lists staff scoped to the tenant in the URL', async () => {
    const listA = await fetchTenantStaff(TENANT_A)
    expect(listA).toHaveLength(2)
    const listB = await fetchTenantStaff(TENANT_B)
    expect(listB).toHaveLength(0)
  })

  it('creates a staff member and it appears in that tenant only', async () => {
    const created = await createTenantStaff(TENANT_A, {
      fullName: 'New Receptionist',
      email: 'new@gym-a.test',
      password: 'aVeryLongPassword123',
      role: 'Receptionist',
    })
    expect(created.role).toBe('Receptionist')
    expect(await fetchTenantStaff(TENANT_A)).toHaveLength(3)
    expect(await fetchTenantStaff(TENANT_B)).toHaveLength(0)
  })

  it('rejects creating a second Owner', async () => {
    await expect(
      createTenantStaff(TENANT_A, {
        fullName: 'Second Owner',
        email: 'second@gym-a.test',
        password: 'aVeryLongPassword123',
        role: 'Owner',
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<ApiClientError>)
  })

  it('disables and reactivates a non-owner staff member', async () => {
    const disabled = await disableTenantStaff(TENANT_A, 'trainer-1', { reason: 'Left the company effective today.' })
    expect(disabled.isActive).toBe(false)
    const reactivated = await reactivateTenantStaff(TENANT_A, 'trainer-1', { reason: 'Rehired, restoring access.' })
    expect(reactivated.isActive).toBe(true)
  })

  it('changes role for a non-owner staff member', async () => {
    const updated = await changeTenantStaffRole(TENANT_A, 'trainer-1', { role: 'Manager', reason: 'Promoted to floor manager.' })
    expect(updated.role).toBe('Manager')
  })

  it('rejects disabling or demoting the Owner (OWNER_PROTECTED)', async () => {
    await expect(
      disableTenantStaff(TENANT_A, 'owner-1', { reason: 'Attempting to disable the owner.' }),
    ).rejects.toMatchObject({ errorCode: 'OWNER_PROTECTED', status: 403 })
    await expect(
      changeTenantStaffRole(TENANT_A, 'owner-1', { role: 'Manager', reason: 'Attempting to demote the owner.' }),
    ).rejects.toMatchObject({ errorCode: 'OWNER_PROTECTED', status: 403 })
  })

  it('rejects a cross-tenant staff id with NOT_FOUND (backend enforces isolation, not the client)', async () => {
    await expect(
      disableTenantStaff(TENANT_B, 'trainer-1', { reason: 'Cross-tenant probe should fail.' }),
    ).rejects.toMatchObject({ errorCode: 'NOT_FOUND', status: 404 })
  })
})
