import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { PlatformTenantDetailDto } from '@/lib/api/types'

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="oc-icon" />
  return { Search: Icon, Eye: Icon, EyeOff: Icon }
})

const searchParams = new URLSearchParams()

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearchParams: () => [searchParams, vi.fn()],
  useParams: () => ({ id: 't1' }),
}))

const tenant: PlatformTenantDetailDto = {
  id: 't1',
  name: 'Nasr City',
  nameAr: '',
  gymCode: 'NC01',
  city: 'Cairo',
  phoneNumber: '0100',
  email: 'gym@example.com',
  isActive: true,
  subscription: {
    id: 's1',
    tenantId: 't1',
    planTier: 'growth',
    status: 'active',
    billingCycle: 'monthly',
    priceEgp: 1000,
    currentPeriodStart: '2026-09-01',
    currentPeriodEnd: '2026-10-01',
    cancelAtPeriodEnd: false,
    updatedAtUtc: '2026-09-01T00:00:00Z',
  },
  users: [],
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, enabled }: { queryKey: unknown[]; enabled?: boolean }) => {
    if (enabled === false) return { isLoading: false, isError: false, data: undefined, refetch: vi.fn() }
    if (queryKey[0] === 'tenant') return { isLoading: false, isError: false, data: tenant, refetch: vi.fn() }
    if (queryKey[0] === 'platform-customers') return { isLoading: false, isError: false, data: [], refetch: vi.fn() }
    if (queryKey[0] === 'local-licenses') return { isLoading: false, isError: false, data: [], refetch: vi.fn() }
    if (queryKey[0] === 'oc-tenants') {
      return {
        isLoading: false,
        isError: false,
        data: { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0, hasNext: false, hasPrevious: false },
        refetch: vi.fn(),
      }
    }
    return { isLoading: false, isError: false, data: [], refetch: vi.fn() }
  },
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { GymsPage } from './pages/GymsPage'
import { CloudGymDetailPage } from './pages/CloudGymDetailPage'

function signIn(role = 'platform_admin') {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'Admin', role, mfaEnabled: true },
  })
}

describe('Gyms foundation', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    searchParams.delete('mode')
  })

  it('keeps Local as the default gym workspace', () => {
    signIn('platform_admin')
    render(<GymsPage />)
    expect(screen.getByText('Customer, license, and installation as one operational record.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Local' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not offer Cloud to sales operators', () => {
    signIn('platform_sales')
    render(<GymsPage />)
    expect(screen.getByText('Customer, license, and installation as one operational record.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cloud' })).not.toBeInTheDocument()
  })

  it('labels pending as Onboarding unfinished because that filter is not first-device only', () => {
    signIn('platform_admin')
    render(<GymsPage />)
    expect(screen.getByRole('button', { name: 'Onboarding unfinished' })).toBeInTheDocument()
    expect(screen.queryByText(/waiting first device/i)).not.toBeInTheDocument()
  })

  it('shows an empty local table when APIs return no rows', () => {
    signIn('platform_admin')
    render(<GymsPage />)
    expect(screen.getByText('No local gyms match this view.')).toBeInTheDocument()
  })
})

describe('Cloud gym details', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    tenant.customerId = undefined
  })

  it('keeps impersonation under More, not as a primary action', async () => {
    signIn('platform_admin')
    const user = userEvent.setup()
    render(<CloudGymDetailPage />)
    expect(screen.getByRole('heading', { name: 'Nasr City' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Impersonate Cloud gym' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Impersonate Cloud gym' })).toBeInTheDocument()
  })

  it('does not expose impersonation to support', () => {
    signIn('platform_support')
    render(<CloudGymDetailPage />)
    expect(screen.getByRole('heading', { name: 'Nasr City' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Impersonate Cloud gym' })).not.toBeInTheDocument()
  })

  it('shows an explicit unlinked state when tenant detail has no customerId', () => {
    tenant.customerId = undefined
    signIn('platform_admin')
    render(<CloudGymDetailPage />)
    expect(screen.getByText('No Local customer points at this Cloud gym.')).toBeInTheDocument()
    expect(screen.getByText(/Names are not matched/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Linked from a Local customer' })).not.toBeInTheDocument()
  })

  it('links to the unique Local customer when tenant detail includes customerId', () => {
    tenant.customerId = 'c-local'
    signIn('platform_admin')
    render(<CloudGymDetailPage />)
    expect(screen.getByRole('link', { name: 'Linked from a Local customer' })).toHaveAttribute(
      'href',
      '/oc/gyms/local/c-local',
    )
  })
})
