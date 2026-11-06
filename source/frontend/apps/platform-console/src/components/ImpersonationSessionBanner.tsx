import { useEffect, useState } from 'react'
import {
  minutesUntil,
  useImpersonationSessionStore,
} from '@/stores/impersonation-session-store'

/**
 * Persistent cue for an open gym support (impersonation) session.
 * Must stay visible while the platform console still tracks the session —
 * no “dismiss while active” affordance (Phase 1).
 */
export function ImpersonationSessionBanner() {
  const session = useImpersonationSessionStore((s) => s.session)
  const hydrate = useImpersonationSessionStore((s) => s.hydrate)
  const clearIfExpired = useImpersonationSessionStore((s) => s.clearIfExpired)
  const endSession = useImpersonationSessionStore((s) => s.endSession)
  const [mins, setMins] = useState(0)

  useEffect(() => {
    hydrate()
    const tick = () => {
      clearIfExpired()
      const s = useImpersonationSessionStore.getState().session
      if (s) setMins(minutesUntil(s.expiresAtUtc))
    }
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [hydrate, clearIfExpired])

  if (!session) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm"
      style={{
        borderColor: 'var(--ds-status-warning-border, #f0b42955)',
        background: 'var(--ds-status-warning-bg, #fef3c7)',
        color: 'var(--ds-text, #78350f)',
      }}
    >
      <span>
        Active support session: <strong>{session.gymName}</strong>
        <span className="opacity-80"> ({session.gymCode})</span>
        {mins > 0 ? (
          <>
            , expires in <strong>{mins} min</strong>
          </>
        ) : (
          <> — expired</>
        )}
        <span className="block text-xs opacity-80 sm:inline sm:ms-2 sm:before:content-['·_']">
          Close the gym window after ending. Platform cannot revoke the gym token from here.
        </span>
      </span>
      <button
        type="button"
        className="rounded border px-2 py-0.5 text-xs font-semibold hover:opacity-90"
        style={{ borderColor: 'var(--ds-status-warning-border, #f0b42988)' }}
        onClick={() => endSession()}
      >
        End session
      </button>
    </div>
  )
}
