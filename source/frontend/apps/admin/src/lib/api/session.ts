import type { LoginResponse, SessionSnapshot, UserInfo } from './types'

const STORAGE_KEY = 'gymflowpro.session'

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionSnapshot
    if (!parsed?.accessToken || !parsed?.user) return null
    // Impersonation: access-only (no refresh). Normal staff session requires refreshToken.
    if (!parsed.refreshToken && !parsed.impersonation) return null
    return parsed
  } catch {
    return null
  }
}

/** Persist immediately — refresh rotation revokes the previous refresh token. */
export function saveSession(session: SessionSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function sessionFromLogin(response: LoginResponse): SessionSnapshot {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAtUtc: response.expiresAtUtc,
    user: response.user,
  }
}

export function getStoredGymCode(): string {
  return localStorage.getItem('HyMotion.lastGymCode') ?? ''
}

export function rememberGymCode(gymCode: string): void {
  localStorage.setItem('HyMotion.lastGymCode', gymCode)
}

export type SessionListener = (session: SessionSnapshot | null) => void

const listeners = new Set<SessionListener>()

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(session: SessionSnapshot | null): void {
  listeners.forEach((l) => l(session))
}

export function applySession(session: SessionSnapshot): void {
  saveSession(session)
  notify(session)
}

export function wipeSession(): void {
  clearSession()
  notify(null)
}

export function getAccessToken(): string | null {
  return loadSession()?.accessToken ?? null
}

export function getRefreshToken(): string | null {
  return loadSession()?.refreshToken ?? null
}

export function getCurrentUser(): UserInfo | null {
  return loadSession()?.user ?? null
}
