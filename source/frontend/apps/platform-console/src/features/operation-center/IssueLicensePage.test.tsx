import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { PlatformCustomerListItemDto, LocalLicenseListItemDto } from '@/lib/api/types'

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="oc-icon" />
  return { Search: Icon, Eye: Icon, EyeOff: Icon }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const customers: PlatformCustomerListItemDto[] = [
  {
    id: 'c1',
    businessName: 'Pulse Gym',
    ownerName: 'Ahmed',
    status: 'prospect',
    openTicketCount: 0,
    createdAtUtc: '2026-09-16T08:00:00Z',
  },
]

const licenses: LocalLicenseListItemDto[] = []

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'platform-customers') {
      return { isLoading: false, isError: false, data: customers, refetch: vi.fn() }
    }
    if (queryKey[0] === 'local-licenses') {
      return { isLoading: false, isError: false, data: licenses, refetch: vi.fn() }
    }
    return { isLoading: false, isError: false, data: [], refetch: vi.fn() }
  },
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { IssueLicensePage } from './pages/IssueLicensePage'

describe('IssueLicensePage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
    useAuthStore.getState().applySuccessfulAuth({
      success: true,
      expiresInSeconds: 600,
      mfaSetupRequired: false,
      accessToken: 'tok',
      user: { id: '1', email: 'a@b.c', fullName: 'Admin', role: 'platform_admin', mfaEnabled: true },
    })
  })

  it('requires an existing customer before issuing', () => {
    render(<IssueLicensePage />)
    expect(screen.getByText(/New licenses cannot be issued unlinked/)).toBeInTheDocument()
    const customerSelect = screen.getByLabelText(/^Customer/)
    expect(customerSelect).toHaveValue('')
    expect(screen.getByLabelText(/Sale \/ contract/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Issue license' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Pulse Gym' })).toBeInTheDocument()
  })
})
