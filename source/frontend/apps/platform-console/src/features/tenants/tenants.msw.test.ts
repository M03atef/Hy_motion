import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import {
  fetchSubscriptionChanges,
  fetchTenantDetail,
  fetchTenantInvoices,
  fetchTenants,
  provisionTenant,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { setAccessToken } from '@/lib/api/token'
import { formatEgp } from '@/lib/format'

const provisioned: Array<{ id: string; name: string; gymCode: string }> = []

const server = setupServer(
  http.get('*/platform-api/tenants', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search') ?? ''
    const status = url.searchParams.get('status') ?? ''
    let items = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Cairo Fit',
        gymCode: 'GYM-CAI-01',
        planTier: 'growth',
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodEnd: '2026-08-28',
        priceEgp: 1999,
        riskBand: 'watch',
        healthScore: 62,
        lastLoginAtUtc: '2026-07-28T09:00:00Z',
        ownerName: 'Sara Haddad',
        ownerEmail: 'sara@cairofit.example',
        memberCount: 412,
        memberCap: 500,
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Alex Gym',
        gymCode: 'GYM-ALX-01',
        planTier: 'starter',
        status: 'trialing',
        billingCycle: 'monthly',
        currentPeriodEnd: '2026-08-10',
        priceEgp: 999,
        riskBand: 'healthy',
        healthScore: 88,
        lastLoginAtUtc: null,
        // No active Owner account and no usage rollup yet — both null, not zero.
        ownerName: null,
        ownerEmail: null,
        memberCount: null,
        memberCap: null,
      },
      ...provisioned.map((p) => ({
        id: p.id,
        name: p.name,
        gymCode: p.gymCode,
        planTier: 'growth',
        status: 'trialing',
        billingCycle: 'monthly',
        currentPeriodEnd: '2026-08-20',
        priceEgp: 1999,
        riskBand: null,
        healthScore: null,
        lastLoginAtUtc: null,
        ownerName: null,
        ownerEmail: null,
        memberCount: 0,
        memberCap: 300,
      })),
    ]
    if (search) items = items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    if (status) {
      const set = new Set(status.split(','))
      items = items.filter((t) => set.has(t.status))
    }
    const riskBand = url.searchParams.get('riskBand') ?? ''
    if (riskBand) {
      const set = new Set(riskBand.split(','))
      items = items.filter((t) => t.riskBand && set.has(t.riskBand))
    }
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
  http.post('*/platform-api/tenants/provision', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    expect(body.ownerPassword).toBeTruthy()
    if (body.ownerEmail === 'taken@example.com') {
      return HttpResponse.json(
        {
          errorCode: 'PROVISION_FAILED',
          message: 'Owner email is already registered / already registered',
        },
        { status: 400 },
      )
    }
    const id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const gymCode = typeof body.gymCode === 'string' && body.gymCode ? body.gymCode : 'GYM-NEW-01'
    provisioned.push({ id, name: String(body.name), gymCode })
    return HttpResponse.json(
      {
        tenantId: id,
        gymCode,
        ownerUserId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        ownerEmail: body.ownerEmail,
        trialStarted: true,
        trialError: null,
      },
      { status: 201 },
    )
  }),
  http.get('*/platform-api/tenants/:id', ({ params }) => {
    if (params.id === 'missing') {
      return HttpResponse.json({ errorCode: 'TENANT_NOT_FOUND' }, { status: 404 })
    }
    return HttpResponse.json({
      id: params.id,
      name: 'Cairo Fit',
      nameAr: 'كايرو',
      gymCode: 'GYM-CAI-01',
      city: 'Cairo',
      phoneNumber: '+201000000000',
      email: 'owner@cairo.fit',
      isActive: true,
      subscription: {
        id: 'sub-1',
        tenantId: params.id,
        planTier: 'growth',
        status: 'trialing',
        billingCycle: 'monthly',
        priceEgp: 1999,
        currentPeriodStart: '2026-07-01',
        currentPeriodEnd: '2026-08-28',
        trialEndsAtUtc: '2026-08-11T00:00:00Z',
        cancelAtPeriodEnd: true,
        cancelledAtUtc: null,
        updatedAtUtc: '2026-07-28T09:00:00Z',
        pendingDowngradeTier: null,
      },
      usageCounters: [
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
          updatedAtUtc: '2026-07-30T01:30:00Z',
        },
        {
          period: '2026-07',
          metric: 'staff_seats',
          count: 4,
          cap: null,
          overageBilledEgp: null,
          updatedAtUtc: '2026-07-30T01:30:00Z',
        },
        {
          period: '2026-07',
          metric: 'branches',
          count: 1,
          cap: 1,
          overageBilledEgp: null,
          updatedAtUtc: '2026-07-30T01:30:00Z',
        },
      ],
      health: {
        riskBand: 'watch',
        score: 62,
        computedAtUtc: '2026-07-30T03:00:00Z',
        updatedAtUtc: '2026-07-30T03:00:00Z',
        confidence: 0.85,
        summary: 'Moderate engagement with payment friction signals.',
        contributingFactorsJson: JSON.stringify({
          model: 'rules_v1',
          mlUsed: false,
          score: 62,
          riskBand: 'watch',
          confidence: 0.85,
          summary: 'Moderate engagement with payment friction signals.',
          signals: [
            {
              key: 'payment_health',
              label: 'Payment health',
              available: true,
              score: 25,
              configuredWeight: 0.25,
              effectiveWeight: 0.28,
              summary: "Subscription is 'past_due' with 1 unpaid invoice(s).",
            },
            {
              key: 'login_frequency',
              label: 'Login frequency',
              available: true,
              score: 80,
              configuredWeight: 0.2,
              effectiveWeight: 0.22,
              summary: 'Staff activity within the last 3 day(s).',
            },
            {
              key: 'support_ticket_volume',
              label: 'Support ticket volume',
              available: false,
              score: null,
              configuredWeight: 0.1,
              effectiveWeight: 0,
              summary: 'Support tickets stubbed unavailable.',
            },
          ],
        }),
      },
      featureOverrides: [
        {
          id: 'fo-1',
          tenantId: params.id,
          featureKey: 'refunds',
          enabled: true,
          reason: 'Temporary upsell trial',
          grantedByPlatformUserId: '11111111-1111-1111-1111-111111111111',
          expiresAtUtc: '2026-09-01T00:00:00Z',
          createdAtUtc: '2026-07-20T00:00:00Z',
        },
      ],
      priceOverrides: [],
      recentAudit: [
        {
          id: 'aud-1',
          actorPlatformUserId: '11111111-1111-1111-1111-111111111111',
          actorName: 'Platform Admin',
          action: 'platform.tenant.impersonate',
          tenantId: params.id,
          beforeJson: null,
          afterJson: JSON.stringify({
            Reason: 'Helping owner verify check-in after suspend buffer',
            LifetimeMinutes: 30,
          }),
          createdAtUtc: '2026-07-30T10:00:00Z',
        },
      ],
    })
  }),
  http.get('*/platform-api/tenants/:id/subscription/changes', () =>
    HttpResponse.json([
      {
        id: 'c1',
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        subscriptionId: 'sub-1',
        changeType: 'trial_start',
        fromTier: null,
        toTier: 'growth',
        effectiveAtUtc: '2026-07-01T00:00:00Z',
        proratedAmountEgp: null,
        initiatedBy: 'system',
        platformAdminUserId: null,
        reason: null,
        createdAtUtc: '2026-07-01T00:00:00Z',
      },
    ]),
  ),
  http.get('*/platform-api/tenants/:id/invoices', () =>
    HttpResponse.json([
      {
        id: 'inv-1',
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        subscriptionId: 'sub-1',
        invoiceNumber: 'GFP-2026-000001',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        subtotal: 1999,
        vatAmount: 0,
        total: 1999,
        currency: 'EGP',
        status: 'paid',
        dueDate: '2026-07-08',
        paidAtUtc: '2026-07-05T12:00:00Z',
        paymentMethod: 'fawry',
        etaUuid: null,
        pdfUrl: '/uploads/x.pdf',
        createdAtUtc: '2026-07-01T00:00:00Z',
      },
    ]),
  ),
)

beforeAll(() => {
  setAccessToken('test-token')
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  provisioned.length = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('tenants API (MSW)', () => {
  it('list search/filter returns matching rows with EGP-formatable totals', async () => {
    const all = await fetchTenants({ page: 1, pageSize: 20 })
    expect(all.items).toHaveLength(2)
    expect(formatEgp(all.items[0].priceEgp)).toBe('1,999.00 EGP')

    const filtered = await fetchTenants({ search: 'Alex', page: 1, pageSize: 20 })
    expect(filtered.items.map((i) => i.name)).toEqual(['Alex Gym'])

    const byStatus = await fetchTenants({ status: 'trialing', page: 1, pageSize: 20 })
    expect(byStatus.items).toHaveLength(1)
    expect(byStatus.items[0].status).toBe('trialing')

    const byRisk = await fetchTenants({ riskBand: 'watch', page: 1, pageSize: 20 })
    expect(byRisk.items).toHaveLength(1)
    expect(byRisk.items[0].riskBand).toBe('watch')
    expect(byRisk.items[0].healthScore).toBe(62)
    expect(byRisk.items[0].lastLoginAtUtc).toBeTruthy()
  })

  it('list rows carry owner and member fields, null when unavailable (P2.1)', async () => {
    const all = await fetchTenants({ page: 1, pageSize: 20 })
    const withOwner = all.items.find((i) => i.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')!
    expect(withOwner.ownerName).toBe('Sara Haddad')
    expect(withOwner.ownerEmail).toBe('sara@cairofit.example')
    expect(withOwner.memberCount).toBe(412)
    expect(withOwner.memberCap).toBe(500)

    // No active Owner account and no usage rollup yet — both fields are null, not a fake zero/default.
    const withoutOwner = all.items.find((i) => i.id === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')!
    expect(withoutOwner.ownerName).toBeNull()
    expect(withoutOwner.ownerEmail).toBeNull()
    expect(withoutOwner.memberCount).toBeNull()
    expect(withoutOwner.memberCap).toBeNull()
  })

  it('detail includes cancel_at_period_end, trial end, history, invoices', async () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const detail = await fetchTenantDetail(id)
    expect(detail.subscription?.cancelAtPeriodEnd).toBe(true)
    expect(detail.subscription?.status).toBe('trialing')
    expect(detail.subscription?.trialEndsAtUtc).toBeTruthy()
    expect(detail.usageCounters).toHaveLength(4)
    expect(detail.usageCounters?.[1]?.overageBilledEgp).toBe(340)
    expect(detail.usageCounters?.[2]?.cap).toBeNull()
    expect(detail.health?.score).toBe(62)
    expect(detail.health?.riskBand).toBe('watch')
    expect(detail.health?.contributingFactorsJson).toContain('login_frequency')
    expect(detail.recentAudit?.[0]?.action).toBe('platform.tenant.impersonate')

    const changes = await fetchSubscriptionChanges(id)
    expect(changes[0]?.changeType).toBe('trial_start')

    const invoices = await fetchTenantInvoices(id)
    expect(invoices[0]?.invoiceNumber).toBe('GFP-2026-000001')
    expect(invoices[0]?.pdfUrl).toBe('/uploads/x.pdf')
    expect(formatEgp(invoices[0]?.total)).toBe('1,999.00 EGP')
  })
  it('provisionTenant 201 + invalidate tenants query surfaces new gym', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const created = await provisionTenant({
      name: 'New Provision Gym',
      city: 'Giza',
      phoneNumber: '+201111111111',
      email: 'gym@new.example',
      ownerFullName: 'New Owner',
      ownerEmail: 'owner@new.example',
      ownerPassword: 'SecurePass1',
      tier: 'growth',
    })
    expect(created.trialStarted).toBe(true)
    expect(created.gymCode).toBe('GYM-NEW-01')

    await qc.invalidateQueries({ queryKey: ['tenants'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tenants'] })

    const listed = await fetchTenants({ search: 'New Provision', page: 1, pageSize: 20 })
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0].gymCode).toBe('GYM-NEW-01')
    expect(listed.items[0].status).toBe('trialing')
  })

  it('provisionTenant 400 surfaces server message', async () => {
    await expect(
      provisionTenant({
        name: 'Dup',
        city: 'Cairo',
        phoneNumber: '+201000000000',
        email: 'gym@dup.example',
        ownerFullName: 'X',
        ownerEmail: 'taken@example.com',
        ownerPassword: 'SecurePass1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/already registered/i),
    } satisfies Partial<ApiClientError>)
  })

})
