import { create } from 'zustand'

export interface ActiveImpersonationSession {
  tenantId: string
  gymName: string
  gymCode: string
  expiresAtUtc: string
  startedAtUtc: string
}

const STORAGE_KEY = 'platform-console.activeImpersonation'

function load(): ActiveImpersonationSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveImpersonationSession
    if (!parsed?.expiresAtUtc || !parsed?.tenantId) return null
    if (new Date(parsed.expiresAtUtc).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

interface ImpersonationUiState {
  session: ActiveImpersonationSession | null
  setSession: (session: ActiveImpersonationSession | null) => void
  /** Clears platform-console tracking of the support session (not a gym-token revoke API). */
  endSession: () => void
  hydrate: () => void
  clearIfExpired: () => void
}

export const useImpersonationSessionStore = create<ImpersonationUiState>((set, get) => ({
  session: null,
  hydrate: () => set({ session: load() }),
  setSession: (session) => {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEY)
      set({ session: null })
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    set({ session })
  },
  endSession: () => {
    sessionStorage.removeItem(STORAGE_KEY)
    set({ session: null })
  },
  clearIfExpired: () => {
    const current = get().session ?? load()
    if (!current) {
      set({ session: null })
      return
    }
    if (new Date(current.expiresAtUtc).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      set({ session: null })
    } else {
      set({ session: current })
    }
  },
}))

/** Build tenant-admin deep link with short-lived token in query (never stored in platform console). */
export function buildImpersonationAdminUrl(accessToken: string): string {
  const configured = (import.meta.env.VITE_TENANT_ADMIN_BASE_URL as string | undefined)?.trim()
  const base = (configured || 'http://localhost:5173/app').replace(/\/$/, '')
  const url = new URL(base.includes('://') ? base : `http://${base}`)
  url.searchParams.set('impersonation_token', accessToken)
  return url.toString()
}

export function minutesUntil(expiresAtUtc: string, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(expiresAtUtc).getTime() - nowMs) / 60_000))
}
