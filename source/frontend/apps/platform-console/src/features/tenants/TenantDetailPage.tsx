import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchSubscriptionChanges,
  fetchTenantDetail,
  fetchTenantInvoices,
} from '@/lib/api'
import { StatusBadge, TierBadge } from '@/components/Badges'
import { UsagePanel } from '@/features/tenants/UsagePanel'
import { HealthTab } from '@/features/tenants/HealthTab'
import { TenantOverviewTab } from '@/features/tenants/TenantOverviewTab'
import { TenantBillingTab } from '@/features/tenants/TenantBillingTab'
import { StaffUsersPanel } from '@/features/tenants/StaffUsersPanel'
import { ActionsPanel } from '@/features/tenants/ActionsPanel'
import { ImpersonateButton } from '@/features/tenants/ImpersonateButton'
import { AuditTrailPanel } from '@/features/tenants/AuditTrailPanel'
import { formatCairoDate, formatCairoDateTime, formatEgp } from '@/lib/format'
import { ApiClientError } from '@/lib/api/errors'
import { PLATFORM_TRIAL_DAYS } from '@/lib/platform-plans'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

const DETAIL_TABS = ['overview', 'subscription', 'usage', 'users', 'activity'] as const
type DetailTab = (typeof DETAIL_TABS)[number]

function isDetailTab(value: string | null): value is DetailTab {
  return !!value && (DETAIL_TABS as readonly string[]).includes(value)
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  const ms = end - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function TenantDetailPage() {
  const t = useUiStore((s) => s.t)
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const role = useAuthStore((s) => s.user?.role)
  const canImpersonate = isOpsOrAbove(role)

  // Tab selection lives in the URL so deep links, refresh, and back/forward preserve state.
  const activeTab: DetailTab = isDetailTab(params.get('tab')) ? (params.get('tab') as DetailTab) : 'overview'
  function setActiveTab(tab: DetailTab) {
    const next = new URLSearchParams(params)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setParams(next, { replace: true })
  }

  const returnToRaw = params.get('returnTo')
  const returnTo =
    returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//')
      ? returnToRaw
      : null
  const backParams = new URLSearchParams(params)
  backParams.delete('tab')
  backParams.delete('returnTo')
  const backQuery = backParams.toString()
  const backHref = returnTo ?? `/oc/gyms?mode=cloud${backQuery ? `&${backQuery}` : ''}`
  const backLabel = returnTo?.startsWith('/support') ? `← ${t('gyms.backSupport')}` : `← ${t('gyms.back')}`

  const detailQuery = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => fetchTenantDetail(id),
    enabled: Boolean(id),
    retry: false,
  })

  const changesQuery = useQuery({
    queryKey: ['tenant-changes', id],
    queryFn: () => fetchSubscriptionChanges(id),
    enabled: Boolean(id) && detailQuery.isSuccess,
  })

  const invoicesQuery = useQuery({
    queryKey: ['tenant-invoices', id],
    queryFn: () => fetchTenantInvoices(id),
    enabled: Boolean(id) && detailQuery.isSuccess,
  })

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (detailQuery.isError) {
    const err = detailQuery.error
    const notFound = err instanceof ApiClientError && err.status === 404
    return (
      <div className="cp-card p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {notFound ? t('gyms.notFound') : t('gyms.failedLoadDetail')}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {notFound ? t('gyms.missingOrDeleted') : t('gyms.loadError')}
        </p>
        <Link to={backHref} className="mt-4 inline-block text-[var(--accent)] underline">
          {t('gyms.back')}
        </Link>
      </div>
    )
  }

  const tenant = detailQuery.data!
  const sub = tenant.subscription
  const owner = (tenant.users ?? []).find((u) => (u.role ?? '').toLowerCase() === 'owner')
  const trialDaysLeft = sub?.status === 'trialing' ? daysUntil(sub.trialEndsAtUtc ?? sub.currentPeriodEnd) : null
  const initials = tenant.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to={backHref} className="text-sm font-semibold text-blue-600 hover:underline">
          {backLabel}
        </Link>

        <header className="cp-card mt-3 flex flex-wrap items-start gap-4 p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-blue-600 text-lg font-bold text-white">
            {initials || 'T'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text)]">{tenant.name}</h1>
              <span className="font-[var(--mono)] text-sm text-gray-400">{tenant.gymCode}</span>
              <TierBadge tier={sub?.planTier} />
              <StatusBadge status={sub?.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {tenant.city} · {tenant.email} · {tenant.phoneNumber}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {owner ? (
                <span>
                  {t('customers.owner')}:{' '}
                  <span className="font-semibold text-gray-800">
                    {owner.fullName}
                    {owner.email ? ` · ${owner.email}` : ''}
                  </span>
                </span>
              ) : (
                <span className="text-gray-400">{t('customers.owner')}: —</span>
              )}
              {sub?.status === 'trialing' ? (
                <span>
                  {t('gyms.trialEnds', { date: formatCairoDateTime(sub.trialEndsAtUtc ?? sub.currentPeriodEnd) })}
                  {trialDaysLeft != null ? (
                    <span className="ml-1 font-semibold text-amber-700">
                      {t('gyms.daysLeftConfig', { days: trialDaysLeft, config: PLATFORM_TRIAL_DAYS })}
                    </span>
                  ) : null}
                </span>
              ) : sub ? (
                <span>
                  {t('gyms.renewalPrice', { date: formatCairoDate(sub.currentPeriodEnd), price: formatEgp(sub.priceEgp) })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="cp-btn cp-btn-primary"
              onClick={() => setActiveTab('subscription')}
            >
              {t('gyms.manageSubscription')}
            </button>
            {canImpersonate ? (
              <details className="relative">
                <summary className="cp-btn cp-btn-secondary cursor-pointer list-none">{t('common.more')}</summary>
                <div className="absolute end-0 z-10 mt-1 min-w-[12rem] rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-2 shadow-[var(--ds-shadow-md)]">
                  <ImpersonateButton tenant={tenant} />
                </div>
              </details>
            ) : null}
          </div>
        </header>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-[var(--ds-border)]"
        role="tablist"
        aria-label={t('gyms.sectionsAria')}
      >
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${
              activeTab === tab
                ? 'border-[var(--ds-teal-500)] text-[var(--ds-text)]'
                : 'border-transparent text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]'
            }`}
          >
            {t(`gyms.tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? <TenantOverviewTab tenant={tenant} onGotoTab={setActiveTab} /> : null}

      {activeTab === 'subscription' ? (
        <div className="flex flex-col gap-6">
          {sub?.status === 'trialing' ? (
            <section className="cp-card border-l-4 border-l-amber-500 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t('gyms.trialBanner')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('gyms.trialBannerBody')}</p>
              <div className="trial-rail mt-3">
                <div className="text-xs font-semibold text-gray-500">
                  {t('gyms.trialStarted')}
                  <div className="mt-0.5 font-normal text-gray-700">
                    {formatCairoDate(sub.currentPeriodStart)}
                  </div>
                </div>
                <div>
                  <div className="rail" aria-hidden />
                  <div className="mt-1 text-center text-[11px] font-semibold uppercase text-blue-700">
                    {trialDaysLeft != null ? t('gyms.trialRemaining', { days: trialDaysLeft }) : t('gyms.inTrial')}
                  </div>
                </div>
                <div className="text-right text-xs font-semibold text-amber-700">
                  {t('gyms.trialEndsLabel')}
                  <div className="mt-0.5 font-normal text-gray-700">
                    {formatCairoDateTime(sub.trialEndsAtUtc ?? sub.currentPeriodEnd)}
                  </div>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-gray-500">{t('gyms.plan')}</dt>
                  <dd className="capitalize font-semibold">{sub.planTier}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.frozenPrice')}</dt>
                  <dd className="font-[var(--mono)]">{formatEgp(sub.priceEgp)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.paymentMethod')}</dt>
                  <dd>{sub.hasPaymentMethodOnFile ? t('gyms.cardOnFile') : t('gyms.noCard')}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {sub?.status === 'active' ? (
            <section className="cp-card border-l-4 border-l-emerald-500 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800">{t('gyms.activeBanner')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('gyms.activeBannerBody')}</p>
              {sub.cancelAtPeriodEnd ? (
                <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  {t('gyms.cancelsAt', { date: formatCairoDate(sub.currentPeriodEnd) })}
                </p>
              ) : null}
              {sub.pendingDowngradeTier ? (
                <p className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  {t('gyms.scheduledDowngrade', {
                    tier: sub.pendingDowngradeTier,
                    date: formatCairoDate(sub.currentPeriodEnd),
                  })}
                </p>
              ) : null}
            </section>
          ) : null}

          {sub?.status === 'past_due' ? (
            <section className="cp-card border-l-4 border-l-orange-500 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-orange-800">{t('gyms.pastDueBanner')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('gyms.pastDueBody')}</p>
            </section>
          ) : null}

          {sub?.status === 'suspended' ? (
            <section className="cp-card border-l-4 border-l-red-500 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-red-800">{t('gyms.suspendedBanner')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('gyms.suspendedBody')}</p>
            </section>
          ) : null}

          {sub?.status === 'cancelled' ? (
            <section className="cp-card border-l-4 border-l-gray-400 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">{t('gyms.cancelledBanner')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('gyms.cancelledBody')}</p>
              {sub.cancelledAtUtc ? (
                <p className="mt-2 text-xs text-gray-500">
                  {t('gyms.cancelledAt', { date: formatCairoDateTime(sub.cancelledAtUtc) })}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="cp-card p-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('gyms.subscriptionDetails')}</h2>
            {!sub ? (
              <p className="mt-2 text-sm text-gray-500">{t('gyms.noSubscription')}</p>
            ) : (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-gray-500">{t('gyms.currentPlan')}</dt>
                  <dd className="capitalize font-semibold">{sub.planTier}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.frozenPrice')}</dt>
                  <dd className="font-[var(--mono)] tabular-nums">{formatEgp(sub.priceEgp)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.filterStatus')}</dt>
                  <dd>
                    <StatusBadge status={sub.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.billingCycle')}</dt>
                  <dd className="capitalize">{sub.billingCycle}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.periodStart')}</dt>
                  <dd>{formatCairoDate(sub.currentPeriodStart)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('gyms.renewalPeriodEnd')}</dt>
                  <dd>{formatCairoDate(sub.currentPeriodEnd)}</dd>
                </div>
                {sub.status === 'trialing' && sub.trialEndsAtUtc ? (
                  <div>
                    <dt className="text-gray-500">{t('gyms.trialEndsUtc')}</dt>
                    <dd>{formatCairoDateTime(sub.trialEndsAtUtc)}</dd>
                  </div>
                ) : null}
                {sub.pendingDowngradeTier ? (
                  <div>
                    <dt className="text-gray-500">{t('gyms.pendingDowngrade')}</dt>
                    <dd className="capitalize font-semibold">{sub.pendingDowngradeTier}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-gray-500">{t('plans.updated')}</dt>
                  <dd>{formatCairoDateTime(sub.updatedAtUtc)}</dd>
                </div>
              </dl>
            )}
          </section>

          <details className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">{t('gyms.moreBilling')}</summary>
            <div className="mt-3">
              <ActionsPanel tenant={tenant} />
            </div>
          </details>

          <section className="cp-card p-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('gyms.history')}</h2>
            {changesQuery.isLoading ? (
              <div className="mt-3 h-24 animate-pulse rounded bg-gray-200" />
            ) : changesQuery.isError ? (
              <p className="mt-2 text-sm text-red-600">{t('gyms.historyFailed')}</p>
            ) : !changesQuery.data?.length ? (
              <p className="mt-2 text-sm text-gray-500">{t('gyms.historyEmpty')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="cp-table min-w-full">
                  <thead>
                    <tr>
                      <th>{t('gyms.changeType')}</th>
                      <th>{t('gyms.tier')}</th>
                      <th>{t('gyms.effective')}</th>
                      <th>{t('gyms.initiatedBy')}</th>
                      <th>{t('gyms.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changesQuery.data.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <StatusBadge status={c.changeType} />
                        </td>
                        <td>
                          {c.fromTier || c.toTier
                            ? `${c.fromTier ?? '—'} ${c.fromTier && c.toTier ? '→' : ''} ${c.toTier ?? ''}`.trim()
                            : '—'}
                        </td>
                        <td>{formatCairoDateTime(c.effectiveAtUtc)}</td>
                        <td className="capitalize">{c.initiatedBy.replace('_', ' ')}</td>
                        <td className="text-gray-500">{c.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <TenantBillingTab subscription={sub} invoicesQuery={invoicesQuery} />
        </div>
      ) : null}

      {activeTab === 'usage' ? <UsagePanel usageCounters={tenant.usageCounters} /> : null}

      {activeTab === 'users' ? <StaffUsersPanel tenantId={tenant.id} tenantName={tenant.name} /> : null}

      {activeTab === 'activity' ? (
        <div className="flex flex-col gap-4">
          <HealthTab health={tenant.health} />
          <AuditTrailPanel recentAudit={tenant.recentAudit} />
        </div>
      ) : null}
    </div>
  )
}
