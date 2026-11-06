import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { ApiClientError } from '@/lib/api/errors'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const queryState: Record<string, { isLoading?: boolean; isError?: boolean; error?: unknown; data?: unknown }> = {}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, enabled }: { queryKey: unknown[]; enabled?: boolean }) => {
    if (enabled === false) {
      return { isLoading: false, isError: false, data: undefined, error: null, refetch: vi.fn() }
    }
    const key = String(queryKey[0])
    const state = queryState[key] ?? { isLoading: false, isError: false, data: [], error: null }
    return { refetch: vi.fn(), ...state }
  },
}))

import { OverviewPage } from './pages/OverviewPage'

function signIn(role = 'platform_admin') {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'Admin', role, mfaEnabled: true },
  })
}

describe('OverviewPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    signIn()
    Object.keys(queryState).forEach((key) => delete queryState[key])
    queryState['platform-customers'] = { data: [] }
    queryState['local-licenses'] = { data: [] }
    queryState['support-tickets'] = { data: [] }
    queryState['overview'] = {
      data: { total: 0, byStatus: { trialing: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0 } },
    }
    queryState['risk-queue'] = { data: [] }
  })

  it('renders empty queues without fabricating metrics', () => {
    render(<OverviewPage />)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.queryByText(/MRR/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Nothing in this queue.').length).toBeGreaterThan(0)
    expect(screen.getByText(/No operator stale threshold is defined/i)).toBeInTheDocument()
    expect(screen.getByText('No active installations have reported a check-in.')).toBeInTheDocument()
  })

  it('renders list check-ins without fabricating a stale count', () => {
    queryState['local-licenses'] = {
      data: [
        {
          id: 'l1',
          licenseKey: 'HY-1',
          customerName: 'Pulse',
          customerId: 'c1',
          edition: 'Lifetime',
          status: 'active',
          deviceLimit: 1,
          activeInstallationCount: 1,
          createdAtUtc: '2026-01-01T00:00:00Z',
          lastValidatedAtUtc: '2026-09-16T08:00:00Z',
          installationStatus: 'active',
        },
      ],
    }
    render(<OverviewPage />)
    expect(screen.getByText('Pulse')).toBeInTheDocument()
    expect(screen.getAllByText('active').length).toBeGreaterThan(0)
    expect(screen.getByText(/not a stale count/i)).toBeInTheDocument()
  })

  it('shows an unavailable state when a live API errors', () => {
    queryState['support-tickets'] = { isError: true, error: new ApiClientError('down', 500) }
    render(<OverviewPage />)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/GET \/platform-api\/support-tickets/).length).toBeGreaterThan(0)
  })

  it('shows a loading skeleton while customers are in flight', () => {
    queryState['platform-customers'] = { isLoading: true }
    render(<OverviewPage />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('labels the pending queue as Onboarding unfinished, not waiting first device', () => {
    render(<OverviewPage />)
    expect(screen.getByRole('link', { name: /Onboarding unfinished/ })).toHaveAttribute(
      'href',
      '/oc/gyms?filter=pending',
    )
    expect(screen.queryByText(/Licenses waiting first device/i)).not.toBeInTheDocument()
  })
})
