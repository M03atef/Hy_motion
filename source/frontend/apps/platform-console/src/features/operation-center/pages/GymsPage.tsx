import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsEmptyState, DsPageHeader, SearchInput } from '@/design-system'
import { fetchCustomers, fetchLocalLicenses, fetchTenants } from '@/lib/api'
import { formatCairoDate, formatCairoDateTime } from '@/lib/format'
import { displayLicenseKey } from '@/lib/license-key'
import { isCustomerAccess, isOpsOrAbove, isSales, isSalesOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import {
  applyLocalGymFilter,
  filterLocalGymRows,
  joinLocalGymRows,
  type LocalGymFilter,
} from '@/features/gyms/local-gym-rows'
import { OcId, OcLoadError, OcSkeletons } from '../ui'
import { OcLicenseStatus, OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'
import type { OcCopyKey } from '../i18n'

/**
 * @deprecated Unused after Phase 4 cutover. App.tsx mounts `@/features/gyms/GymsPage`
 * under `/oc/gyms`. Kept for reference / later OC chrome parity — do not re-wire routes here.
 */

const LOCAL_FILTERS = ['all', 'not_live', 'pending', 'blocked', 'prospect', 'unlinked'] as const
const FILTER_COPY: Record<(typeof LOCAL_FILTERS)[number], OcCopyKey> = {
  all: 'gyms.filter.all',
  not_live: 'gyms.filter.not_live',
  pending: 'gyms.filter.pending',
  blocked: 'gyms.filter.blocked',
  prospect: 'gyms.filter.prospect',
  unlinked: 'gyms.filter.unlinked',
}

function isLocalFilter(value: string | null): value is (typeof LOCAL_FILTERS)[number] {
  return !!value && (LOCAL_FILTERS as readonly string[]).includes(value)
}

export function GymsPage() {
  const t = useOcCopy()
  const [params, setParams] = useSearchParams()
  const role = useAuthStore((s) => s.user?.role)
  const canSeeCloud = !isSales(role)
  const requestedCloud = params.get('mode') === 'cloud'
  const mode = requestedCloud && canSeeCloud ? 'cloud' : 'local'

  function setMode(next: 'local' | 'cloud') {
    const nextParams = new URLSearchParams(params)
    if (next === 'local') {
      nextParams.delete('mode')
      nextParams.delete('status')
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
      {mode === 'cloud' ? <CloudGymsTable /> : <LocalGymsTable />}
    </div>
  )
}

function LocalGymsTable() {
  const t = useOcCopy()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const role = useAuthStore((s) => s.user?.role)
  const canOnboard = isSalesOrAbove(role)
  const canReadLicenses = isCustomerAccess(role)
  const revealLicenseKeys = isOpsOrAbove(role)
  const [search, setSearch] = useState('')
  const filterParam = params.get('filter')
  const filter: LocalGymFilter = isLocalFilter(filterParam) ? filterParam : 'all'

  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })
  const licensesQuery = useQuery({
    queryKey: ['local-licenses'],
    queryFn: fetchLocalLicenses,
    enabled: canReadLicenses,
  })

  const isLoading = customersQuery.isLoading || (canReadLicenses && licensesQuery.isLoading)
  const isError = customersQuery.isError || (canReadLicenses && licensesQuery.isError)
  const error = customersQuery.error ?? licensesQuery.error
  const joined = joinLocalGymRows(customersQuery.data ?? [], canReadLicenses ? (licensesQuery.data ?? []) : [])
  const rows = filterLocalGymRows(applyLocalGymFilter(joined, filter), search)

  function setFilter(next: LocalGymFilter) {
    const copy = new URLSearchParams(params)
    if (next === 'all') copy.delete('filter')
    else copy.set('filter', next)
    setParams(copy, { replace: true })
  }

  function hrefFor(row: (typeof rows)[number]) {
    return row.kind === 'license-only' ? `/oc/gyms/licenses/${row.id}` : `/oc/gyms/local/${row.id}`
  }

  return (
    <div className="oc-stack">
      <div className="oc-row">
        <div className="min-w-[16rem] flex-1">
          <SearchInput
            label={t('gyms.searchLocal')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label={t('gyms.local')}>
            {LOCAL_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className="ds-btn ds-btn--ghost ds-btn--sm"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
              >
                {t(FILTER_COPY[key])}
              </button>
            ))}
          </div>
        </div>
        {canOnboard ? (
          <Link to="/oc/sales/onboard" className="ds-btn ds-btn--primary ds-btn--md">
            {t('sales.onboard')}
          </Link>
        ) : null}
      </div>

      {filter === 'unlinked' ? (
        <p className="m-0 rounded-[var(--ds-radius-md)] border border-[var(--ds-status-warning-border)] bg-[var(--ds-status-warning-bg)] px-3 py-2 text-sm text-[var(--ds-status-warning)]">
          {t('gyms.unlinkedHint')}
        </p>
      ) : null}

      {isError ? (
        <OcLoadError
          error={error}
          source="GET /platform-api/customers · GET /platform-api/local-licenses"
          onRetry={() => {
            void customersQuery.refetch()
            if (canReadLicenses) void licensesQuery.refetch()
          }}
        />
      ) : null}

      <div className="ds-table-wrap">
        <table className="ds-table min-w-[960px]">
          <thead>
            <tr>
              <th>{t('gyms.gym')}</th>
              <th>{t('gyms.owner')}</th>
              <th>{t('gyms.customerStatus')}</th>
              <th>{t('gyms.license')}</th>
              <th>{t('gyms.installation')}</th>
              <th>{t('gyms.lastValidation')}</th>
              <th>{t('gyms.tickets')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>
                  <OcSkeletons rows={3} />
                </td>
              </tr>
            ) : null}
            {!isLoading && !isError && rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <DsEmptyState title={t('gyms.emptyLocal')} />
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr
                key={`${row.kind}-${row.id}`}
                tabIndex={0}
                onClick={() => navigate(hrefFor(row))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(hrefFor(row))
                }}
              >
                <td>
                  <div className="font-semibold">{row.name}</div>
                  {row.kind === 'license-only' ? (
                    <div className="text-xs text-[var(--ds-text-faint)]">{t('gyms.unlinkedLicense')}</div>
                  ) : row.licenseKey ? (
                    <OcId value={displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })} />
                  ) : null}
                  {row.gymCode ? <OcId value={row.gymCode} /> : null}
                  {row.gymName && row.gymName !== row.name ? (
                    <div className="text-xs text-[var(--ds-text-faint)]">{row.gymName}</div>
                  ) : null}
                  {row.tenantId && !isSales(role) ? (
                    <div>
                      <Link
                        to={`/oc/gyms/cloud/${row.tenantId}`}
                        className="text-xs font-semibold text-[var(--ds-teal-500)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('gyms.alsoCloud')}
                      </Link>
                    </div>
                  ) : null}
                </td>
                <td>{row.owner || '—'}</td>
                <td>
                  <OcStatus value={row.customerStatus} />
                </td>
                <td>
                  <OcLicenseStatus value={row.apiLicenseStatus} />
                </td>
                <td className="tabular-nums ds-ltr-isolate">{row.installations ?? t('common.none')}</td>
                <td className="ds-ltr-isolate">
                  {row.lastValidatedAtUtc ? formatCairoDateTime(row.lastValidatedAtUtc) : t('gyms.neverChecked')}
                </td>
                <td className="tabular-nums ds-ltr-isolate">{row.openTickets}</td>
                <td>
                  <Link to={hrefFor(row)} onClick={(e) => e.stopPropagation()}>
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

function CloudGymsTable() {
  const t = useOcCopy()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const status = params.get('status') ?? ''
  const [draft, setDraft] = useState(search)

  const query = useQuery({
    queryKey: ['oc-tenants', search, status],
    queryFn: () => fetchTenants({ search: search || undefined, status: status || undefined, pageSize: 50 }),
  })

  return (
    <div className="oc-stack">
      <div className="oc-row">
        <form
          className="min-w-[16rem] flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            const next = new URLSearchParams(params)
            if (draft) next.set('search', draft)
            else next.delete('search')
            setParams(next, { replace: true })
          }}
        >
          <SearchInput label={t('gyms.searchCloud')} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </form>
      </div>
      {query.isError ? (
        <OcLoadError error={query.error} source="GET /platform-api/tenants" onRetry={() => void query.refetch()} />
      ) : null}
      <div className="ds-table-wrap">
        <table className="ds-table min-w-[960px]">
          <thead>
            <tr>
              <th>{t('gyms.gym')}</th>
              <th>{t('gyms.code')}</th>
              <th>{t('gyms.plan')}</th>
              <th>{t('gyms.subscription')}</th>
              <th>{t('gyms.risk')}</th>
              <th>{t('gyms.members')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={7}>
                  <OcSkeletons rows={3} />
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && (query.data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={7}>
                  <DsEmptyState title={t('gyms.emptyCloud')} />
                </td>
              </tr>
            ) : null}
            {(query.data?.items ?? []).map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => navigate(`/oc/gyms/cloud/${row.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/oc/gyms/cloud/${row.id}`)
                }}
              >
                <td>
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs text-[var(--ds-text-muted)]">{row.ownerName ?? '—'}</div>
                </td>
                <td>
                  <OcId value={row.gymCode} />
                </td>
                <td>
                  <OcStatus value={row.planTier} />
                </td>
                <td>
                  <OcStatus value={row.status} />
                  <div className="text-xs text-[var(--ds-text-faint)]">{formatCairoDate(row.currentPeriodEnd)}</div>
                </td>
                <td>
                  <OcStatus value={row.riskBand} />
                </td>
                <td className="tabular-nums ds-ltr-isolate">
                  {row.memberCount == null ? '—' : row.memberCount}
                  {row.memberCap != null ? ` / ${row.memberCap}` : ''}
                </td>
                <td>
                  <Link to={`/oc/gyms/cloud/${row.id}`} onClick={(e) => e.stopPropagation()}>
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
