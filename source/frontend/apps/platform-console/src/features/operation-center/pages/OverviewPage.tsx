import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsCard, DsPageHeader } from '@/design-system'
import {
  fetchCustomers,
  fetchLocalLicenses,
  fetchRiskQueue,
  fetchSupportTickets,
  fetchTenantStatusCounts,
} from '@/lib/api'
import { isCustomerAccess, isSalesOrAbove, isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { applyLocalGymFilter, joinLocalGymRows } from '@/features/gyms/local-gym-rows'
import { formatCairoDateTime } from '@/lib/format'
import { OcLoadError, OcSkeletons, OcUnavailable } from '../ui'
import { OcLicenseStatus, OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'
import type { OcCopyKey } from '../i18n'

function AttentionCard({
  to,
  label,
  value,
  loading,
  error,
  source,
}: {
  to: string
  label: string
  value?: number
  loading: boolean
  error: boolean
  source: string
}) {
  const t = useOcCopy()
  if (error) {
    return (
      <DsCard className="oc-attention">
        <div className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</div>
        <div className="oc-attention-value">{t('errors.unavailable')}</div>
        <div className="oc-source">
          {t('errors.source')}: {source}
        </div>
      </DsCard>
    )
  }
  const count = value ?? 0
  const tone = count > 0 ? ' is-alert' : ''
  return (
    <Link to={to} className={`ds-card oc-attention${tone}`}>
      <div className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</div>
      <div className="oc-attention-value">{loading ? '…' : count}</div>
    </Link>
  )
}

export function OverviewPage() {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const canLicenses = isCustomerAccess(role)
  const canTickets = isSupportOrAbove(role) || isSalesOrAbove(role)
  const canCloud = isSupportOrAbove(role)
  const canSales = isSalesOrAbove(role)

  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })
  const licensesQuery = useQuery({
    queryKey: ['local-licenses'],
    queryFn: fetchLocalLicenses,
    enabled: canLicenses,
  })
  const ticketsQuery = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => fetchSupportTickets(),
    enabled: canTickets,
  })
  const countsQuery = useQuery({
    queryKey: ['overview', 'tenant-status-counts'],
    queryFn: fetchTenantStatusCounts,
    enabled: canCloud,
  })
  const riskQuery = useQuery({
    queryKey: ['risk-queue'],
    queryFn: () => fetchRiskQueue(),
    enabled: canCloud,
  })

  const joined = joinLocalGymRows(customersQuery.data ?? [], canLicenses ? (licensesQuery.data ?? []) : [])
  const notLive = applyLocalGymFilter(joined, 'not_live')
  const unlinked = applyLocalGymFilter(joined, 'unlinked')
  const pending = applyLocalGymFilter(joined, 'pending')
  const blocked = applyLocalGymFilter(joined, 'blocked')
  const prospects = applyLocalGymFilter(joined, 'prospect')
  const openTickets = (ticketsQuery.data ?? []).filter(
    (row) => row.status === 'open' || row.status === 'in_progress' || row.status === 'waiting_customer',
  )
  const urgentTickets = (ticketsQuery.data ?? []).filter(
    (row) =>
      (row.priority === 'high' || row.priority === 'critical' || row.priority === 'urgent') &&
      (row.status === 'open' || row.status === 'in_progress' || row.status === 'waiting_customer'),
  )
  const riskItems = (riskQuery.data ?? []).filter((row) => row.riskBand === 'at_risk' || row.riskBand === 'critical')

  const loading = customersQuery.isLoading || (canLicenses && licensesQuery.isLoading)

  return (
    <div className="oc-stack">
      <DsPageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />

      {customersQuery.isError ? (
        <OcLoadError
          error={customersQuery.error}
          source="GET /platform-api/customers"
          onRetry={() => void customersQuery.refetch()}
        />
      ) : null}

      <section className="oc-stack" aria-labelledby="oc-attention">
        <h3 id="oc-attention" className="m-0 text-[13px] font-bold">
          {t('overview.attention')}
        </h3>
        <div className="oc-grid oc-grid-4">
          {canLicenses ? (
            <AttentionCard
              to="/oc/gyms?filter=not_live"
              label={t('overview.localProblems')}
              value={notLive.length}
              loading={loading}
              error={licensesQuery.isError}
              source="GET /platform-api/customers + GET /platform-api/local-licenses"
            />
          ) : null}
          {canLicenses ? (
            <AttentionCard
              to="/oc/gyms?filter=unlinked"
              label={t('overview.unlinked')}
              value={unlinked.length}
              loading={licensesQuery.isLoading}
              error={licensesQuery.isError}
              source="GET /platform-api/local-licenses"
            />
          ) : null}
          {canLicenses ? (
            <AttentionCard
              to="/oc/gyms?filter=pending"
              label={t('overview.pendingLicenses')}
              value={pending.length}
              loading={licensesQuery.isLoading}
              error={licensesQuery.isError}
              source="GET /platform-api/customers + GET /platform-api/local-licenses"
            />
          ) : null}
          {canLicenses ? (
            <AttentionCard
              to="/oc/gyms?filter=blocked"
              label={t('overview.blockedLicenses')}
              value={blocked.length}
              loading={licensesQuery.isLoading}
              error={licensesQuery.isError}
              source="GET /platform-api/local-licenses"
            />
          ) : null}
          {canTickets ? (
            <AttentionCard
              to="/oc/support"
              label={t('overview.openTickets')}
              value={openTickets.length}
              loading={ticketsQuery.isLoading}
              error={ticketsQuery.isError}
              source="GET /platform-api/support-tickets"
            />
          ) : null}
          {canTickets ? (
            <AttentionCard
              to="/oc/support"
              label={t('overview.urgentTickets')}
              value={urgentTickets.length}
              loading={ticketsQuery.isLoading}
              error={ticketsQuery.isError}
              source="GET /platform-api/support-tickets"
            />
          ) : null}
          {canSales ? (
            <AttentionCard
              to="/oc/sales"
              label={t('overview.prospects')}
              value={prospects.length}
              loading={customersQuery.isLoading}
              error={customersQuery.isError}
              source="GET /platform-api/customers"
            />
          ) : null}
          {canCloud ? (
            <AttentionCard
              to="/oc/gyms?mode=cloud&status=past_due"
              label={t('overview.pastDue')}
              value={countsQuery.data?.byStatus.past_due}
              loading={countsQuery.isLoading}
              error={countsQuery.isError}
              source="GET /platform-api/tenants?status=past_due&pageSize=1"
            />
          ) : null}
          {canCloud ? (
            <AttentionCard
              to="/oc/support/risk"
              label={t('overview.cloudRisk')}
              value={riskItems.length}
              loading={riskQuery.isLoading}
              error={riskQuery.isError}
              source="GET /platform-api/risk-queue"
            />
          ) : null}
        </div>
      </section>

      <DsCard>
        <h3>{t('overview.staleInstalls')}</h3>
        <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t('overview.staleInstallsHint')}</p>
        {canLicenses ? (
          <CheckInTable
            loading={licensesQuery.isLoading}
            error={licensesQuery.isError}
            licenses={licensesQuery.data ?? []}
          />
        ) : (
          <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t('errors.forbidden')}</p>
        )}
      </DsCard>

      {loading ? <OcSkeletons /> : <AttentionTables notLive={notLive} openTickets={openTickets} prospects={prospects} />}
    </div>
  )
}

function AttentionTables({
  notLive,
  openTickets,
  prospects,
}: {
  notLive: ReturnType<typeof applyLocalGymFilter>
  openTickets: Array<{ id: string; ticketNumber: string; subject: string; customerName?: string | null; priority: string }>
  prospects: ReturnType<typeof applyLocalGymFilter>
}) {
  const t = useOcCopy()
  return (
    <div className="oc-grid oc-grid-2">
      <QueueCard
        titleKey="overview.queueLocal"
        emptyKey="overview.empty"
        rows={notLive.slice(0, 8).map((row) => ({
          id: row.id,
          href: row.kind === 'license-only' ? `/oc/gyms/licenses/${row.id}` : `/oc/gyms/local/${row.id}`,
          title: row.name,
          meta: row.apiLicenseStatus ?? row.customerStatus ?? '',
        }))}
      />
      <QueueCard
        titleKey="overview.queueSupport"
        emptyKey="overview.empty"
        rows={openTickets.slice(0, 8).map((row) => ({
          id: row.id,
          href: `/oc/support/tickets/${row.id}`,
          title: row.subject,
          meta: `${row.ticketNumber} · ${row.customerName ?? ''} · ${row.priority}`,
        }))}
      />
      <QueueCard
        titleKey="overview.queueSales"
        emptyKey="overview.empty"
        rows={prospects.slice(0, 8).map((row) => ({
          id: row.id,
          href: `/oc/gyms/local/${row.id}`,
          title: row.name,
          meta: row.owner,
        }))}
      />
      <DsCard>
        <h3>{t('overview.emptyHint')}</h3>
      </DsCard>
    </div>
  )
}

function CheckInTable({
  loading,
  error,
  licenses,
}: {
  loading: boolean
  error: boolean
  licenses: Array<{
    id: string
    customerId?: string | null
    customerName: string
    lastValidatedAtUtc?: string | null
    installationStatus?: string | null
    status: string
    activeInstallationCount: number
  }>
}) {
  const t = useOcCopy()
  if (error) {
    return <OcUnavailable title={t('errors.unavailable')} source="GET /platform-api/local-licenses" />
  }
  if (loading) return <OcSkeletons rows={3} />
  const rows = [...licenses]
    .filter((row) => row.lastValidatedAtUtc || row.activeInstallationCount > 0)
    .sort((a, b) => Date.parse(b.lastValidatedAtUtc ?? '') - Date.parse(a.lastValidatedAtUtc ?? ''))
    .slice(0, 8)
  if (rows.length === 0) {
    return <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t('overview.noCheckIns')}</p>
  }
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>{t('gyms.gym')}</th>
            <th>{t('gyms.license')}</th>
            <th>{t('gyms.installation')}</th>
            <th>{t('gyms.lastValidation')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to={row.customerId ? `/oc/gyms/local/${row.customerId}` : `/oc/gyms/licenses/${row.id}`}
                  className="text-sm font-semibold text-[var(--ds-text)]"
                >
                  {row.customerName || t('gyms.unlinkedLicense')}
                </Link>
              </td>
              <td>
                <OcLicenseStatus value={row.status} />
              </td>
              <td>
                <OcStatus value={row.installationStatus} />
              </td>
              <td className="ds-ltr-isolate">{formatCairoDateTime(row.lastValidatedAtUtc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QueueCard({
  titleKey,
  emptyKey,
  rows,
}: {
  titleKey: OcCopyKey
  emptyKey: OcCopyKey
  rows: Array<{ id: string; href: string; title: string; meta: string }>
}) {
  const t = useOcCopy()
  return (
    <DsCard>
      <h3>{t(titleKey)}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t(emptyKey)}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={row.href} className="block text-sm font-semibold text-[var(--ds-text)]">
                {row.title}
              </Link>
              <div className="text-xs text-[var(--ds-text-muted)]">{row.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </DsCard>
  )
}
