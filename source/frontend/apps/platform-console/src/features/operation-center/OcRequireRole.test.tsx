import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { isOpsOrAbove } from '@/lib/platform-roles'

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div>redirect:{to}</div>,
  useLocation: () => ({ pathname: '/oc/settings/licenses' }),
}))

import { OcRequireRole } from './OcRequireRole'

function signIn(role: string) {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: { id: '1', email: 'a@b.c', fullName: 'User', role, mfaEnabled: true },
  })
}

describe('OcRequireRole', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('keeps ops on a gated page and sends support back to Overview', () => {
    signIn('platform_ops')
    const { unmount } = render(
      <OcRequireRole allow={isOpsOrAbove}>
        <div>issue-license</div>
      </OcRequireRole>,
    )
    expect(screen.getByText('issue-license')).toBeInTheDocument()
    unmount()
    signIn('platform_support')
    render(
      <OcRequireRole allow={isOpsOrAbove}>
        <div>issue-license</div>
      </OcRequireRole>,
    )
    expect(screen.getByText('redirect:/oc')).toBeInTheDocument()
    expect(screen.queryByText('issue-license')).not.toBeInTheDocument()
  })
})
