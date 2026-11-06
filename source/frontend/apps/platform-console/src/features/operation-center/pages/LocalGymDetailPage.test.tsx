import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import type { LocalLicenseListItemDto, PlatformCustomerProfileDto } from '@/lib/api/types'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
  useParams: () => ({ id: 'c1' }),
}))

const profile: PlatformCustomerProfileDto = {
  customer: {
    id: 'c1',
    businessName: 'Pulse',
    ownerName: 'Amira',
    status: 'active',
    preferredContactMethod: 'phone',
    ownerAccountStatus: 'active',
    openTicketCount: 0,
    createdAtUtc: '2026-01-01T00:00:00Z',
    updatedAtUtc: '2026-01-01T00:00:00Z',
  },
  purchasedItems: [],
  contractTotal: 0,
  paidAmount: 0,
  outstandingAmount: 0,
  paymentStatus: 'unpaid',
  licenses: [
    {
      id: 'lic-a',
      licenseKey: 'HY-LCL-AAAAA-AAAAA',
      customerId: 'c1',
      customerName: 'Pulse',
      edition: 'Lifetime',
      status: 'active',
      deviceLimit: 1,
      activeInstallationCount: 1,
      createdAtUtc: '2026-01-01T00:00:00Z',
      gymCode: 'GYM-A',
      gymName: 'Pulse A',
    },
    {
      id: 'lic-b',
      licenseKey: 'HY-LCL-BBBBB-BBBBB',
      customerId: 'c1',
      customerName: 'Pulse',
      edition: 'Lifetime',
      status: 'suspended',
      deviceLimit: 1,
      activeInstallationCount: 0,
      createdAtUtc: '2026-01-02T00:00:00Z',
      gymCode: 'GYM-B',
      gymName: 'Pulse B',
    },
  ],
  openSupportTicketCount: 0,
}

vi.mock('@/lib/api', () => ({
  fetchCustomerProfile: () => Promise.resolve(profile),
  fetchLocalLicenseDetail: (id: string) =>
    Promise.resolve({
      ...(profile.licenses as LocalLicenseListItemDto[]).find((row) => row.id === id)!,
      installations: [],
      recentChanges: [],
      recentOperations: [],
      transferCount: 0,
      suspiciousEventCount: 0,
    }),
  fetchCustomerPayments: () => Promise.resolve([]),
  fetchSupportTickets: () => Promise.resolve([]),
  createSupportTicket: vi.fn(),
  updateCustomer: vi.fn(),
  fetchTenantStaff: () => Promise.resolve([]),
  initiateOwnerPasswordReset: vi.fn(),
  fetchTenantDetail: () => Promise.resolve(null),
  fetchLocalOwnerRecoveries: () => Promise.resolve([]),
}))

import { LocalGymDetailPage } from './LocalGymDetailPage'
import { customerLicenses, formatOwnerAccount, resolveLocalGymIdentity } from './local-gym/helpers'

function signIn(role = 'platform_ops') {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'Ops', role, mfaEnabled: true },
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LocalGymDetailPage />
    </QueryClientProvider>,
  )
}

describe('LocalGymDetailPage multi-license safety', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    useUiStore.getState().setLocale('en')
    signIn()
  })

  it('returns every license from the profile collection', () => {
    expect(customerLicenses(profile).map((row) => row.id)).toEqual(['lic-a', 'lic-b'])
    expect(customerLicenses({ license: profile.licenses![0], licenses: [] }).map((row) => row.id)).toEqual(['lic-a'])
  })

  it('reads gym identity from the bound installation when license summary fields are empty', () => {
    expect(
      resolveLocalGymIdentity({
        selectedDetail: {
          id: 'lic-a',
          licenseKey: 'HY-LCL-AAAAA-AAAAA',
          customerName: 'Pulse',
          edition: 'Lifetime',
          status: 'active',
          deviceLimit: 1,
          activeInstallationCount: 1,
          createdAtUtc: '2026-01-01T00:00:00Z',
          gymCode: null,
          gymName: null,
          appVersion: null,
          installations: [
            {
              id: 'i1',
              installationId: 'INS-D6A0055EEE',
              status: 'active',
              firstActivatedAtUtc: '2026-01-01T00:00:00Z',
              gymCode: 'GYM-GYM-4191',
              gymName: 'Gold',
              appVersion: '3.0.0',
            },
          ],
          recentChanges: [],
          transferCount: 0,
          suspiciousEventCount: 0,
        },
        details: [],
        licenses: [],
      }),
    ).toEqual({ gymCode: 'GYM-GYM-4191', gymName: 'Gold', appVersion: '3.0.0' })
  })

  it('does not render owner account as None when only a reset status exists', () => {
    expect(formatOwnerAccount({ ownerAccountStatus: 'reset_requested' }, 'None')).toBe('reset requested')
    expect(formatOwnerAccount({ ownerEmail: 'abdu@gmail.com', ownerAccountStatus: 'reset_requested' }, 'None')).toBe(
      'abdu@gmail.com · reset requested',
    )
    expect(formatOwnerAccount({ ownerAccountStatus: 'unknown' }, 'None')).toBe('None')
  })

  it('keeps a single header Sales CTA and mounts license More under License & PC', async () => {
    const user = userEvent.setup()
    // Single-license profile path: use first license only via selecting it
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pulse A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to Sales' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Print sales contract' })).not.toBeInTheDocument()
    // Multi-license: More only after target selected (already covered below)
    const page = document.body.textContent ?? ''
    expect(page).toContain('Gym identity')
    expect(page).toContain('People & contact')
    expect(page).toContain('At a glance')
    expect(page).toContain('License & PC')
    const radios = screen.getAllByRole('radio')
    await user.click(radios[0]!)
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('shows all licenses and withholds mutation until an explicit target is selected', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pulse A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.getByText('HY-LCL-AAAAA-AAAAA')).toBeInTheDocument()
    expect(screen.getByText('HY-LCL-BBBBB-BBBBB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    await user.click(radios[0]!)
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    await user.click(radios[1]!)
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
  })
})
