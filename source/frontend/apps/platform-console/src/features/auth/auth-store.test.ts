import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { getAccessToken } from '@/lib/api/token'
import type { PlatformLoginResult } from '@/lib/api/types'

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ops@gymflow.local',
  fullName: 'Ops User',
  role: 'platform_admin',
  mfaEnabled: true,
}

function setupResult(overrides: Partial<PlatformLoginResult> = {}): PlatformLoginResult {
  return {
    success: false,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    ...overrides,
  }
}

describe('auth state machine', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('routes login → mfa_setup_required into setup phase without access token', () => {
    useAuthStore.getState().beginMfaSetup(
      setupResult({
        mfaSetupRequired: true,
        setupToken: 'setup-1',
        otpAuthUri: 'otpauth://totp/GymFlow',
        mfaManualKey: 'ABCD',
        errorCode: 'MFA_SETUP_REQUIRED',
      }),
      { email: 'a@b.c', password: 'x' },
    )
    const s = useAuthStore.getState()
    expect(s.mfaPhase).toBe('setup')
    expect(s.isAuthenticated).toBe(false)
    expect(s.setupToken).toBe('setup-1')
    expect(getAccessToken()).toBeNull()
  })

  it('routes login → MFA_REQUIRED into challenge phase', () => {
    useAuthStore.getState().beginMfaChallenge({ email: 'a@b.c', password: 'x' })
    const s = useAuthStore.getState()
    expect(s.mfaPhase).toBe('challenge')
    expect(s.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('successful enrollment/challenge → authenticated', () => {
    useAuthStore.getState().applySuccessfulAuth(
      setupResult({
        success: true,
        accessToken: 'platform-jwt',
        user,
      }),
    )
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.mfaPhase).toBe('none')
    expect(s.user?.email).toBe('ops@gymflow.local')
    expect(getAccessToken()).toBe('platform-jwt')
  })

  it('logout clears memory token', () => {
    useAuthStore.getState().applySuccessfulAuth(
      setupResult({ success: true, accessToken: 'platform-jwt', user }),
    )
    useAuthStore.getState().logout()
    expect(getAccessToken()).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
