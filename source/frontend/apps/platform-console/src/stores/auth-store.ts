import { create } from 'zustand'
import { clearAccessToken, setAccessToken } from '@/lib/api/token'
import type { PlatformAdminDto, PlatformLoginResult } from '@/lib/api/types'

export type MfaPhase = 'none' | 'setup' | 'challenge'

interface PendingCredentials {
  email: string
  password: string
}

interface AuthState {
  user: PlatformAdminDto | null
  isAuthenticated: boolean
  mfaPhase: MfaPhase
  setupToken: string | null
  otpAuthUri: string | null
  mfaManualKey: string | null
  pendingCredentials: PendingCredentials | null
  applySuccessfulAuth: (result: PlatformLoginResult) => void
  beginMfaSetup: (result: PlatformLoginResult, credentials: PendingCredentials) => void
  beginMfaChallenge: (credentials: PendingCredentials) => void
  clearMfaFlow: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  mfaPhase: 'none',
  setupToken: null,
  otpAuthUri: null,
  mfaManualKey: null,
  pendingCredentials: null,

  applySuccessfulAuth: (result) => {
    if (!result.accessToken || !result.user) return
    setAccessToken(result.accessToken)
    set({
      user: result.user,
      isAuthenticated: true,
      mfaPhase: 'none',
      setupToken: null,
      otpAuthUri: null,
      mfaManualKey: null,
      pendingCredentials: null,
    })
  },

  beginMfaSetup: (result, credentials) => {
    clearAccessToken()
    set({
      user: null,
      isAuthenticated: false,
      mfaPhase: 'setup',
      setupToken: result.setupToken ?? null,
      otpAuthUri: result.otpAuthUri ?? null,
      mfaManualKey: result.mfaManualKey ?? null,
      pendingCredentials: credentials,
    })
  },

  beginMfaChallenge: (credentials) => {
    clearAccessToken()
    set({
      user: null,
      isAuthenticated: false,
      mfaPhase: 'challenge',
      setupToken: null,
      otpAuthUri: null,
      mfaManualKey: null,
      pendingCredentials: credentials,
    })
  },

  clearMfaFlow: () =>
    set({
      mfaPhase: 'none',
      setupToken: null,
      otpAuthUri: null,
      mfaManualKey: null,
      pendingCredentials: null,
    }),

  logout: () => {
    clearAccessToken()
    set({
      user: null,
      isAuthenticated: false,
      mfaPhase: 'none',
      setupToken: null,
      otpAuthUri: null,
      mfaManualKey: null,
      pendingCredentials: null,
    })
  },
}))
