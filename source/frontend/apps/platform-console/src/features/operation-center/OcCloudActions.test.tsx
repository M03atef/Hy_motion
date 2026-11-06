import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { PlatformTenantDetailDto } from '@/lib/api/types'

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { OcCloudActions } from './OcCloudActions'

const tenant: PlatformTenantDetailDto = {
  id: 't1',
  name: 'Cloud Gym',
  nameAr: '',
  gymCode: 'GYM-CLOUD',
  city: 'Cairo',
  phoneNumber: '010',
  email: 'cloud@test',
  isActive: true,
  subscription: {
    id: 's1',
    tenantId: 't1',
    planTier: 'growth',
    status: 'active',
    billingCycle: 'monthly',
    priceEgp: 1000,
    currentPeriodStart: '2026-01-01',
    currentPeriodEnd: '2026-02-01',
    cancelAtPeriodEnd: false,
    updatedAtUtc: '2026-01-01T00:00:00Z',
  },
}

function signIn(role: string) {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'User', role, mfaEnabled: true },
  })
}

describe('OcCloudActions', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('hides Cloud subscription writes from sales and support', () => {
    signIn('platform_sales')
    const { container, unmount } = render(<OcCloudActions tenant={tenant} />)
    expect(container).toBeEmptyDOMElement()
    unmount()
    signIn('platform_support')
    const second = render(<OcCloudActions tenant={tenant} />)
    expect(second.container).toBeEmptyDOMElement()
  })

  it('offers Ops suspend and keeps plan change Admin-only', async () => {
    signIn('platform_ops')
    const user = userEvent.setup()
    render(<OcCloudActions tenant={tenant} />)
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Suspend subscription' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('offers Admin plan change', async () => {
    signIn('platform_admin')
    const user = userEvent.setup()
    render(<OcCloudActions tenant={tenant} />)
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeInTheDocument()
  })
})
