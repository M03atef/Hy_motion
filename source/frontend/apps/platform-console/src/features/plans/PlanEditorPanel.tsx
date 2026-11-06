import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCommercialPlan,
  fetchPlanHistory,
  setDefaultPlan,
  updatePlanCaps,
  updatePlanFeatures,
  updatePlanMetadata,
  updatePlanPricing,
  updatePlanSalesStatus,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import {
  COMMERCIAL_PLAN_FEATURE_KEYS,
  type CommercialPlanDetailDto,
} from '@/lib/api/types'
import { formatCairoDateTime, formatEgp } from '@/lib/format'
import { isAdmin } from '@/lib/platform-roles'
import { MIN_REASON_LENGTH, validateReason } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

const FEATURE_GROUPS: { title: string; keys: readonly string[] }[] = [
  { title: 'Core POS', keys: ['sales', 'shifts', 'trials', 'debtors', 'refunds'] },
  { title: 'Operations', keys: ['imports', 'inventory', 'stock_management', 'hr'] },
]

function capInput(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

function parseCap(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

interface PlanEditorPanelProps {
  tier: string
  onBack: () => void
}

export function PlanEditorPanel({ tier, onBack }: PlanEditorPanelProps) {
  const admin = isAdmin(useAuthStore((s) => s.user?.role))
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()

  const planQuery = useQuery({
    queryKey: ['commercial-plan', tier],
    queryFn: () => fetchCommercialPlan(tier),
  })

  const historyQuery = useQuery({
    queryKey: ['plan-history', tier],
    queryFn: () => fetchPlanHistory(tier, 1, 25),
  })

  const plan = planQuery.data

  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [membersCap, setMembersCap] = useState('')
  const [staffCap, setStaffCap] = useState('')
  const [branchesCap, setBranchesCap] = useState('')
  const [whatsAppCap, setWhatsAppCap] = useState('')
  const [features, setFeatures] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false)

  useEffect(() => {
    if (!plan) return
    setDisplayName(plan.displayName)
    setDescription(plan.description ?? '')
    setSortOrder(String(plan.sortOrder))
    setMonthlyPrice(String(plan.monthlyPriceEgp))
    setMembersCap(capInput(plan.membersCap))
    setStaffCap(capInput(plan.staffCap))
    setBranchesCap(capInput(plan.branchesCap))
    setWhatsAppCap(capInput(plan.whatsAppCap))
    setFeatures(new Set(plan.enabledFeatures))
  }, [plan])

  const annualPreview = useMemo(() => {
    const m = Number(monthlyPrice)
    if (!Number.isFinite(m) || m <= 0) return null
    return m * 10
  }, [monthlyPrice])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['commercial-plans'] })
    queryClient.invalidateQueries({ queryKey: ['commercial-plan', tier] })
    queryClient.invalidateQueries({ queryKey: ['plan-history', tier] })
  }

  const onError = (err: unknown) => {
    showToast(
      err instanceof ApiClientError
        ? err.status === 403
          ? 'Forbidden — Requires Platform Admin.'
          : err.message
        : err instanceof Error
          ? err.message
          : 'Save failed',
      'error',
    )
  }

  const metadataMutation = useMutation({
    mutationFn: () =>
      updatePlanMetadata(tier, {
        displayName: displayName.trim(),
        description: description.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      showToast('Plan metadata saved', 'success')
      invalidate()
      setReason('')
    },
    onError,
  })

  const pricingMutation = useMutation({
    mutationFn: () =>
      updatePlanPricing(tier, {
        monthlyPriceEgp: Number(monthlyPrice),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      showToast('List price updated', 'success')
      setPriceConfirmOpen(false)
      invalidate()
      setReason('')
    },
    onError,
  })

  const capsMutation = useMutation({
    mutationFn: () =>
      updatePlanCaps(tier, {
        activeMembers: parseCap(membersCap),
        staffSeats: parseCap(staffCap),
        branches: parseCap(branchesCap),
        whatsAppMessages: parseCap(whatsAppCap),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      showToast('Usage caps updated', 'success')
      invalidate()
      setReason('')
    },
    onError,
  })

  const featuresMutation = useMutation({
    mutationFn: () =>
      updatePlanFeatures(tier, {
        enabledFeatures: [...features],
        reason: reason.trim(),
      }),
    onSuccess: () => {
      showToast('Feature entitlements updated', 'success')
      invalidate()
      setReason('')
    },
    onError,
  })

  const salesMutation = useMutation({
    mutationFn: (active: boolean) =>
      updatePlanSalesStatus(tier, { isActiveForSales: active, reason: reason.trim() }),
    onSuccess: () => {
      showToast('Sales availability updated', 'success')
      invalidate()
      setReason('')
    },
    onError,
  })

  const defaultMutation = useMutation({
    mutationFn: () => setDefaultPlan(tier, { reason: reason.trim() }),
    onSuccess: () => {
      showToast('Default plan updated', 'success')
      invalidate()
      setReason('')
    },
    onError,
  })

  const busy =
    metadataMutation.isPending ||
    pricingMutation.isPending ||
    capsMutation.isPending ||
    featuresMutation.isPending ||
    salesMutation.isPending ||
    defaultMutation.isPending

  if (planQuery.isLoading) {
    return <div className="cp-card p-8 text-center text-sm text-gray-500">Loading plan…</div>
  }

  if (planQuery.isError || !plan) {
    return (
      <div className="cp-card border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load plan.{' '}
        <button type="button" className="cp-btn cp-btn-secondary ml-2" onClick={() => planQuery.refetch()}>
          Retry
        </button>
      </div>
    )
  }

  function requireReason(): boolean {
    const err = validateReason(reason)
    if (err) {
      showToast(err, 'error')
      return false
    }
    return true
  }

  function toggleFeature(key: string) {
    setFeatures((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="cp-btn cp-btn-ghost mb-1 px-0" onClick={onBack}>
            ← Plans overview
          </button>
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">Edit — {plan.displayName}</h1>
          <p className="text-sm text-gray-500">
            Tier key <code className="font-[var(--mono)] text-xs">{plan.tier}</code>
            {!admin ? ' · Read-only (Support/Ops)' : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.isDefault ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
              Default plan
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
              plan.isActiveForSales
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : 'bg-gray-100 text-gray-600 ring-gray-200'
            }`}
          >
            {plan.isActiveForSales ? 'Active for sales' : 'Inactive for sales'}
          </span>
        </div>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Audit reason (required for saves)</span>
        <input
          className="cp-input"
          value={reason}
          disabled={!admin || busy}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Minimum ${MIN_REASON_LENGTH} characters`}
        />
      </label>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="cp-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">General</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Display name</span>
                <input className="cp-input" value={displayName} disabled={!admin} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Display order</span>
                <input className="cp-input" type="number" value={sortOrder} disabled={!admin} onChange={(e) => setSortOrder(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-gray-700">Description</span>
                <textarea className="cp-input min-h-[72px]" value={description} disabled={!admin} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>
            {admin ? (
              <button
                type="button"
                className="cp-btn cp-btn-secondary mt-3"
                disabled={busy}
                onClick={() => requireReason() && metadataMutation.mutate()}
              >
                Save metadata
              </button>
            ) : null}
          </section>

          <section className="cp-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Pricing</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Monthly list price (EGP)</span>
                <input className="cp-input font-[var(--mono)]" value={monthlyPrice} disabled={!admin} onChange={(e) => setMonthlyPrice(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Annual list price (calculated)</span>
                <input className="cp-input font-[var(--mono)]" value={annualPreview != null ? String(annualPreview) : '—'} disabled readOnly />
              </label>
            </div>
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Changing the list price affects new subscriptions and future plan changes. Existing subscriptions keep
              their frozen <code className="font-[var(--mono)] text-xs">PriceEgp</code>.
            </div>
            {admin ? (
              <button
                type="button"
                className="cp-btn cp-btn-primary mt-3"
                disabled={busy}
                onClick={() => requireReason() && setPriceConfirmOpen(true)}
              >
                Review price change
              </button>
            ) : null}
          </section>

          <section className="cp-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Usage limits</h2>
            <p className="mt-1 text-xs text-gray-500">Leave blank for unlimited (Enterprise).</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['Active members', membersCap, setMembersCap],
                  ['Staff seats', staffCap, setStaffCap],
                  ['Branches', branchesCap, setBranchesCap],
                  ['WhatsApp / mo', whatsAppCap, setWhatsAppCap],
                ] as const
              ).map(([label, val, set]) => (
                <label key={label} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">{label}</span>
                  <input className="cp-input font-[var(--mono)]" value={val} disabled={!admin} onChange={(e) => set(e.target.value)} />
                </label>
              ))}
            </div>
            {admin ? (
              <button type="button" className="cp-btn cp-btn-secondary mt-3" disabled={busy} onClick={() => requireReason() && capsMutation.mutate()}>
                Save caps
              </button>
            ) : null}
          </section>

          <section className="cp-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Features</h2>
            <div className="mt-3 flex flex-col gap-3">
              {FEATURE_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-xs font-bold uppercase text-gray-500">{g.title}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {g.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5 text-sm">
                        <input type="checkbox" disabled={!admin} checked={features.has(key)} onChange={() => toggleFeature(key)} />
                        <code className="font-[var(--mono)] text-xs">{key}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {admin ? (
              <button type="button" className="cp-btn cp-btn-secondary mt-3" disabled={busy} onClick={() => requireReason() && featuresMutation.mutate()}>
                Save features
              </button>
            ) : null}
          </section>

          <section className="cp-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Sales availability</h2>
            <p className="mt-1 text-sm text-gray-500">
              Deactivating does not modify existing subscriptions. Inactive plans cannot be selected for new
              provisioning or plan changes.
            </p>
            {admin ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  disabled={busy || plan.isActiveForSales}
                  onClick={() => requireReason() && salesMutation.mutate(true)}
                >
                  Enable for sales
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  disabled={busy || !plan.isActiveForSales || plan.isDefault}
                  onClick={() => requireReason() && salesMutation.mutate(false)}
                >
                  Disable for sales
                </button>
                {!plan.isDefault ? (
                  <button type="button" className="cp-btn cp-btn-primary" disabled={busy} onClick={() => requireReason() && defaultMutation.mutate()}>
                    Set as default plan
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="cp-card border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
            <div className="text-xs font-bold uppercase text-blue-700">Customer preview</div>
            <div className="mt-2 text-lg font-bold text-gray-900">{displayName || plan.displayName}</div>
            <div className="font-[var(--mono)] text-2xl font-bold tabular-nums text-gray-900">
              {formatEgp(Number(monthlyPrice) || plan.monthlyPriceEgp)}
              <span className="text-sm font-medium text-gray-400"> / mo</span>
            </div>
            {annualPreview != null ? (
              <div className="mt-1 text-sm text-gray-500">
                {formatEgp(annualPreview)} / yr · ~{plan.annualSavingsPercent}% savings
              </div>
            ) : null}
            <ul className="mt-3 list-disc pl-4 text-xs text-gray-600">
              <li>{membersCap.trim() ? `Up to ${membersCap} members` : 'Unlimited members'}</li>
              <li>{staffCap.trim() ? `${staffCap} staff seats` : 'Unlimited staff'}</li>
            </ul>
          </div>

          <div className="cp-card p-4">
            <h2 className="text-sm font-bold text-gray-900">Pricing history</h2>
            {historyQuery.isLoading ? (
              <p className="mt-2 text-sm text-gray-500">Loading…</p>
            ) : historyQuery.data?.items.length ? (
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {historyQuery.data.items.map((row) => (
                  <li key={row.id} className="py-2">
                    <div className="font-medium text-gray-800">{row.fieldName}</div>
                    <div className="font-[var(--mono)] text-xs text-gray-600">
                      {row.oldValue ?? '—'} → {row.newValue ?? '—'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {row.actorName ?? row.actorPlatformUserId.slice(0, 8)} · {formatCairoDateTime(row.createdAtUtc)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No changes recorded yet.</p>
            )}
          </div>
        </aside>
      </div>

      {priceConfirmOpen && plan ? (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Confirm list price change</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Monthly</span>
                <span className="font-[var(--mono)] font-semibold">
                  {formatEgp(plan.monthlyPriceEgp)} → {formatEgp(Number(monthlyPrice))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Annual (×10)</span>
                <span className="font-[var(--mono)] font-semibold">
                  {formatEgp(plan.annualPriceEgp)} → {formatEgp((Number(monthlyPrice) || 0) * 10)}
                </span>
              </div>
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
                Existing subscriptions: <strong>UNCHANGED</strong>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-900">
                New subscriptions: <strong>{formatEgp(Number(monthlyPrice))}</strong>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setPriceConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="cp-btn cp-btn-primary" disabled={pricingMutation.isPending} onClick={() => pricingMutation.mutate()}>
                Confirm &amp; publish
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}

export function formatCap(value: number | null | undefined): string {
  return value == null ? '∞' : value.toLocaleString('en-US')
}

export function allFeatureKeys(): readonly string[] {
  return COMMERCIAL_PLAN_FEATURE_KEYS
}
