import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import { OcLicenseActions } from './OcLicenseActions'

function signIn(role: string) {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'Admin', role, mfaEnabled: true },
  })
}

describe('OcLicenseActions', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('hides license mutations from sales', () => {
    signIn('platform_sales')
    const { container } = render(<OcLicenseActions licenseId="l1" status="active" />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument()
  })

  it('puts Restore license under More for admins and never labels it Activate', async () => {
    signIn('platform_admin')
    const user = userEvent.setup()
    render(<OcLicenseActions licenseId="l1" status="suspended" />)
    expect(screen.queryByRole('button', { name: 'Restore license' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Restore license' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument()
  })

  it('does not offer Restore to ops', async () => {
    signIn('platform_ops')
    const user = userEvent.setup()
    render(
      <OcLicenseActions
        licenseId="l1"
        status="active"
        installations={[{ installationId: 'i1', status: 'active' }]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Suspend license' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Authorize PC replacement' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restore license' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument()
  })
})
