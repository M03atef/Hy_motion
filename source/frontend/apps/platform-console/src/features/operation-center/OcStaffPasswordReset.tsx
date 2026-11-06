import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PasswordInput } from '@/design-system'
import { resetTenantStaffPassword } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { TenantStaffDto } from '@/lib/api/types'
import { useUiStore } from '@/stores/ui-store'
import { OcReasonDrawer } from './OcReasonDrawer'
import { useOcCopy } from './useOcCopy'

export function OcStaffPasswordReset({
  tenantId,
  staff,
  open,
  onClose,
}: {
  tenantId: string
  staff: TenantStaffDto | null
  open: boolean
  onClose: () => void
}) {
  const t = useOcCopy()
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (!staff) return Promise.reject(new Error('No staff member selected.'))
      return resetTenantStaffPassword(tenantId, staff.id, { newPassword: password, reason: reason.trim() })
    },
    onSuccess: async () => {
      showToast(t('gyms.resetPasswordDone'), 'success')
      setPassword('')
      setReason('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['tenant-staff', tenantId] })
      onClose()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  return (
    <OcReasonDrawer
      open={open && Boolean(staff)}
      title={t('gyms.resetPassword')}
      body={t('gyms.resetPasswordBody')}
      confirmLabel={t('gyms.resetPassword')}
      reason={reason}
      onReasonChange={setReason}
      extra={
        <div className="mt-4">
          <PasswordInput
            label={t('gyms.newPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={mutation.isPending}
          />
        </div>
      }
      confirmDisabled={password.length < 10}
      error={error}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={() => {
        if (mutation.isPending) return
        setPassword('')
        setReason('')
        setError(null)
        onClose()
      }}
    />
  )
}
