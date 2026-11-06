import { create } from 'zustand'
import { loadSession, subscribeSession } from '@/lib/api'
import type { SessionSnapshot, UserInfo } from '@/lib/api'

interface AuthState {
  session: SessionSnapshot | null
  user: UserInfo | null
  isAuthenticated: boolean
  hydrate: () => void
  setSession: (session: SessionSnapshot | null) => void
}

function fromSnapshot(session: SessionSnapshot | null) {
  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.accessToken),
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...fromSnapshot(loadSession()),
  hydrate: () => set(fromSnapshot(loadSession())),
  setSession: (session) => set(fromSnapshot(session)),
}))

subscribeSession((session) => {
  useAuthStore.getState().setSession(session)
})
