import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsButton, DsCard, DsEmptyState, DsPageHeader } from '@/design-system'
import { fetchSubscriptionChanges, fetchTenantDetail, fetchTenantStaff } from '@/lib/api'
import type { TenantStaffDto } from '@/lib/api/types'
import { formatCairoDate, formatCairoDateTime, formatEgp } from '@/lib/format'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { capTone, toTenantUsageView } from '@/features/tenants/UsagePanel'
import { OcId, OcLoadError, OcSkeletons, OcTabs, OcUnavailable } from '../ui'
import { OcStatus } from '../OcStatus'
import { OcImpersonate } from '../OcImpersonate'
import { OcCloudActions } from '../OcCloudActions'
import { OcStaffPasswordReset } from '../OcStaffPasswordReset'
import { useOcCopy } from '../useOcCopy'

/**
 * @deprecated Unused after Phase 5 cutover. App.tsx mounts `TenantDetailPage` under
 * `/oc/gyms/cloud/:id`. Kept for reference / later OC chrome parity — do not re-wire routes here.
 */

const TABS = ['summary', 'subscription', 'usage', 'users', 'activity'] as const
type Tab = (typeof TABS)[number]

export function CloudGymDetailPage() {
  const { id = '' } = useParams()
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const canImpersonate = isOpsOrAbove(role)
  const canReset = isOpsOrAbove(role)
  const [tab, setTab] = useState<Tab>('summary')
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<TenantStaffDto | null>(null)

  const detailQuery = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => fetchTenantDetail(id),
    enabled: Boolean(id),
  })
  const changesQuery = useQuery({
    queryKey: ['tenant-changes', id],
    queryFn: () => fetchSubscriptionChanges(id),
    enabled: Boolean(id) && tab === 'activity',
  })
  const staffQuery = useQuery({
    queryKey: ['tenant-staff', id],
    queryFn: () => fetchTenantStaff(id),
    enabled: Boolean(id) && tab === 'users',
  })

  if (detailQuery.isLoading) return <OcSkeletons rows={6} />
  if (detailQuery.isError) {
    return (
      <OcLoadError
        error={detailQuery.error}
        source={`GET /platform-api/tenants/${id}`}
        onRetry={() => void detailQuery.refetch()}
      />
    )
  }
  const tenant = detailQuery.data
  if (!tenant) return <DsEmptyState title={t('gyms.notFound')} />
  const sub = tenant.subscription
  const usage = toTenantUsageView(tenant.usageCounters)
  const owner = (tenant.users ?? []).find((u) => (u.role ?? '').toLowerCase() === 'owner')

  return (
    <div className="oc-stack">
      <Link to="/oc/gyms?mode=cloud">{t('common.back')}</Link>
      <DsPageHeader
        title={tenant.name}
        subtitle={`${tenant.city} · ${tenant.email} · ${tenant.phoneNumber}`}
        actions={
          <>
            <OcCloudActions
              tenant={tenant}
              onImpersonate={canImpersonate ? () => setImpersonateOpen(true) : undefined}
            />
            <OcImpersonate tenant={tenant} open={impersonateOpen} onClose={() => setImpersonateOpen(false)} />
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <OcId value={tenant.gymCode} />
        <OcStatus value={sub?.planTier} />
        <OcStatus value={sub?.status} />
        {tenant.health?.riskBand ? <OcStatus value={tenant.health.riskBand} /> : null}
      </div>
      {tenant.customerId ? (
        <Link to={`/oc/gyms/local/${tenant.customerId}`} className="text-sm font-semibold text-[var(--ds-teal-500)]">
          {t('gyms.alsoLocal')}
        </Link>
      ) : (
        <OcUnavailable
          title={t('gyms.noLocalLink')}
          detail={t('gyms.noLocalLinkHint')}
          source={`GET /platform-api/tenants/${id} → customerId`}
        />
      )}
      <OcTabs
        label={t('gyms.cloud')}
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        tabs={TABS.map((tabId) => ({ id: tabId, label: t(`gyms.tab.${tabId}` as const) }))}
      />

      {tab === 'summary' ? (
        <DsCard>
          <dl className="oc-dl">
            <div>
              <dt>{t('gyms.owner')}</dt>
              <dd>{owner?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('gyms.code')}</dt>
              <dd>
                <OcId value={tenant.gymCode} />
              </dd>
            </div>
            <div>
              <dt>{t('gyms.subscription')}</dt>
              <dd>
                <OcStatus value={sub?.status} />
              </dd>
            </div>
            <div>
              <dt>{t('gyms.plan')}</dt>
              <dd>
                <OcStatus value={sub?.planTier} />
              </dd>
            </div>
            <div>
              <dt>{t('gyms.risk')}</dt>
              <dd>
                {tenant.health?.riskBand ? (
                  <OcStatus value={tenant.health.riskBand} />
                ) : (
                  <span className="text-sm text-[var(--ds-text-muted)]">{t('gyms.healthMissing')}</span>
                )}
              </dd>
            </div>
          </dl>
        </DsCard>
      ) : null}

      {tab === 'subscription' ? (
        sub ? (
          <DsCard>
            <dl className="oc-dl">
              <div>
                <dt>{t('gyms.plan')}</dt>
                <dd>
                  <OcStatus value={sub.planTier} />
                </dd>
              </div>
              <div>
                <dt>{t('support.status')}</dt>
                <dd>
                  <OcStatus value={sub.status} />
                </dd>
              </div>
              <div>
                <dt>{t('gyms.price')}</dt>
                <dd className="ds-ltr-isolate">{formatEgp(sub.priceEgp)}</dd>
              </div>
              <div>
                <dt>{t('gyms.period')}</dt>
                <dd className="ds-ltr-isolate">
                  {formatCairoDate(sub.currentPeriodStart)} — {formatCairoDate(sub.currentPeriodEnd)}
                </dd>
              </div>
              {sub.status === 'trialing' ? (
                <div>
                  <dt>{t('gyms.trialEnds')}</dt>
                  <dd className="ds-ltr-isolate">{formatCairoDate(sub.trialEndsAtUtc ?? sub.currentPeriodEnd)}</dd>
                </div>
              ) : (
                <div>
                  <dt>{t('gyms.renewal')}</dt>
                  <dd className="ds-ltr-isolate">{formatCairoDate(sub.currentPeriodEnd)}</dd>
                </div>
              )}
              {sub.cancelAtPeriodEnd ? (
                <div>
                  <dt>{t('gyms.cancelAtPeriodEnd')}</dt>
                  <dd>
                    <OcStatus value="cancelled" />
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="m-0 mt-3 text-sm text-[var(--ds-text-muted)]">{t('gyms.adminToolsHint')}</p>
          </DsCard>
        ) : (
          <DsEmptyState title={t('gyms.noSubscription')} hint={`GET /platform-api/tenants/${id}`} />
        )
      ) : null}

      {tab === 'usage' ? (
        usage ? (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('gyms.tab.usage')}</th>
                  <th>{t('gyms.members')}</th>
                  <th>{t('support.status')}</th>
                </tr>
              </thead>
              <tbody>
                {usage.metrics.map((row) => {
                  const tone = capTone(row.count, row.cap)
                  const badge = tone === 'red' ? 'danger' : tone === 'amber' ? 'warning' : tone === 'green' ? 'success' : 'info'
                  return (
                    <tr key={row.metric}>
                      <td>{row.metric.replace(/_/g, ' ')}</td>
                      <td className="ds-ltr-isolate">
                        {row.count}
                        {row.cap != null ? ` / ${row.cap}` : ''}
                      </td>
                      <td>
                        <OcStatus value={tone === 'unlimited' ? 'unlimited' : tone} />
                        <span className="sr-only">{badge}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <DsEmptyState title={t('gyms.noUsage')} hint={`GET /platform-api/tenants/${id} → usageCounters`} />
        )
      ) : null}

      {tab === 'users' ? (
        staffQuery.isLoading ? (
          <OcSkeletons />
        ) : staffQuery.isError ? (
          <OcLoadError error={staffQuery.error} source={`GET /platform-api/tenants/${id}/staff`} onRetry={() => void staffQuery.refetch()} />
        ) : (staffQuery.data ?? []).length === 0 ? (
          <DsEmptyState title={t('gyms.noUsers')} hint={`GET /platform-api/tenants/${id}/staff`} />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('gyms.owner')}</th>
                  <th>{t('settings.email')}</th>
                  <th>{t('settings.role')}</th>
                  <th>{t('support.status')}</th>
                  {canReset ? <th>{t('common.actions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {(staffQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.fullName}</td>
                    <td className="ds-ltr-isolate">{row.email}</td>
                    <td>
                      <OcStatus value={row.role} />
                    </td>
                    <td>
                      <OcStatus value={row.isActive ? 'active' : 'disabled'} />
                    </td>
                    {canReset ? (
                      <td>
                        <DsButton type="button" variant="secondary" size="sm" onClick={() => setResetTarget(row)}>
                          {t('gyms.resetPassword')}
                        </DsButton>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      <OcStaffPasswordReset tenantId={id} staff={resetTarget} open={Boolean(resetTarget)} onClose={() => setResetTarget(null)} />

      {tab === 'activity' ? (
        changesQuery.isLoading ? (
          <OcSkeletons />
        ) : changesQuery.isError ? (
          <OcLoadError
            error={changesQuery.error}
            source={`GET /platform-api/tenants/${id}/subscription-changes`}
            onRetry={() => void changesQuery.refetch()}
          />
        ) : (changesQuery.data ?? []).length === 0 && !(tenant.recentAudit ?? []).length ? (
          <OcUnavailable title={t('gyms.noActivity')} source={`GET /platform-api/tenants/${id}/subscription-changes`} />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('settings.action')}</th>
                  <th>{t('settings.actor')}</th>
                  <th>{t('settings.when')}</th>
                </tr>
              </thead>
              <tbody>
                {(changesQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.changeType}</td>
                    <td className="ds-ltr-isolate">{row.initiatedBy}</td>
                    <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
                  </tr>
                ))}
                {(tenant.recentAudit ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.action}</td>
                    <td className="ds-ltr-isolate">{row.actorName ?? row.actorPlatformUserId}</td>
                    <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  )
}
