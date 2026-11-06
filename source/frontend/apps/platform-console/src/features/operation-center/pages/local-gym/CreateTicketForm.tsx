import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, SelectField, TextAreaField, TextInput } from '@/design-system'
import { createSupportTicket } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { LocalLicenseDetailDto, LocalLicenseListItemDto } from '@/lib/api/types'
import { displayLicenseKey } from '@/lib/license-key'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcId } from '../../ui'
import { useOcCopy } from '../../useOcCopy'

export function CreateTicketForm({
  customerId,
  customerName,
  licenses,
  details,
  selectedLicenseId,
  onSelectLicense,
}: {
  customerId: string
  customerName: string
  licenses: LocalLicenseListItemDto[]
  details: LocalLicenseDetailDto[]
  selectedLicenseId: string
  onSelectLicense: (id: string) => void
}) {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const revealLicenseKeys = isOpsOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [installationId, setInstallationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const selectedLicense = licenses.find((row) => row.id === selectedLicenseId) ?? null
  const installations = details.find((row) => row.id === selectedLicenseId)?.installations ?? []

  useEffect(() => {
    if (installations.length === 1 && installations[0]?.id) setInstallationId(installations[0].id)
    else setInstallationId('')
  }, [selectedLicenseId, installations.length, installations[0]?.id])

  const needsLicense = licenses.length > 1 && !selectedLicenseId
  const mutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        customerId,
        localLicenseId: selectedLicense?.id || null,
        localInstallationId: installationId || null,
        subject: subject.trim(),
        description: description.trim(),
        priority,
      }),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      setSubject('')
      setDescription('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['customer-tickets', customerId] })
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  return (
    <DsCard>
      <h3>{t('support.create')}</h3>
      <dl className="oc-dl mt-3">
        <div>
          <dt>{t('support.customer')}</dt>
          <dd>{customerName}</dd>
        </div>
        <div>
          <dt>{t('gyms.license')}</dt>
          <dd>
            {selectedLicense ? (
              <OcId value={displayLicenseKey(selectedLicense.licenseKey, { revealFull: revealLicenseKeys })} />
            ) : (
              t('common.none')
            )}
          </dd>
        </div>
        <div>
          <dt>{t('gyms.installation')}</dt>
          <dd>
            {installationId
              ? <OcId value={installations.find((row) => row.id === installationId)?.installationId || installationId} />
              : t('common.none')}
          </dd>
        </div>
      </dl>
      <form
        className="oc-stack mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (needsLicense) {
            setError(t('gyms.needLicenseForTicket'))
            return
          }
          mutation.mutate()
        }}
      >
        {licenses.length > 1 ? (
          <SelectField label={t('gyms.license')} value={selectedLicenseId} onChange={(e) => onSelectLicense(e.target.value)}>
            <option value="">{t('gyms.selectLicense')}</option>
            {licenses.map((row) => (
              <option key={row.id} value={row.id}>
                {displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })}
              </option>
            ))}
          </SelectField>
        ) : null}
        {installations.length > 1 ? (
          <SelectField label={t('gyms.installation')} value={installationId} onChange={(e) => setInstallationId(e.target.value)}>
            <option value="">{t('common.none')}</option>
            {installations.map((row) => (
              <option key={row.id ?? row.installationId} value={row.id ?? ''}>
                {row.installationId}
              </option>
            ))}
          </SelectField>
        ) : null}
        <TextInput label={t('support.subject')} required value={subject} onChange={(e) => setSubject(e.target.value)} />
        <TextAreaField label={t('support.description')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <SelectField label={t('support.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </SelectField>
        {error ? <DsAlert tone="danger">{error}</DsAlert> : null}
        <DsButton type="submit" disabled={!subject.trim() || !description.trim() || needsLicense} loading={mutation.isPending}>
          {t('support.create')}
        </DsButton>
      </form>
    </DsCard>
  )
}
