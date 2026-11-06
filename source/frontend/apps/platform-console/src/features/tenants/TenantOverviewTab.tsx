import { RiskBandBadge, StatusBadge, TierBadge } from '@/components/Badges'
import { toHealthScoreView } from '@/features/tenants/HealthScorePanel'
import { toTenantUsageView, metricLabel, capTone } from '@/features/tenants/UsagePanel'
import { labelAuditAction, extractReasonFromAudit } from '@/features/tenants/AuditTrailPanel'
import type { PlatformTenantDetailDto } from '@/lib/api/types'
import { formatCairoDate, formatCairoDateTime, formatEgp } from '@/lib/format'

type DetailTab = 'overview' | 'subscription' | 'usage' | 'users' | 'activity'

interface TenantOverviewTabProps {
  tenant: PlatformTenantDetailDto
  onGotoTab: (tab: DetailTab) => void
}

function TabLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-blue-600 underline-offset-2 hover:underline">
      {label} →
    </button>
  )
}

export function TenantOverviewTab({ tenant, onGotoTab }: TenantOverviewTabProps) {
  const sub = tenant.subscription
  const healthView = toHealthScoreView(tenant.health)
  const usageView = toTenantUsageView(tenant.usageCounters)
  const recentAudit = (tenant.recentAudit ?? []).slice(0, 3)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-medium">Business Information</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd>{tenant.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Gym code</dt>
              <dd className="font-[var(--mono)]">{tenant.gymCode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">City</dt>
              <dd>{tenant.city}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd>{tenant.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd>{tenant.phoneNumber}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Subscription</h2>
            <TabLink label="Manage" onClick={() => onGotoTab('subscription')} />
          </header>
          {!sub ? (
            <p className="mt-2 text-sm text-gray-500">No subscription on file.</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <TierBadge tier={sub.planTier} />
              <StatusBadge status={sub.status} />
              <span className="text-gray-700">{formatEgp(sub.priceEgp)}</span>
              <span className="text-gray-500">· renews {formatCairoDate(sub.currentPeriodEnd)}</span>
            </div>
          )}
          {sub?.cancelAtPeriodEnd ? (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Ends {formatCairoDate(sub.currentPeriodEnd)} and will not renew.
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Health &amp; Risk</h2>
            <TabLink label="Details" onClick={() => onGotoTab('activity')} />
          </header>
          {!healthView ? (
            <p className="mt-2 text-sm text-gray-500">Not yet computed for this gym.</p>
          ) : (
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-[var(--mono)] text-3xl font-semibold tabular-nums text-gray-900">
                {healthView.score}
              </span>
              <RiskBandBadge band={healthView.riskBand} />
              {healthView.confidence != null ? (
                <span className="text-xs text-gray-500">
                  {(healthView.confidence * 100).toFixed(0)}% confidence
                </span>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Usage Snapshot</h2>
            <TabLink label="Details" onClick={() => onGotoTab('usage')} />
          </header>
          {!usageView ? (
            <p className="mt-2 text-sm text-gray-500">No usage counters for this period yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {usageView.metrics.map((m) => {
                const tone = capTone(m.count, m.cap)
                const toneClass =
                  tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-800' : 'text-gray-700'
                return (
                  <li key={m.metric} className="flex items-center justify-between">
                    <span className="text-gray-500">{metricLabel(m.metric)}</span>
                    <span className={`font-[var(--mono)] tabular-nums ${toneClass}`}>
                      {m.count.toLocaleString('en-US')}
                      {m.cap != null ? ` / ${m.cap.toLocaleString('en-US')}` : ' / Unlimited'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Activity</h2>
          <TabLink label="View all" onClick={() => onGotoTab('activity')} />
        </header>
        {!recentAudit.length ? (
          <p className="mt-2 text-sm text-gray-500">No audit events yet for this gym.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-gray-200">
            {recentAudit.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="text-gray-800">{labelAuditAction(row.action)}</div>
                  {extractReasonFromAudit(row) ? (
                    <div className="text-xs text-gray-500">{extractReasonFromAudit(row)}</div>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-xs text-gray-500">{formatCairoDateTime(row.createdAtUtc)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
