import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, ErrorBanner, TableSkeleton } from '@/components/EmptyState'
import { StatusChip } from '@/components/Status'
import { DsPageHeader } from '@/design-system'
import { TenantsListPage } from '@/features/tenants/TenantsListPage'
import { fetchCustomers, fetchLocalLicenses, fetchSupportTickets, fetchTenantStatusCounts } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { isCustomerAccess, isOpsOrAbove, isSales, isSalesOrAbove, isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { applyLocalGymFilter, filterLocalGymRows, joinLocalGymRows, type LocalGymFilter } from './local-gym-rows'

const LOCAL_FILTERS: LocalGymFilter[] = ['all', 'not_live', 'blocked', 'prospect']

function isLocalFilter(value: string | null): value is LocalGymFilter {
  return !!value && (LOCAL_FILTERS as string[]).concat(['unlinked', 'pending', 'suspended']).includes(value)
}

export function GymsPage() {
  const [params, setParams] = useSearchParams()
  const t = useUiStore((s) => s.t)
  const role = useAuthStore((s) => s.user?.role)
  const canSeeCloud = !isSales(role)
  const requestedCloud = params.get('mode') === 'cloud'
  const mode = requestedCloud && canSeeCloud ? 'cloud' : 'local'

  function setMode(next: 'local' | 'cloud') {
    const nextParams = new URLSearchParams(params)
    if (next === 'local') {
      nextParams.delete('mode')
      nextParams.delete('status')
      nextParams.delete('tier')
      nextParams.delete('riskBand')
      nextParams.delete('renewingBefore')
      nextParams.delete('hasSubscription')
      nextParams.delete('page')
    } else {
      nextParams.set('mode', 'cloud')
      nextParams.delete('filter')
    }
    setParams(nextParams, { replace: true })
  }

  return (
    <div className="oc-stack">
      <DsPageHeader
        title={t('gyms.title')}
        subtitle={mode === 'cloud' ? t('gyms.cloudSubtitle') : t('gyms.localSubtitle')}
        actions={
          canSeeCloud ? (
            <div className="ds-segment" role="group" aria-label={t('gyms.title')}>
              <button type="button" aria-pressed={mode === 'local'} onClick={() => setMode('local')}>
                {t('gyms.local')}
              </button>
              <button type="button" aria-pressed={mode === 'cloud'} onClick={() => setMode('cloud')}>
                {t('gyms.cloud')}
              </button>
            </div>
          ) : null
        }
      />
      {mode === 'cloud' ? <TenantsListPage embedded /> : <LocalGymsTable />}
    </div>
  )
}

function AttentionTile({
  to,
  label,
  value,
  loading,
}: {
  to: string
  label: string
  value: number
  loading: boolean
}) {
  const tone = value > 0 ? ' is-alert' : ''
  return (
    <Link to={to} className={`ds-card oc-attention${tone}`}>
      <div className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</div>
      <div className="oc-attention-value">{loading ? '…' : value}</div>
    </Link>
  )
}

function LocalGymsTable() {
  const t = useUiStore((s) => s.t)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const role = useAuthStore((s) => s.user?.role)
  const canOnboard = isSalesOrAbove(role)
  const canIssue = isOpsOrAbove(role)
  const canReadLicenses = isCustomerAccess(role)
  const canReadTickets = isSupportOrAbove(role) || isSalesOrAbove(role)
  const canReadCloud = isSupportOrAbove(role) || isOpsOrAbove(role)
  const [search, setSearch] = useState('')
  const filter: LocalGymFilter = isLocalFilter(params.get('filter')) ? (params.get('filter') as LocalGymFilter) : 'all'

  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })
  const licensesQuery = useQuery({
    queryKey: ['local-licenses'],
    queryFn: fetchLocalLicenses,
    enabled: canReadLicenses,
  })
  const ticketsQuery = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => fetchSupportTickets(),
    enabled: canReadTickets,
  })
  const countsQuery = useQuery({
    queryKey: ['overview', 'tenant-status-counts'],
    queryFn: fetchTenantStatusCounts,
    enabled: canReadCloud,
  })

  const isLoading = customersQuery.isLoading || (canReadLicenses && licensesQuery.isLoading)
  const isError = customersQuery.isError || (canReadLicenses && licensesQuery.isError)
  const error = customersQuery.error ?? licensesQuery.error
  const joined = joinLocalGymRows(customersQuery.data ?? [], canReadLicenses ? (licensesQuery.data ?? []) : [])
  const rows = filterLocalGymRows(applyLocalGymFilter(joined, filter), search)
  const pendingLicenses = applyLocalGymFilter(joined, 'pending').length
  const suspendedLicenses = applyLocalGymFilter(joined, 'suspended').length
  const openTickets = (ticketsQuery.data ?? []).filter(
    (row) => row.status === 'open' || row.status === 'in_progress' || row.status === 'waiting_customer',
  ).length
  const pastDue = countsQuery.data?.byStatus.past_due ?? 0

  function setFilter(next: LocalGymFilter) {
    const copy = new URLSearchParams(params)
    if (next === 'all') copy.delete('filter')
    else copy.set('filter', next)
    setParams(copy, { replace: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canReadTickets ? (
          <AttentionTile to="/oc/support" label={t('overview.openTickets')} value={openTickets} loading={ticketsQuery.isLoading} />
        ) : null}
        {canReadLicenses ? (
          <AttentionTile
            to="/oc/gyms?filter=pending"
            label={t('overview.pendingLicenses')}
            value={pendingLicenses}
            loading={licensesQuery.isLoading}
          />
        ) : null}
        {canReadLicenses ? (
          <AttentionTile
            to="/oc/gyms?filter=suspended"
            label={t('overview.suspendedLicenses')}
            value={suspendedLicenses}
            loading={licensesQuery.isLoading}
          />
        ) : null}
        {canReadCloud ? (
          <AttentionTile
            to="/oc/gyms?mode=cloud&status=past_due"
            label={t('overview.pastDue')}
            value={pastDue}
            loading={countsQuery.isLoading}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">{t('gyms.searchLocal')}</span>
            <input className="cp-input max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('gyms.filters')}>
            {LOCAL_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className={`cp-tab${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {t(`gyms.filter.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOnboard ? (
            <Link to="/oc/sales/onboard" className="cp-btn cp-btn-primary">
              {t('customers.onboard')}
            </Link>
          ) : null}
          {canIssue ? (
            <details className="relative">
              <summary className="cp-btn cp-btn-ghost cursor-pointer list-none">{t('common.more')}</summary>
              <div className="absolute end-0 z-10 mt-1 min-w-[14rem] rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-2 text-sm shadow-[var(--ds-shadow-md)]">
                <Link to="/oc/gyms?filter=unlinked" className="block rounded px-2 py-1 hover:bg-[var(--ds-surface-2)]">
                  {t('gyms.filter.unlinked')}
                </Link>
                <Link to="/oc/settings/licenses" className="block rounded px-2 py-1 hover:bg-[var(--ds-surface-2)]">
                  {t('gyms.issueUnlinked')}
                </Link>
                <Link to="/oc/support/playbooks" className="block rounded px-2 py-1 hover:bg-[var(--ds-surface-2)]">
                  {t('gyms.help')}
                </Link>
              </div>
            </details>
          ) : (
            <Link to="/oc/support/playbooks" className="cp-btn cp-btn-ghost">
              {t('gyms.help')}
            </Link>
          )}
        </div>
      </div>

      {filter === 'unlinked' ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[var(--ds-status-warning-border)] bg-[var(--ds-status-warning-bg)] px-3 py-2 text-sm text-[var(--ds-status-warning)]">
          {t('gyms.unlinkedHint')}
        </p>
      ) : null}

      {isError ? (
        <ErrorBanner
          message={error instanceof ApiClientError ? error.message : t('errors.generic')}
          onRetry={() => {
            void customersQuery.refetch()
            if (canReadLicenses) void licensesQuery.refetch()
          }}
          retryLabel={t('common.retry')}
        />
      ) : null}

      <div className="overflow-x-auto rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
        <table className="cp-table min-w-[960px]">
          <thead>
            <tr>
              <th>{t('gyms.gym')}</th>
              <th>{t('customers.owner')}</th>
              <th>{t('customers.status')}</th>
              <th>{t('gyms.license')}</th>
              <th>{t('gyms.installation')}</th>
              <th>{t('customers.openTickets')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton rows={6} cols={7} /> : null}
            {!isLoading && !isError && rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState title={t('gyms.emptyLocal')} />
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr
                key={`${row.kind}-${row.id}`}
                tabIndex={0}
                onClick={() => navigate(row.href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(row.href)
                }}
              >
                <td>
                  <div className="font-semibold text-[var(--text)]">{row.name}</div>
                  {row.kind === 'license-only' ? (
                    <div className="text-xs text-[var(--text-faint)]">{t('gyms.unlinkedLicense')}</div>
                  ) : row.licenseKey ? (
                    <div className="cp-mono text-xs text-[var(--text-faint)]">{row.licenseKey}</div>
                  ) : null}
                  {row.tenantId && isSupportOrAbove(role) ? (
                    <Link
                      to={`/oc/gyms/cloud/${row.tenantId}`}
                      className="text-xs text-[var(--accent)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('gyms.alsoCloud')}
                    </Link>
                  ) : null}
                </td>
                <td>{row.owner || '—'}</td>
                <td>
                  <StatusChip value={row.customerStatus} />
                </td>
                <td>
                  <StatusChip value={row.licenseStatus} />
                  {row.licenseCount > 1 ? (
                    <div className="text-xs text-[var(--text-faint)]">{t('gyms.licenseCount', { count: row.licenseCount })}</div>
                  ) : null}
                </td>
                <td className="tabular-nums">{row.installations ?? t('gyms.none')}</td>
                <td className="tabular-nums">{row.openTickets}</td>
                <td>
                  <Link
                    to={row.href}
                    className="text-[var(--accent)] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('common.view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
