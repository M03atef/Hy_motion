import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { PlatformSupportTicketDto } from '@/lib/api/types'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
  useParams: () => ({ id: 'tk1' }),
}))

const ticket: PlatformSupportTicketDto = {
  id: 'tk1',
  ticketNumber: 'T-1',
  customerId: 'c1',
  customerName: 'Pulse',
  subject: 'Gate reader offline',
  description: 'Installation has not checked in.',
  priority: 'high',
  status: 'open',
  createdAtUtc: '2026-09-16T08:00:00Z',
  updatedAtUtc: '2026-09-16T08:00:00Z',
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'local-license') {
      return {
        isLoading: false,
        isError: false,
        data: ticket.localLicenseId
          ? {
              id: ticket.localLicenseId,
              licenseKey: 'HY-LCL-TEST1-TEST1',
              customerId: ticket.customerId,
              gymCode: 'GYM-PULSE',
              gymName: 'Pulse Downtown',
              installations: ticket.localInstallationId
                ? [{ id: ticket.localInstallationId, installationId: 'INS-0001', status: 'active', firstActivatedAtUtc: ticket.createdAtUtc }]
                : [],
              recentChanges: [],
              recentOperations: [],
              transferCount: 0,
              suspiciousEventCount: 0,
            }
          : undefined,
        refetch: vi.fn(),
      }
    }
    return { isLoading: false, isError: false, data: ticket, refetch: vi.fn() }
  },
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { TicketDetailPage } from './pages/TicketDetailPage'

function signIn(role: string) {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: 'u1', email: 'a@b.c', fullName: 'Operator', role, mfaEnabled: true },
  })
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    ticket.status = 'open'
    ticket.assignedToPlatformAdminUserId = undefined
    ticket.resolution = undefined
    ticket.localLicenseId = undefined
    ticket.localInstallationId = undefined
  })

  it('lets sales view a ticket without status mutations', () => {
    signIn('platform_sales')
    render(<TicketDetailPage />)
    expect(screen.getByRole('heading', { name: 'Gate reader offline' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pulse' })).toHaveAttribute('href', '/oc/gyms/local/c1')
    expect(screen.getByText(/Status changes require support or above/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument()
  })

  it('lets support start and self-assign an open ticket', () => {
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Status changes require support or above/)).not.toBeInTheDocument()
  })

  it('lets support wait or resolve an in-progress ticket, not skip from waiting', () => {
    ticket.status = 'in_progress'
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByRole('button', { name: 'Waiting on customer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('lets support resume a waiting ticket instead of resolving it', () => {
    ticket.status = 'waiting_customer'
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('lets support close a resolved ticket and not reopen it', () => {
    ticket.status = 'resolved'
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
  })

  it('does not offer mutation controls on a closed ticket', () => {
    ticket.status = 'closed'
    ticket.assignedToPlatformAdminUserId = 'u1'
    ticket.resolution = 'Replaced the reader'
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByRole('heading', { name: 'Gate reader offline' })).toBeInTheDocument()
    expect(screen.getByText('Replaced the reader')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Resolution' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Resolution')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument()
  })

  it('shows license and installation context when the ticket carries those ids', () => {
    ticket.localLicenseId = 'lic-1'
    ticket.localInstallationId = 'inst-1'
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByText('Pulse Downtown')).toBeInTheDocument()
    expect(screen.getByText('GYM-PULSE')).toBeInTheDocument()
    expect(screen.getByText('HY-LCL-TEST1-TEST1')).toBeInTheDocument()
    expect(screen.getByText('INS-0001')).toBeInTheDocument()
    ticket.localLicenseId = undefined
    ticket.localInstallationId = undefined
  })

  it('renders empty resolution as a form field, not invented activity', () => {
    signIn('platform_support')
    render(<TicketDetailPage />)
    expect(screen.getByLabelText('Resolution')).toBeInTheDocument()
    expect(screen.queryByText('synthetic')).not.toBeInTheDocument()
  })
})
