import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DsButton, TextAreaField } from '@/design-system'
import { impersonateTenant } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { PlatformTenantDetailDto } from '@/lib/api/types'
import { MIN_REASON_LENGTH, validateReason } from '@/lib/platform-roles'
import {
  buildImpersonationAdminUrl,
  useImpersonationSessionStore,
} from '@/stores/impersonation-session-store'
import { useUiStore } from '@/stores/ui-store'
import { useOcCopy } from './useOcCopy'

export function OcImpersonate({
  tenant,
  open,
  onClose,
}: {
  tenant: PlatformTenantDetailDto
  open: boolean
  onClose: () => void
}) {
  const t = useOcCopy()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const setSession = useImpersonationSessionStore((s) => s.setSession)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => impersonateTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: async (data) => {
      const url = buildImpersonationAdminUrl(data.accessToken)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        setError('Popup blocked — allow popups, then try again. The platform session was not altered.')
        return
      }
      setSession({
        tenantId: data.tenantId,
        gymName: tenant.name,
        gymCode: data.gymCode,
        expiresAtUtc: data.expiresAtUtc,
        startedAtUtc: new Date().toISOString(),
      })
      setReason('')
      setError(null)
      onClose()
      showToast(`Support session started for ${tenant.name}.`, 'success', 6000)
      await queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] })
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        setError(err.status === 403 ? t('errors.forbidden') : err.message)
        return
      }
      setError(err instanceof Error ? err.message : t('errors.generic'))
    },
  })

  return (
    <Drawer
      open={open}
      title={t('gyms.impersonate')}
      onClose={() => !mutation.isPending && onClose()}
      closeLabel={t('common.close')}
    >
      <p className="text-[13.5px] text-[var(--ds-text-muted)]">{t('gyms.impersonateBody')}</p>
      <div className="mt-4">
        <TextAreaField
          label={t('gyms.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          disabled={mutation.isPending}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--ds-status-danger)]">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <DsButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
          {t('common.cancel')}
        </DsButton>
        <DsButton
          variant="danger"
          loading={mutation.isPending}
          disabled={validateReason(reason) !== null}
          onClick={() => mutation.mutate()}
        >
          {t('gyms.impersonateConfirm')}
        </DsButton>
      </div>
      <p className="oc-source ds-ltr-isolate">min {MIN_REASON_LENGTH} characters</p>
    </Drawer>
  )
}
