import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { PlatformTenantDetailDto } from '@/lib/api/types'
import { ImpersonateButton } from './ImpersonateButton'

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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
  users: [],
}

function signIn(role: string) {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: 'u1', email: 'a@b.c', fullName: 'Operator', role, mfaEnabled: true },
  })
}

describe('ImpersonateButton', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('is hidden for support', () => {
    signIn('platform_support')
    render(<ImpersonateButton tenant={tenant} />)
    expect(screen.queryByRole('button', { name: 'Impersonate' })).not.toBeInTheDocument()
  })

  it('is hidden for sales', () => {
    signIn('platform_sales')
    render(<ImpersonateButton tenant={tenant} />)
    expect(screen.queryByRole('button', { name: 'Impersonate' })).not.toBeInTheDocument()
  })

  it('is shown for ops', () => {
    signIn('platform_ops')
    render(<ImpersonateButton tenant={tenant} />)
    expect(screen.getByRole('button', { name: 'Impersonate' })).toBeInTheDocument()
  })
})
