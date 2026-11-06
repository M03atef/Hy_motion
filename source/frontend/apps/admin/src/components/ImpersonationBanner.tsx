import { useEffect, useState } from 'react'
import { loadSession } from '@/lib/api/session'

/** Persistent banner while GymFlow Support is assisting via impersonation JWT. */
export function ImpersonationBanner() {
  const [visible, setVisible] = useState(false)
  const [expiresLabel, setExpiresLabel] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => {
      const session = loadSession()
      const imp = session?.impersonation
      if (!imp) {
        setVisible(false)
        return
      }
      if (new Date(imp.expiresAtUtc).getTime() <= Date.now()) {
        setVisible(false)
        return
      }
      setVisible(true)
      const mins = Math.max(
        0,
        Math.ceil((new Date(imp.expiresAtUtc).getTime() - Date.now()) / 60_000),
      )
      setExpiresLabel(`${mins} min left`)
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="border-b border-amber-600 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      GymFlow Support is assisting this account
      {expiresLabel ? ` · session ${expiresLabel}` : ''}. Actions are logged for the gym owner.
    </div>
  )
}
