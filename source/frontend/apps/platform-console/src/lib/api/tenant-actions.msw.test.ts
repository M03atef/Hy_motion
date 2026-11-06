import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { cancelTenantSubscription, changeTenantTier, convertTrialTenant, restartPaidTenant } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { setAccessToken } from '@/lib/api/token'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const server = setupServer(
  http.post(`*/platform-api/tenants/${TENANT_ID}/subscription/change-tier`, async ({ request }) => {
    const body = (await request.json()) as { newTier: string; effectiveNow: boolean; reason?: string }
    if (body.newTier === 'growth') {
      return HttpResponse.json({
        success: false,
        errorCode: 'SAME_TIER',
        errorMessage: 'Tenant is already on this tier.',
      }, { status: 400 })
    }
    return HttpResponse.json({
      success: true,
      errorCode: null,
      errorMessage: null,
      subscription: {
        id: 'sub-1',
        tenantId: TENANT_ID,
        planTier: body.newTier,
        status: 'active',
        billingCycle: 'monthly',
        priceEgp: 3999,
        currentPeriodStart: '2026-08-01',
        currentPeriodEnd: '2026-08-31',
        trialEndsAtUtc: null,
        cancelAtPeriodEnd: false,
        cancelledAtUtc: null,
        updatedAtUtc: '2026-08-27T00:00:00Z',
        pendingDowngradeTier: body.effectiveNow ? null : 'growth',
      },
    })
  }),
  http.post(`*/platform-api/tenants/${TENANT_ID}/subscription/cancel`, async ({ request }) => {
    const body = (await request.json()) as { immediate: boolean; reason?: string }
    if (!body.reason) {
      return HttpResponse.json(
        { success: false, errorCode: 'REASON_REQUIRED', errorMessage: 'Reason is required.' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      success: true,
      errorCode: null,
      errorMessage: null,
      subscription: {
        id: 'sub-1',
        tenantId: TENANT_ID,
        planTier: 'growth',
        status: body.immediate ? 'cancelled' : 'active',
        billingCycle: 'monthly',
        priceEgp: 1999,
        currentPeriodStart: '2026-08-01',
        currentPeriodEnd: '2026-08-31',
        trialEndsAtUtc: null,
        cancelAtPeriodEnd: !body.immediate,
        cancelledAtUtc: body.immediate ? '2026-08-27T00:00:00Z' : null,
        updatedAtUtc: '2026-08-27T00:00:00Z',
        pendingDowngradeTier: null,
      },
    })
  }),
  http.post(`*/platform-api/tenants/${TENANT_ID}/subscription/convert-trial`, async ({ request }) => {
    const body = (await request.json()) as { reason: string }
    if (!body.reason?.trim()) {
      return HttpResponse.json(
        { success: false, errorCode: 'REASON_REQUIRED', errorMessage: 'Reason required.' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      success: true,
      subscription: {
        id: 'sub-1',
        tenantId: TENANT_ID,
        planTier: 'growth',
        status: 'active',
        billingCycle: 'monthly',
        priceEgp: 1999,
        currentPeriodStart: '2026-08-01',
        currentPeriodEnd: '2026-08-14',
        trialEndsAtUtc: null,
        cancelAtPeriodEnd: false,
        updatedAtUtc: '2026-08-27T00:00:00Z',
      },
    })
  }),
  http.post(`*/platform-api/tenants/${TENANT_ID}/subscription/restart-paid`, async ({ request }) => {
    const body = (await request.json()) as { tier: string; reason: string }
    return HttpResponse.json({
      success: true,
      subscription: {
        id: 'sub-new',
        tenantId: TENANT_ID,
        planTier: body.tier,
        status: 'active',
        billingCycle: 'monthly',
        priceEgp: 3999,
        currentPeriodStart: '2026-08-27',
        currentPeriodEnd: '2026-09-26',
        trialEndsAtUtc: null,
        cancelAtPeriodEnd: false,
        updatedAtUtc: '2026-08-27T00:00:00Z',
      },
    })
  }),
)

beforeAll(() => {
  setAccessToken('test-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('changeTenantTier', () => {
  it('returns the updated subscription on success', async () => {
    const result = await changeTenantTier(TENANT_ID, {
      newTier: 'pro',
      effectiveNow: true,
      reason: 'Owner requested upgrade over the phone.',
    })
    expect(result.success).toBe(true)
    expect(result.subscription?.planTier).toBe('pro')
  })

  it('surfaces the backend errorMessage on failure (400)', async () => {
    await expect(
      changeTenantTier(TENANT_ID, { newTier: 'growth', effectiveNow: false, reason: 'test' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Tenant is already on this tier.',
    } satisfies Partial<ApiClientError>)
  })

  it('marks a scheduled downgrade via pendingDowngradeTier', async () => {
    const result = await changeTenantTier(TENANT_ID, {
      newTier: 'starter',
      effectiveNow: false,
      reason: 'Tenant requested downsizing at renewal.',
    })
    expect(result.subscription?.pendingDowngradeTier).toBe('growth')
  })
})

describe('cancelTenantSubscription', () => {
  it('schedules cancel-at-period-end by default', async () => {
    const result = await cancelTenantSubscription(TENANT_ID, {
      immediate: false,
      reason: 'Owner closing the gym at contract end.',
    })
    expect(result.subscription?.cancelAtPeriodEnd).toBe(true)
    expect(result.subscription?.status).toBe('active')
  })

  it('cancels immediately when requested', async () => {
    const result = await cancelTenantSubscription(TENANT_ID, {
      immediate: true,
      reason: 'Fraudulent signup confirmed by support.',
    })
    expect(result.subscription?.status).toBe('cancelled')
    expect(result.subscription?.cancelledAtUtc).toBeTruthy()
  })
})

describe('convertTrialTenant', () => {
  it('returns active subscription after convert', async () => {
    const result = await convertTrialTenant(TENANT_ID, { reason: 'Contract signed offline.' })
    expect(result.success).toBe(true)
    expect(result.subscription?.status).toBe('active')
    expect(result.subscription?.trialEndsAtUtc).toBeNull()
  })
})

describe('restartPaidTenant', () => {
  it('creates new active subscription row', async () => {
    const result = await restartPaidTenant(TENANT_ID, {
      tier: 'pro',
      reason: 'Customer returned after churn.',
    })
    expect(result.success).toBe(true)
    expect(result.subscription?.id).toBe('sub-new')
    expect(result.subscription?.planTier).toBe('pro')
  })
})
