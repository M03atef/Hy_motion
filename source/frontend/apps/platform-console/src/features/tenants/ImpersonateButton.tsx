import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { impersonateTenant } from '@/lib/api/tenant-actions-api'
import { ApiClientError } from '@/lib/api/errors'
import type { PlatformTenantDetailDto } from '@/lib/api/types'
import { isOpsOrAbove, validateReason, MIN_REASON_LENGTH } from '@/lib/platform-roles'
import {
  buildImpersonationAdminUrl,
  useImpersonationSessionStore,
} from '@/stores/impersonation-session-store'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { formatCairoDateTime } from '@/lib/format'

interface ImpersonateButtonProps {
  tenant: PlatformTenantDetailDto
}

/**
 * Highest-sensitivity control-plane action. Always confirm; open tenant session in a NEW tab
 * so the platform console session stays alive.
 */
export function ImpersonateButton({ tenant }: ImpersonateButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const role = useAuthStore((s) => s.user?.role)
  const showToast = useUiStore((s) => s.showToast)
  const setSession = useImpersonationSessionStore((s) => s.setSession)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => impersonateTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: async (data) => {
      const url = buildImpersonationAdminUrl(data.accessToken)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        setError(
          'Popup blocked — allow popups for this site, then try again. Your platform session was not altered.',
        )
        return
      }

      setSession({
        tenantId: data.tenantId,
        gymName: tenant.name,
        gymCode: data.gymCode,
        expiresAtUtc: data.expiresAtUtc,
        startedAtUtc: new Date().toISOString(),
      })

      setOpen(false)
      setReason('')
      setError(null)
      showToast(
        `Support session started for ${tenant.name}. Expires ${formatCairoDateTime(data.expiresAtUtc)}.`,
        'success',
        6000,
      )
      await queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] })
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(
          err.status === 403
            ? 'Forbidden — your role cannot impersonate (403).'
            : err.message,
        )
        return
      }
      setError(err instanceof Error ? err.message : 'Impersonation failed')
    },
  })

  const reasonOk = validateReason(reason) === null
  const busy = mutation.isPending

  if (!isOpsOrAbove(role)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setError(null)
          setReason('')
        }}
        className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        Impersonate
      </button>

      <ConfirmDialog
        open={open}
        title="Start support impersonation"
        description={
          <div className="space-y-2">
            <p>
              You will be logged in as <strong>{tenant.name}</strong>&apos;s account for up to{' '}
              <strong>30 minutes</strong>. The gym&apos;s staff will see a visible banner while this
              is active. This session is fully logged.
            </p>
            <p className="text-xs text-amber-800/90">
              Impersonation is never silent. A new browser tab will open for the tenant admin —
              keep this Platform Console tab open; your own session stays here.
            </p>
          </div>
        }
        confirmLabel="Start impersonation"
        confirmTone="danger"
        busy={busy}
        error={error}
        confirmDisabled={!reasonOk}
        onClose={() => {
          if (!busy) {
            setOpen(false)
            setError(null)
          }
        }}
        onConfirm={() => {
          const v = validateReason(reason)
          if (v) {
            setError(v)
            return
          }
          setError(null)
          mutation.mutate()
        }}
      >
        <label className="mt-2 block text-sm" htmlFor="impersonate-reason">
          <span className="text-gray-500">
            Reason{' '}
            <span className="text-red-600">
              (required, min {MIN_REASON_LENGTH} chars — audit log)
            </span>
          </span>
          <textarea
            id="impersonate-reason"
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60"
            placeholder="e.g. Investigating owner-reported billing mismatch on July invoice…"
          />
        </label>
      </ConfirmDialog>
    </>
  )
}
