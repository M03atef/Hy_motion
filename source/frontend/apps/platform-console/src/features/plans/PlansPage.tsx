import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCommercialPlans } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { CommercialPlanListItemDto } from '@/lib/api/types'
import { formatCairoDateTime, formatEgp } from '@/lib/format'
import { isAdmin } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { PageHeader } from '@/components/PageHeader'
import { StatusChip } from '@/components/Status'
import { formatCap, PlanEditorPanel } from './PlanEditorPanel'

type BillingPreview = 'monthly' | 'annual'

export function PlansPage() {
  const t = useUiStore((s) => s.t)
  const admin = isAdmin(useAuthStore((s) => s.user?.role))
  const [editTier, setEditTier] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [billingPreview, setBillingPreview] = useState<BillingPreview>('monthly')

  const query = useQuery({
    queryKey: ['commercial-plans'],
    queryFn: fetchCommercialPlans,
  })

  const plans = query.data ?? []

  const kpis = useMemo(() => {
    const activeForSales = plans.filter((p) => p.isActiveForSales).length
    const listMrrOpportunity = plans.reduce((sum, p) => sum + p.monthlyPriceEgp, 0)
    const liveSubs = plans.reduce((sum, p) => sum + p.liveSubscriptionCount, 0)
    return { activeForSales, listMrrOpportunity, liveSubs }
  }, [plans])

  if (editTier) {
    return <PlanEditorPanel tier={editTier} onBack={() => setEditTier(null)} />
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('plans.title')}
        subtitle={t('plans.subtitle')}
        actions={
          <>
            <button type="button" className="cp-btn cp-btn-primary" onClick={() => setPreviewOpen(true)}>
              {t('plans.preview')}
            </button>
            <Link to="/oc/settings/audit?action=platform.plan" className="cp-btn cp-btn-secondary">
              {t('nav.auditLog')}
            </Link>
            <button type="button" className="cp-btn cp-btn-secondary" disabled={query.isFetching} onClick={() => query.refetch()}>
              {query.isFetching ? t('plans.refreshing') : t('common.refresh')}
            </button>
          </>
        }
      />

      {!admin ? (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {t('plans.viewOnly')}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('plans.activeForSales')} value={String(kpis.activeForSales)} hint={t('plans.ofTiers', { count: plans.length })} />
        <Kpi label={t('plans.listMrr')} value={formatEgp(kpis.listMrrOpportunity)} hint={t('plans.listMrrHint')} />
        <Kpi label={t('plans.liveSubs')} value={String(kpis.liveSubs)} hint={t('plans.liveSubsHint')} />
        <Kpi label={t('plans.defaultPlan')} value={plans.find((p) => p.isDefault)?.displayName ?? '—'} hint={t('plans.defaultHint')} />
      </div>

      {query.isLoading ? (
        <div className="cp-card p-10 text-center text-sm text-gray-500">{t('plans.loading')}</div>
      ) : query.isError ? (
        <div className="cp-card border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          {query.error instanceof ApiClientError ? query.error.message : t('plans.failed')}
          <button type="button" className="cp-btn cp-btn-secondary ml-3" onClick={() => query.refetch()}>
            {t('common.retry')}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="cp-card p-10 text-center text-sm text-gray-500">{t('plans.empty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white">
          <table className="cp-table">
            <thead>
              <tr>
                <th>{t('gyms.plan')}</th>
                <th>{t('plans.monthly')}</th>
                <th>{t('plans.annual')}</th>
                <th>{t('plans.savings')}</th>
                <th>{t('plans.sales')}</th>
                <th>{t('plans.default')}</th>
                <th>{t('plans.liveSubs')}</th>
                <th>{t('gyms.members')}</th>
                <th>{t('plans.staff')}</th>
                <th>{t('plans.branches')}</th>
                <th>{t('plans.whatsapp')}</th>
                <th>{t('plans.features')}</th>
                <th>{t('plans.updated')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanRow key={p.tier} plan={p} onEdit={() => setEditTier(p.tier)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewOpen ? (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[var(--radius-lg)] border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900">{t('plans.previewTitle')}</h2>
              <div className="inline-flex rounded-[var(--radius)] border border-gray-200 p-0.5 text-sm">
                <button
                  type="button"
                  className={`rounded-[var(--radius)] px-3 py-1 font-semibold ${billingPreview === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                  onClick={() => setBillingPreview('monthly')}
                >
                  {t('plans.monthly')}
                </button>
                <button
                  type="button"
                  className={`rounded-[var(--radius)] px-3 py-1 font-semibold ${billingPreview === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                  onClick={() => setBillingPreview('annual')}
                >
                  {t('plans.annual')}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">{t('plans.previewHint')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plans.filter((p) => p.isActiveForSales).map((p) => (
                <div
                  key={p.tier}
                  className={`rounded-[var(--radius-lg)] border p-4 ${p.isDefault ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}
                >
                  <div className="text-xs font-bold uppercase text-gray-500">{p.displayName}</div>
                  <div className="mt-2 font-[var(--mono)] text-xl font-bold tabular-nums">
                    {formatEgp(billingPreview === 'monthly' ? p.monthlyPriceEgp : p.annualPriceEgp)}
                    <span className="text-xs font-normal text-gray-400">
                      {billingPreview === 'monthly' ? t('plans.perMonth') : t('plans.perYear')}
                    </span>
                  </div>
                  {billingPreview === 'annual' ? (
                    <div className="text-xs text-gray-500">{t('plans.moEquiv', { price: formatEgp(p.monthlyPriceEgp) })}</div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setPreviewOpen(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="cp-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
      <div className="text-xs text-gray-400">{hint}</div>
    </div>
  )
}

function PlanRow({ plan, onEdit }: { plan: CommercialPlanListItemDto; onEdit: () => void }) {
  const t = useUiStore((s) => s.t)
  return (
    <tr>
      <td>
        <div className="font-semibold text-gray-900">{plan.displayName}</div>
        <div className="font-[var(--mono)] text-xs text-gray-400">{plan.tier}</div>
      </td>
      <td className="font-[var(--mono)] tabular-nums">{formatEgp(plan.monthlyPriceEgp)}</td>
      <td className="font-[var(--mono)] tabular-nums">{formatEgp(plan.annualPriceEgp)}</td>
      <td className="font-[var(--mono)] tabular-nums">~{plan.annualSavingsPercent}%</td>
      <td>
        <StatusChip value={plan.isActiveForSales ? 'active' : 'inactive'} />
      </td>
      <td>{plan.isDefault ? '★' : '—'}</td>
      <td className="font-[var(--mono)] tabular-nums">{plan.liveSubscriptionCount}</td>
      <td className="font-[var(--mono)]">{formatCap(plan.membersCap)}</td>
      <td className="font-[var(--mono)]">{formatCap(plan.staffCap)}</td>
      <td className="font-[var(--mono)]">{formatCap(plan.branchesCap)}</td>
      <td className="font-[var(--mono)]">{formatCap(plan.whatsAppCap)}</td>
      <td>{plan.featureCount}</td>
      <td className="text-xs text-gray-500">{formatCairoDateTime(plan.updatedAtUtc)}</td>
      <td>
        <button type="button" className="cp-btn cp-btn-ghost text-xs" onClick={onEdit}>
          {t('common.edit')}
        </button>
      </td>
    </tr>
  )
}
