import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsButton, DsCard, SelectField, TextAreaField } from '@/design-system'
import { fetchTenantStaff, initiateOwnerPasswordReset, updateCustomer } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { PlatformCustomerDetailDto } from '@/lib/api/types'
import { isOpsOrAbove, isSalesOrAbove } from '@/lib/platform-roles'
import type { Locale } from '@gymflowpro/i18n'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcReasonDrawer } from '../../OcReasonDrawer'
import { OcStaffPasswordReset } from '../../OcStaffPasswordReset'
import { useOcCopy } from '../../useOcCopy'
import { CUSTOMER_STATUSES, customerStatusOption } from './helpers'

export function CustomerOpsCard({ customer }: { customer: PlatformCustomerDetailDto }) {
  const t = useOcCopy()
  const locale = useUiStore((s) => s.locale) as Locale
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = isSalesOrAbove(role)
  const canReset = isOpsOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(customer.status)
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [resetOpen, setResetOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cloudTenantId = customer.tenantId
  const staffQuery = useQuery({
    queryKey: ['tenant-staff', cloudTenantId],
    queryFn: () => fetchTenantStaff(cloudTenantId!),
    enabled: Boolean(cloudTenantId) && canReset,
  })
  const cloudOwner = (staffQuery.data ?? []).find((row) => (row.role ?? '').toLowerCase() === 'owner') ?? null
  const [resetTarget, setResetTarget] = useState<typeof cloudOwner>(null)

  useEffect(() => {
    setStatus(customer.status)
    setNotes(customer.notes ?? '')
  }, [customer.id, customer.status, customer.notes])

  const save = useMutation({
    mutationFn: () =>
      updateCustomer(customer.id, {
        businessName: customer.businessName,
        ownerName: customer.ownerName,
        phone: customer.phone,
        email: customer.email,
        whatsApp: customer.whatsApp,
        address: customer.address,
        preferredContactMethod: customer.preferredContactMethod,
        notes,
        status,
        leadSource: customer.leadSource,
        assignedSalesRepPlatformAdminUserId: customer.assignedSalesRepPlatformAdminUserId,
        ownerUsername: customer.ownerUsername,
        ownerEmail: customer.ownerEmail,
      }),
    onSuccess: async () => {
      showToast(t('gyms.customerSaved'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['customer-profile', customer.id] })
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
  })

  const reset = useMutation({
    mutationFn: () => initiateOwnerPasswordReset(customer.id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('gyms.resetOwnerDone'), 'success')
      setResetOpen(false)
      setReason('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['customer-profile', customer.id] })
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  return (
    <DsCard>
      <h3 className="oc-section-title">{t('gyms.section.customerRecord')}</h3>
      <div className="oc-stack mt-1">
        {canWrite ? (
          <>
            <SelectField label={t('gyms.customerStatus')} value={status} onChange={(e) => setStatus(e.target.value)}>
              {CUSTOMER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {customerStatusOption(value, locale)}
                </option>
              ))}
            </SelectField>
            <TextAreaField label={t('gyms.customerNotes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <DsButton type="button" onClick={() => save.mutate()} loading={save.isPending}>
              {t('gyms.saveCustomer')}
            </DsButton>
          </>
        ) : (
          <p className="m-0 text-sm text-[var(--ds-text-muted)]">{customer.notes || t('common.none')}</p>
        )}
        {canReset ? (
          <div className="border-t border-[var(--ds-border)] pt-3">
            <DsButton
              type="button"
              variant="secondary"
              onClick={() => {
                setError(null)
                if (cloudTenantId) {
                  if (!cloudOwner) {
                    setError(t('gyms.resetOwnerMissing'))
                    return
                  }
                  setResetTarget(cloudOwner)
                  return
                }
                setResetOpen(true)
              }}
            >
              {t('gyms.resetOwner')}
            </DsButton>
          </div>
        ) : null}
        {error && !resetOpen ? <p className="m-0 text-sm text-[var(--ds-status-danger)]">{error}</p> : null}
      </div>
      <OcReasonDrawer
        open={resetOpen}
        title={t('gyms.resetOwner')}
        body={t('gyms.resetOwnerBody')}
        confirmLabel={t('gyms.resetOwner')}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
        onClose={() => {
          setResetOpen(false)
          setError(null)
        }}
      />
      {cloudTenantId ? (
        <OcStaffPasswordReset
          tenantId={cloudTenantId}
          staff={resetTarget}
          open={Boolean(resetTarget)}
          onClose={() => setResetTarget(null)}
        />
      ) : null}
    </DsCard>
  )
}
