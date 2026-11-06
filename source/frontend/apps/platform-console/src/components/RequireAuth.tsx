import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mfaPhase = useAuthStore((s) => s.mfaPhase)
  const location = useLocation()

  if (mfaPhase === 'setup') {
    return <Navigate to="/mfa-setup" replace state={{ from: location }} />
  }
  if (mfaPhase === 'challenge') {
    return <Navigate to="/mfa-challenge" replace state={{ from: location }} />
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/oc" replace />
  return children
}
