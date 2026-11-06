import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export function OcRequireRole({
  allow,
  children,
}: {
  allow: (role: string | null | undefined) => boolean
  children: ReactNode
}) {
  const role = useAuthStore((s) => s.user?.role)
  const location = useLocation()
  if (!allow(role)) {
    return <Navigate to="/oc" replace state={{ from: location }} />
  }
  return children
}
