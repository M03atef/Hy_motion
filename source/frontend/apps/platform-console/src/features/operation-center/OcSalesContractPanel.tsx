import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, SelectField } from '@/design-system'
import {
  changeContractStatus,
  fetchContracts,
  fetchIssuedSalesContracts,
  issueSalesContract,
  previewSalesContract,
  reprintSalesContract,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { LocalSalesContractDocumentDto, PlatformContractDto, PlatformCustomerPaymentDto } from '@/lib/api/types'
import { formatCairoDateTime, formatEgp } from '@/lib/format'
import { isSalesOrAbove } from '@/lib/platform-roles'
import { NEXT_CONTRACT_STATUS } from '@/features/customers/status'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcLoadError, OcSkeletons } from './ui'
import { OcStatus } from './OcStatus'
import { useOcCopy } from './useOcCopy'

export function openSalesContractPrint(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  return true
}

export function OcSalesContractPanel({
  customerId,
  customerRollup,
  payments,
  paymentsLoading,
  paymentsError,
  onRetryPayments,
}: {
  customerId: string
  customerRollup: { contractTotal: number; paid: number; outstanding: number; paymentStatus: string }
  payments: PlatformCustomerPaymentDto[]
  paymentsLoading: boolean
  paymentsError: unknown
  onRetryPayments: () => void
}) {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const showToast = useUiStore((s) => s.showToast)
  const canIssue = isSalesOrAbove(role)
  const queryClient = useQueryClient()
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [busyId, setBusyId] = useState<string | null>(null)

  const contractsQuery = useQuery({
    queryKey: ['platform-contracts', customerId],
    queryFn: () => fetchContracts(customerId),
    enabled: Boolean(customerId),
  })
  const issuedQuery = useQuery({
    queryKey: ['local-sales-contracts', customerId],
    queryFn: () => fetchIssuedSalesContracts(customerId),
    enabled: Boolean(customerId),
  })

  const issuedByContract = useMemo(() => {
    const map = new Map<string, LocalSalesContractDocumentDto>()
    for (const row of issuedQuery.data ?? []) map.set(row.contractId, row)
    return map
  }, [issuedQuery.data])

  const contracts = contractsQuery.data ?? []
  const loading = contractsQuery.isLoading || issuedQuery.isLoading || paymentsLoading
  const error = contractsQuery.isError
    ? contractsQuery.error
    : issuedQuery.isError
      ? issuedQuery.error
      : paymentsError

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['local-sales-contracts', customerId] }),
      queryClient.invalidateQueries({ queryKey: ['platform-contracts', customerId] }),
      queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] }),
    ])
  }

  const previewMutation = useMutation({
    mutationFn: (contractId: string) => previewSalesContract(contractId, language),
    onSuccess: (result) => {
      if (!openSalesContractPrint(result.html)) showToast(t('salesContract.printBlocked'), 'error')
      else showToast(t('salesContract.previewOpened'), 'success')
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
    onSettled: () => setBusyId(null),
  })

  const issueMutation = useMutation({
    mutationFn: (contractId: string) => issueSalesContract(contractId, language),
    onSuccess: async (result) => {
      await invalidate()
      if (!openSalesContractPrint(result.html)) showToast(t('salesContract.issuedNoPrint'), 'success')
      else showToast(t('salesContract.issued'), 'success')
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
    onSettled: () => setBusyId(null),
  })

  const reprintMutation = useMutation({
    mutationFn: (contractId: string) => reprintSalesContract(contractId),
    onSuccess: async (result) => {
      await invalidate()
      if (!openSalesContractPrint(result.html)) showToast(t('salesContract.printBlocked'), 'error')
      else showToast(t('salesContract.reprinted'), 'success')
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
    onSettled: () => setBusyId(null),
  })

  const statusMutation = useMutation({
    mutationFn: ({ contractId, status }: { contractId: string; status: string }) =>
      changeContractStatus(contractId, { status }),
    onSuccess: async () => {
      showToast(t('salesContract.statusUpdated'), 'success')
      await invalidate()
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
    onSettled: () => setBusyId(null),
  })

  if (loading) return <OcSkeletons />
  if (error) {
    return (
      <OcLoadError
        error={error}
        source="GET /platform-api/contracts · GET /platform-api/local-sales-contracts"
        onRetry={() => {
          void contractsQuery.refetch()
          void issuedQuery.refetch()
          onRetryPayments()
        }}
      />
    )
  }
  if (contracts.length === 0 && payments.length === 0 && !customerRollup.contractTotal) {
    return <DsEmptyState title={t('gyms.noSales')} hint="GET /platform-api/contracts?customerId=" />
  }

  return (
    <div className="oc-stack">
      <div>
        <h2 className="oc-section-title m-0">{t('salesContract.title')}</h2>
        <DsAlert tone="info">{t('salesContract.hint')}</DsAlert>
      </div>
      <DsCard>
        <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
          {t('salesContract.customerTotal')}
        </p>
        <dl className="oc-dl">
          <div>
            <dt>{t('gyms.price')}</dt>
            <dd className="ds-ltr-isolate">{formatEgp(customerRollup.contractTotal)}</dd>
          </div>
          <div>
            <dt>{t('gyms.paid')}</dt>
            <dd className="ds-ltr-isolate">{formatEgp(customerRollup.paid)}</dd>
          </div>
          <div>
            <dt>{t('gyms.outstanding')}</dt>
            <dd className="ds-ltr-isolate">{formatEgp(customerRollup.outstanding)}</dd>
          </div>
          <div>
            <dt>{t('support.status')}</dt>
            <dd>
              <OcStatus value={customerRollup.paymentStatus} />
            </dd>
          </div>
        </dl>
      </DsCard>

      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label={t('salesContract.language')}
          value={language}
          onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'en')}
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </SelectField>
      </div>

      {contracts.map((contract) => (
        <ContractSaleCard
          key={contract.id}
          contract={contract}
          issued={issuedByContract.get(contract.id) ?? null}
          payments={payments.filter((p) => p.contractId === contract.id)}
          canIssue={canIssue}
          busy={busyId === contract.id}
          onPreview={() => {
            setBusyId(contract.id)
            previewMutation.mutate(contract.id)
          }}
          onIssue={() => {
            setBusyId(contract.id)
            issueMutation.mutate(contract.id)
          }}
          onReprint={() => {
            setBusyId(contract.id)
            reprintMutation.mutate(contract.id)
          }}
          onStatus={(status) => {
            setBusyId(contract.id)
            statusMutation.mutate({ contractId: contract.id, status })
          }}
        />
      ))}
    </div>
  )
}

function ContractSaleCard({
  contract,
  issued,
  payments,
  canIssue,
  busy,
  onPreview,
  onIssue,
  onReprint,
  onStatus,
}: {
  contract: PlatformContractDto
  issued: LocalSalesContractDocumentDto | null
  payments: PlatformCustomerPaymentDto[]
  canIssue: boolean
  busy: boolean
  onPreview: () => void
  onIssue: () => void
  onReprint: () => void
  onStatus: (status: string) => void
}) {
  const t = useOcCopy()
  const cancelled = contract.status === 'cancelled'
  const nextStatuses = canIssue ? (NEXT_CONTRACT_STATUS[contract.status] ?? []) : []
  return (
    <DsCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
            {t('salesContract.saleHeading')}
          </p>
          <div className="mt-1 font-semibold ds-ltr-isolate">{contract.contractNumber}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-sm text-[var(--ds-text-muted)]">
            <OcStatus value={contract.status} />
            <OcStatus value={contract.paymentStatus} />
            {issued ? (
              <span>
                {t('salesContract.issuedAt')}: <span className="ds-ltr-isolate">{formatCairoDateTime(issued.issuedAtUtc)}</span>
                {issued.printCount > 0 ? ` · ${t('salesContract.printCount')}: ${issued.printCount}` : null}
              </span>
            ) : (
              <span>{t('salesContract.notIssued')}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DsButton type="button" variant="secondary" loading={busy} onClick={onPreview} disabled={busy}>
            {t('salesContract.preview')}
          </DsButton>
          {issued ? (
            <DsButton type="button" loading={busy} onClick={onReprint} disabled={busy}>
              {t('salesContract.reprint')}
            </DsButton>
          ) : canIssue ? (
            <DsButton type="button" loading={busy} onClick={onIssue} disabled={busy || cancelled}>
              {t('salesContract.issue')}
            </DsButton>
          ) : null}
          {nextStatuses.map((status) => (
            <DsButton
              key={status}
              type="button"
              variant="secondary"
              loading={busy}
              disabled={busy}
              onClick={() => onStatus(status)}
            >
              {t('salesContract.setStatus')} {status.replace(/_/g, ' ')}
            </DsButton>
          ))}
        </div>
      </div>
      {cancelled ? <DsAlert tone="warning">{t('salesContract.cancelledBlock')}</DsAlert> : null}
      <dl className="oc-dl mt-3">
        <div>
          <dt>{t('salesContract.subtotal')}</dt>
          <dd className="ds-ltr-isolate">{formatEgp(contract.subtotal)}</dd>
        </div>
        <div>
          <dt>{t('salesContract.discount')}</dt>
          <dd className="ds-ltr-isolate">{formatEgp(contract.discount)}</dd>
        </div>
        <div>
          <dt>{t('gyms.price')}</dt>
          <dd className="ds-ltr-isolate">{formatEgp(contract.total)}</dd>
        </div>
        <div>
          <dt>{t('gyms.paid')}</dt>
          <dd className="ds-ltr-isolate">{formatEgp(contract.paidAmount)}</dd>
        </div>
        <div>
          <dt>{t('gyms.outstanding')}</dt>
          <dd className="ds-ltr-isolate">{formatEgp(contract.outstandingAmount)}</dd>
        </div>
      </dl>
      {(contract.items?.length ?? 0) > 0 ? (
        <div className="ds-table-wrap mt-3">
          <table className="ds-table">
            <thead>
              <tr>
                <th>{t('settings.sku')}</th>
                <th>{t('settings.product')}</th>
                <th>{t('salesContract.qty')}</th>
                <th>{t('gyms.price')}</th>
              </tr>
            </thead>
            <tbody>
              {contract.items.map((item) => (
                <tr key={item.id}>
                  <td className="ds-ltr-isolate">{item.skuSnapshot}</td>
                  <td>{item.nameSnapshot}</td>
                  <td className="ds-ltr-isolate">{item.quantity}</td>
                  <td className="ds-ltr-isolate">{formatEgp(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {payments.length > 0 ? (
        <div className="ds-table-wrap mt-3">
          <table className="ds-table">
            <thead>
              <tr>
                <th>{t('gyms.paid')}</th>
                <th>{t('settings.action')}</th>
                <th>{t('settings.when')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id}>
                  <td className="ds-ltr-isolate">{formatEgp(row.amount)}</td>
                  <td>{row.paymentMethod}</td>
                  <td className="ds-ltr-isolate">{formatCairoDateTime(row.paymentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DsCard>
  )
}
