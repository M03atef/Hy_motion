import { applySession } from '@/lib/api/session'
import type { SessionSnapshot, UserInfo } from '@/lib/api/types'

const IMPERSONATION_CLAIM = 'impersonated_by_platform_user_id'
const TOKEN_USE_CLAIM = 'token_use'
const TOKEN_USE_VALUE = 'tenant_impersonation'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function claimString(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = payload[key]
    if (typeof v === 'string' && v) return v
  }
  return ''
}

/**
 * Consume ?impersonation_token= from Platform Console handoff.
 * Stores access-only session (no refresh). Strips the token from the URL.
 */
export function consumeImpersonationTokenFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  const token = url.searchParams.get('impersonation_token')
  if (!token) return false

  const payload = decodeJwtPayload(token)
  if (!payload) return false

  const tokenUse = claimString(payload, TOKEN_USE_CLAIM)
  const impersonatedBy = claimString(payload, IMPERSONATION_CLAIM)
  if (tokenUse !== TOKEN_USE_VALUE || !impersonatedBy) {
    return false
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : null
  const expiresAtUtc = exp
    ? new Date(exp * 1000).toISOString()
    : new Date(Date.now() + 30 * 60_000).toISOString()

  const role =
    claimString(payload, 'role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role') ||
    'Owner'
  const first = claimString(payload, 'first_name')
  const last = claimString(payload, 'last_name')

  const user: UserInfo = {
    id: claimString(payload, 'sub'),
    email: claimString(payload, 'email'),
    fullName: `${first} ${last}`.trim() || claimString(payload, 'email') || 'Support session',
    role,
    tenantId: claimString(payload, 'tenant_id'),
    gymCode: claimString(payload, 'gym_code'),
  }

  const session: SessionSnapshot = {
    accessToken: token,
    refreshToken: '',
    expiresAtUtc,
    user,
    impersonation: {
      platformUserId: impersonatedBy,
      expiresAtUtc,
    },
  }

  applySession(session)

  url.searchParams.delete('impersonation_token')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  return true
}

export function readImpersonationFromSession(): { platformUserId: string; expiresAtUtc: string } | null {
  try {
    const raw = localStorage.getItem('gymflowpro.session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionSnapshot
    return parsed.impersonation ?? null
  } catch {
    return null
  }
}
