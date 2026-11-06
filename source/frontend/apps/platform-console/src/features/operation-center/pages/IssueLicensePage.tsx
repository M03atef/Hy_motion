import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsEmptyState, DsPageHeader, SelectField, TextAreaField, TextInput } from '@/design-system'
import { fetchContracts, fetchCustomers, fetchLocalLicenses, issueLocalLicense } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { OcId, OcLoadError, OcSkeletons } from '../ui'
import { OcLicenseStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'

export function IssueLicensePage() {
  const t = useOcCopy()
  const queryClient = useQueryClient()
  const listQuery = useQuery({ queryKey: ['local-licenses'], queryFn: fetchLocalLicenses })
  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })
  const [customerId, setCustomerId] = useState('')
  const [contractId, setContractId] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [dealReference, setDealReference] = useState('')
  const [edition, setEdition] = useState('Lifetime')
  const [deviceLimit, setDeviceLimit] = useState(1)
  const [notes, setNotes] = useState('')
  const [issuedKey, setIssuedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const contractsQuery = useQuery({
    queryKey: ['platform-contracts', customerId],
    queryFn: () => fetchContracts(customerId),
    enabled: Boolean(customerId),
  })

  useEffect(() => {
    setContractId('')
  }, [customerId])

  const contracts = (contractsQuery.data ?? []).filter((row) => row.status !== 'cancelled')

  const mutation = useMutation({
    mutationFn: () =>
      issueLocalLicense({
        customerId,
        contractId: contractId || null,
        customerContact: customerContact.trim() || null,
        dealReference: dealReference.trim() || null,
        edition,
        deviceLimit,
        notes: notes.trim() || null,
      }),
    onSuccess: async (result) => {
      setIssuedKey(result.licenseKey)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['local-licenses'] })
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? (err.status === 403 ? t('errors.forbidden') : err.message) : t('errors.generic'))
    },
  })

  const customers = customersQuery.data ?? []

  return (
    <div className="oc-stack">
      <Link to="/oc/settings">{t('common.back')}</Link>
      <DsPageHeader title={t('license.issueTitle')} subtitle={t('gyms.cannotActivate')} />
      <DsAlert tone="info">{t('license.customerRequired')}</DsAlert>
      <form
        className="oc-stack max-w-xl"
        onSubmit={(e) => {
          e.preventDefault()
          if (!customerId) return
          mutation.mutate()
        }}
      >
        <SelectField
          label={t('license.customer')}
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">{t('common.none')}</option>
          {customers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.businessName}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('license.contract')}
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          disabled={!customerId || contractsQuery.isLoading}
        >
          <option value="">{t('license.contractOptional')}</option>
          {contracts.map((row) => (
            <option key={row.id} value={row.id}>
              {row.contractNumber} · {row.paymentStatus} · {row.total}
            </option>
          ))}
        </SelectField>
        {customerId && contractsQuery.isError ? (
          <DsAlert tone="warning">{t('license.contractLoadFailed')}</DsAlert>
        ) : null}
        <TextInput label={t('license.customerContact')} value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
        <TextInput label={t('license.dealReference')} value={dealReference} onChange={(e) => setDealReference(e.target.value)} />
        <TextInput label={t('gyms.edition')} value={edition} onChange={(e) => setEdition(e.target.value)} />
        <TextInput
          label={t('license.deviceLimit')}
          type="number"
          min={1}
          value={deviceLimit}
          onChange={(e) => setDeviceLimit(Number(e.target.value) || 1)}
        />
        <TextAreaField label={t('license.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        {error ? <DsAlert tone="danger">{error}</DsAlert> : null}
        {issuedKey ? (
          <DsAlert tone="success">
            {t('license.issued')} <OcId value={issuedKey} />
          </DsAlert>
        ) : null}
        <DsButton type="submit" loading={mutation.isPending} disabled={!customerId}>
          {t('license.issue')}
        </DsButton>
      </form>

      <h3 className="m-0 text-[13px] font-bold">{t('license.list')}</h3>
      {listQuery.isLoading ? <OcSkeletons /> : null}
      {listQuery.isError ? (
        <OcLoadError error={listQuery.error} source="GET /platform-api/local-licenses" onRetry={() => void listQuery.refetch()} />
      ) : null}
      {!listQuery.isLoading && !listQuery.isError && (listQuery.data ?? []).length === 0 ? (
        <DsEmptyState title={t('gyms.emptyLocal')} hint="GET /platform-api/local-licenses" />
      ) : null}
      {(listQuery.data ?? []).length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table min-w-[720px]">
            <thead>
              <tr>
                <th>{t('license.customerName')}</th>
                <th>{t('gyms.licenseKey')}</th>
                <th>{t('gyms.license')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(listQuery.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.customerName || '—'}</td>
                  <td>
                    <OcId value={row.licenseKey} />
                  </td>
                  <td>
                    <OcLicenseStatus value={row.status} />
                  </td>
                  <td>
                    <Link to={row.customerId ? `/oc/gyms/local/${row.customerId}` : `/oc/gyms/licenses/${row.id}`}>
                      {t('common.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
