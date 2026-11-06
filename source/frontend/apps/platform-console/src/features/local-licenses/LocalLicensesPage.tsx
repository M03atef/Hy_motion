import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { StatusChip } from '@/components/Status'
import { fetchCustomers, fetchLocalLicenses, issueLocalLicense } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { LocalLicenseListItemDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

export const LICENSE_STATUS_LABEL: Record<string, string> = {
  created: 'Created',
  pending_activation: 'Pending Activation',
  active: 'Active',
  suspended: 'Suspended',
  revoked: 'Revoked',
}

export const LICENSE_STATUS_BADGE: Record<string, string> = {
  created: 'bg-gray-100 text-gray-800 ring-1 ring-gray-200',
  pending_activation: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  suspended: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200',
  revoked: 'bg-red-50 text-red-800 ring-1 ring-red-200',
}

export function licenseStatusLabel(status: string): string {
  return LICENSE_STATUS_LABEL[status] ?? status
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return 'Forbidden — requires Platform Ops or Admin (403).'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function LocalLicensesPage() {
  const t = useUiStore((s) => s.t)
  const currentUser = useAuthStore((s) => s.user)
  const canIssue = isOpsOrAbove(currentUser?.role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ['local-licenses'], queryFn: fetchLocalLicenses })
  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })

  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [dealReference, setDealReference] = useState('')
  const [edition, setEdition] = useState('Lifetime')
  const [deviceLimit, setDeviceLimit] = useState(1)
  const [notes, setNotes] = useState('')

  function openModal() {
    setFormError(null)
    setCustomerId('')
    setCustomerContact('')
    setDealReference('')
    setEdition('Lifetime')
    setDeviceLimit(1)
    setNotes('')
    setModalOpen(true)
  }

  function closeModal() {
    if (issueMutation.isPending) return
    setModalOpen(false)
    setFormError(null)
  }

  const issueMutation = useMutation({
    mutationFn: () =>
      issueLocalLicense({
        customerId,
        customerContact: customerContact.trim() || null,
        dealReference: dealReference.trim() || null,
        edition,
        deviceLimit,
        notes: notes.trim() || null,
      }),
    onSuccess: async (result) => {
      const name = (customersQuery.data ?? []).find((row) => row.id === customerId)?.businessName ?? customerId
      showToast(t('licenses.issuedToast', { key: result.licenseKey, name }), 'success')
      await queryClient.invalidateQueries({ queryKey: ['local-licenses'] })
      setModalOpen(false)
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const licenses = query.data ?? []
  const colCount = 7

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('licenses.title')}
        subtitle={t('licenses.subtitle')}
        actions={
          canIssue ? (
            <button type="button" onClick={openModal} className="cp-btn cp-btn-primary">
              {t('licenses.issue')}
            </button>
          ) : null
        }
      />

      <div
        role="status"
        className="rounded-[var(--radius)] border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700"
      >
        {t('licenses.hint')}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
        <table className="cp-table min-w-full text-left text-sm">
          <thead>
            <tr>
              <th>{t('licenses.key')}</th>
              <th>{t('licenses.customer')}</th>
              <th>{t('licenses.edition')}</th>
              <th>{t('customers.status')}</th>
              <th>{t('licenses.devices')}</th>
              <th>{t('licenses.issued')}</th>
              <th>{t('licenses.created')}</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {query.isError ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-red-600">
                  {query.error instanceof ApiClientError ? query.error.message : t('licenses.failedLoad')}{' '}
                  <button type="button" className="underline" onClick={() => query.refetch()}>
                    {t('common.retry')}
                  </button>
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && licenses.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-gray-500">
                  {t('licenses.empty')}
                </td>
              </tr>
            ) : null}
            {licenses.map((lic: LocalLicenseListItemDto) => (
              <tr key={lic.id} className="border-t border-gray-200">
                <td className="px-3 py-2 font-[var(--mono)] text-xs text-gray-900">
                  <Link to={`/local-licenses/${lic.id}`} className="text-blue-700 hover:underline">
                    {lic.licenseKey}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {lic.customerId ? (
                    <Link to={`/oc/gyms/local/${lic.customerId}`} className="text-blue-700 hover:underline">
                      {lic.customerName}
                    </Link>
                  ) : (
                    lic.customerName
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{lic.edition}</td>
                <td className="px-3 py-2">
                  <StatusChip value={lic.status} />
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {lic.activeInstallationCount} / {lic.deviceLimit}
                </td>
                <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(lic.issuedAtUtc)}</td>
                <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(lic.createdAtUtc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={modalOpen}
        title={t('licenses.issueTitle')}
        description={t('licenses.issueDesc')}
        confirmLabel={t('licenses.issue')}
        busy={issueMutation.isPending}
        error={formError}
        confirmDisabled={!customerId || deviceLimit <= 0}
        onClose={closeModal}
        onConfirm={() => issueMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('licenses.customer')}</span>
          <select
            value={customerId}
            disabled={issueMutation.isPending}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">{t('licenses.selectCustomer')}</option>
            {(customersQuery.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.businessName}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('licenses.customerContact')}</span>
          <input
            value={customerContact}
            disabled={issueMutation.isPending}
            onChange={(e) => setCustomerContact(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('licenses.dealReference')}</span>
          <input
            value={dealReference}
            disabled={issueMutation.isPending}
            onChange={(e) => setDealReference(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <div className="mt-2 flex gap-2">
          <label className="block flex-1 text-sm">
            <span className="text-gray-500">{t('licenses.edition')}</span>
            <input
              value={edition}
              disabled={issueMutation.isPending}
              onChange={(e) => setEdition(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block w-28 text-sm">
            <span className="text-gray-500">{t('licenses.deviceLimit')}</span>
            <input
              type="number"
              min={1}
              value={deviceLimit}
              disabled={issueMutation.isPending}
              onChange={(e) => setDeviceLimit(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>
        </div>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('licenses.notes')}</span>
          <textarea
            value={notes}
            disabled={issueMutation.isPending}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
      </ConfirmDialog>
    </div>
  )
}
