import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { DsAlert, DsButton, DsCard, DsEmptyState, DsPageHeader, TextAreaField } from '@/design-system'
import {
  fetchAuditLog,
  fetchCatalogProducts,
  fetchCommercialPlans,
  fetchLocalSalesContractTerms,
  fetchMrr,
  fetchPlatformUsers,
  updateLocalSalesContractTerms,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { formatCairoDateTime, formatEgp } from '@/lib/format'
import { isAdmin, isOpsOrAbove, isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcId, OcLoadError, OcSkeletons, OcUnavailable } from '../ui'
import { OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'

export function SettingsPage() {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const cards = [
    isAdmin(role) ? { to: '/oc/settings/users', title: t('settings.admins'), hint: t('settings.adminsHint') } : null,
    { to: '/oc/settings/plans', title: t('settings.plans'), hint: t('settings.plansHint') },
    { to: '/oc/settings/catalog', title: t('settings.catalog'), hint: t('settings.catalogHint') },
    isAdmin(role)
      ? { to: '/oc/settings/sales-contract-terms', title: t('settings.salesTerms'), hint: t('settings.salesTermsHint') }
      : null,
    { to: '/oc/settings/metrics', title: t('settings.metrics'), hint: t('settings.metricsHint') },
    isSupportOrAbove(role) ? { to: '/oc/settings/audit', title: t('settings.audit'), hint: t('settings.auditHint') } : null,
    isOpsOrAbove(role)
      ? { to: '/oc/settings/licenses', title: t('settings.licenses'), hint: t('settings.licensesHint') }
      : null,
    isOpsOrAbove(role)
      ? {
          to: '/oc/settings/licenses/manage',
          title: t('settings.manageLicenses'),
          hint: t('settings.manageLicensesHint'),
        }
      : null,
  ].filter(Boolean) as Array<{ to: string; title: string; hint: string }>

  return (
    <div className="oc-stack">
      <DsPageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="oc-grid oc-grid-2">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="ds-card oc-attention">
            <div className="font-semibold">{card.title}</div>
            <p className="m-0 mt-1 text-sm text-[var(--ds-text-muted)]">{card.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function AdministratorsPage() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['platform-users'], queryFn: fetchPlatformUsers })
  return (
    <ListPage
      title={t('settings.admins')}
      source="GET /platform-api/platform-users"
      query={query}
      empty={t('settings.emptyUsers')}
      columns={[t('gyms.owner'), t('settings.email'), t('settings.role'), t('settings.mfa')]}
      rows={(query.data ?? []).map((row) => [
        row.fullName,
        <span className="ds-ltr-isolate">{row.email}</span>,
        <OcStatus value={row.role} />,
        <OcStatus value={row.mfaEnabled ? 'active' : 'pending'} />,
      ])}
    />
  )
}

export function PlansSettingsPage() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['commercial-plans'], queryFn: fetchCommercialPlans })
  return (
    <ListPage
      title={t('settings.plans')}
      source="GET /platform-api/plans"
      query={query}
      empty={t('settings.emptyPlans')}
      columns={[t('settings.tier'), t('settings.product'), t('settings.priceMonthly'), t('support.status')]}
      rows={(query.data ?? []).map((row) => [
        row.tier,
        row.displayName,
        <span className="ds-ltr-isolate">{formatEgp(row.monthlyPriceEgp)}</span>,
        <OcStatus value={row.isActiveForSales ? 'active' : 'inactive'} />,
      ])}
    />
  )
}

export function CatalogSettingsPage() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['catalog-products'], queryFn: () => fetchCatalogProducts(true) })
  return (
    <ListPage
      title={t('settings.catalog')}
      source="GET /platform-api/catalog-products"
      query={query}
      empty={t('settings.emptyCatalog')}
      columns={[t('settings.sku'), t('settings.product'), t('settings.priceMonthly'), t('support.status')]}
      rows={(query.data ?? []).map((row) => [
        <OcId value={row.sku} />,
        row.name,
        <span className="ds-ltr-isolate">{formatEgp(row.defaultPrice)}</span>,
        <OcStatus value={row.isActive ? 'active' : 'inactive'} />,
      ])}
    />
  )
}

export function MetricsSettingsPage() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['mrr'], queryFn: () => fetchMrr() })
  return (
    <div className="oc-stack">
      <Link to="/oc/settings">{t('common.back')}</Link>
      <DsPageHeader title={t('settings.metrics')} subtitle={t('settings.metricsHint')} />
      {query.isLoading ? <OcSkeletons /> : null}
      {query.isError ? (
        <OcLoadError error={query.error} source="GET /platform-api/metrics/mrr" onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="oc-stack">
          <p className="m-0 text-sm text-[var(--ds-text-muted)]">
            {t('settings.asOf')} {query.data.asOf} · {t('settings.when')} {formatCairoDateTime(query.data.computedAtUtc)}
          </p>
          <div className="oc-grid oc-grid-4">
            <DsCard>
              <div className="ds-metric">
                <span className="ds-metric-label">{t('settings.mrr')}</span>
                <span className="ds-metric-value ds-ltr-isolate">{formatEgp(query.data.mrrEgp)}</span>
              </div>
            </DsCard>
            <DsCard>
              <div className="ds-metric">
                <span className="ds-metric-label">{t('settings.arr')}</span>
                <span className="ds-metric-value ds-ltr-isolate">{formatEgp(query.data.arrEgp)}</span>
              </div>
            </DsCard>
            <DsCard>
              <div className="ds-metric">
                <span className="ds-metric-label">{t('settings.paying')}</span>
                <span className="ds-metric-value ds-ltr-isolate">{query.data.payingTenantCount}</span>
              </div>
            </DsCard>
          </div>
        </div>
      ) : !query.isLoading && !query.isError ? (
        <OcUnavailable title={t('errors.unavailable')} source="GET /platform-api/metrics/mrr" />
      ) : null}
    </div>
  )
}

export function AuditSettingsPage() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['audit-log'], queryFn: () => fetchAuditLog({ pageSize: 50 }) })
  return (
    <ListPage
      title={t('settings.audit')}
      subtitle={t('settings.auditHint')}
      source="GET /platform-api/audit"
      query={query}
      empty={t('settings.emptyAudit')}
      columns={[t('settings.when'), t('settings.actor'), t('settings.action'), t('gyms.gym')]}
      rows={(query.data?.items ?? []).map((row) => [
        <span className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</span>,
        row.actorName ?? <OcId value={row.actorPlatformUserId} />,
        row.action,
        row.tenantName ?? row.gymCode ?? '—',
      ])}
    />
  )
}

export function SalesContractTermsPage() {
  const t = useOcCopy()
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['local-sales-contract-terms'], queryFn: fetchLocalSalesContractTerms })
  const [termsEn, setTermsEn] = useState('')
  const [termsAr, setTermsAr] = useState('')

  useEffect(() => {
    if (!query.data) return
    setTermsEn(query.data.termsEn)
    setTermsAr(query.data.termsAr)
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: () => updateLocalSalesContractTerms({ termsEn, termsAr }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['local-sales-contract-terms'] })
      showToast(t('salesContract.termsSaved'), 'success')
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : t('errors.generic'), 'error'),
  })

  return (
    <div className="oc-stack">
      <Link to="/oc/settings">{t('common.back')}</Link>
      <DsPageHeader title={t('settings.salesTerms')} subtitle={t('settings.salesTermsHint')} />
      <DsAlert tone="info">{t('salesContract.termsLawyer')}</DsAlert>
      {query.isLoading ? <OcSkeletons /> : null}
      {query.isError ? (
        <OcLoadError
          error={query.error}
          source="GET /platform-api/local-sales-contract-terms"
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <DsCard className="oc-stack max-w-3xl">
          <TextAreaField
            label={t('salesContract.termsEn')}
            value={termsEn}
            onChange={(e) => setTermsEn(e.target.value)}
            rows={12}
          />
          <TextAreaField
            label={t('salesContract.termsAr')}
            value={termsAr}
            onChange={(e) => setTermsAr(e.target.value)}
            rows={12}
            dir="rtl"
          />
          <p className="m-0 text-sm text-[var(--ds-text-muted)]">
            {t('settings.when')}: <span className="ds-ltr-isolate">{formatCairoDateTime(query.data.updatedAtUtc)}</span>
          </p>
          <DsButton
            type="button"
            loading={saveMutation.isPending}
            disabled={!termsEn.trim() || !termsAr.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {t('common.save')}
          </DsButton>
        </DsCard>
      ) : null}
    </div>
  )
}

function ListPage({
  title,
  subtitle,
  source,
  query,
  empty,
  columns,
  rows,
}: {
  title: string
  subtitle?: string
  source: string
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: unknown }
  empty: string
  columns: string[]
  rows: Array<Array<ReactNode>>
}) {
  const t = useOcCopy()
  return (
    <div className="oc-stack">
      <Link to="/oc/settings">{t('common.back')}</Link>
      <DsPageHeader title={title} subtitle={subtitle} />
      {query.isLoading ? <OcSkeletons /> : null}
      {query.isError ? <OcLoadError error={query.error} source={source} onRetry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && rows.length === 0 ? <DsEmptyState title={empty} hint={source} /> : null}
      {rows.length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
