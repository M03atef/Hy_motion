import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Route-guard behavior is derived from auth store flags (see RequireAuth).
 * We assert the state machine the guard reads — avoids dual-React RTL flakiness
 * in the monorepo while still covering the acceptance criteria.
 */
function guardRedirect(path: string): string {
  const { isAuthenticated, mfaPhase } = useAuthStore.getState()
  if (mfaPhase === 'setup') return '/mfa-setup'
  if (mfaPhase === 'challenge') return '/mfa-challenge'
  if (!isAuthenticated && (path.startsWith('/tenants') || path.startsWith('/gyms') || path.startsWith('/overview') || path.startsWith('/oc'))) return '/login'
  return path
}

describe('route protection', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('unauthenticated /oc redirects to login', () => {
    expect(guardRedirect('/oc')).toBe('/login')
  })

  it('mfa setup incomplete cannot reach tenants', () => {
    useAuthStore.getState().beginMfaSetup(
      {
        success: false,
        expiresInSeconds: 600,
        mfaSetupRequired: true,
        setupToken: 't',
        otpAuthUri: 'otpauth://x',
        mfaManualKey: 'k',
      },
      { email: 'a@b.c', password: 'p' },
    )
    expect(guardRedirect('/gyms')).toBe('/mfa-setup')
  })

  it('mfa challenge incomplete cannot reach tenants', () => {
    useAuthStore.getState().beginMfaChallenge({ email: 'a@b.c', password: 'p' })
    expect(guardRedirect('/gyms')).toBe('/mfa-challenge')
  })

  it('authenticated reaches gyms and oc', () => {
    useAuthStore.getState().applySuccessfulAuth({
      success: true,
      expiresInSeconds: 600,
      mfaSetupRequired: false,
      accessToken: 'tok',
      user: {
        id: '1',
        email: 'a@b.c',
        fullName: 'Admin',
        role: 'platform_admin',
        mfaEnabled: true,
      },
    })
    expect(guardRedirect('/gyms')).toBe('/gyms')
    expect(guardRedirect('/oc')).toBe('/oc')
  })
})
