import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ImpersonationSessionBanner } from '@/components/ImpersonationSessionBanner'
import { useImpersonationSessionStore } from '@/stores/impersonation-session-store'

describe('ImpersonationSessionBanner', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useImpersonationSessionStore.getState().setSession(null)
  })

  it('shows End session and does not offer Dismiss indicator', async () => {
    const user = userEvent.setup()
    useImpersonationSessionStore.getState().setSession({
      tenantId: 't1',
      gymName: 'Iron Peak',
      gymCode: 'IRN',
      expiresAtUtc: new Date(Date.now() + 30 * 60_000).toISOString(),
      startedAtUtc: new Date().toISOString(),
    })

    render(<ImpersonationSessionBanner />)
    expect(screen.getByText(/Active support session/i)).toBeInTheDocument()
    expect(screen.getByText(/Iron Peak/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
    const end = screen.getByRole('button', { name: /end session/i })
    await user.click(end)
    expect(useImpersonationSessionStore.getState().session).toBeNull()
    expect(sessionStorage.getItem('platform-console.activeImpersonation')).toBeNull()
  })
})
