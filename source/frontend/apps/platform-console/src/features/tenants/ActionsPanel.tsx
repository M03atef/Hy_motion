import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  applyCoupon,
  cancelTenantSubscription,
  changeTenantTier,
  convertTrialTenant,
  deleteFeatureOverride,
  extendTrialTenant,
  forceReactivateTenant,
  forceSuspendTenant,
  restartPaidTenant,
  startTrialTenant,
  undoCancelTenantSubscription,
  upsertFeatureOverride,
} from '@/lib/api/tenant-actions-api'
import { ApiClientError } from '@/lib/api/errors'
import type {
  FeatureOverrideDto,
  PlatformTenantDetailDto,
  PriceOverrideDto,
} from '@/lib/api/types'
import { KNOWN_FEATURE_KEYS, PLAN_TIERS, planTierRank } from '@/lib/api/types'
import { formatCairoDate, formatCairoDateTime, formatEgp } from '@/lib/format'
import { isAdmin, isOpsOrAbove, MIN_REASON_LENGTH, validateReason } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

type ModalKind =
  | 'suspend'
  | 'reactivate'
  | 'extend'
  | 'coupon'
  | 'change-tier'
  | 'cancel'
  | 'undo-cancel'
  | 'convert-trial'
  | 'restart-paid'
  | 'start-trial'
  | 'override-add'
  | 'override-revoke'
  | null

interface ActionsPanelProps {
  tenant: PlatformTenantDetailDto
}

function ReasonField({
  value,
  onChange,
  disabled,
  id = 'action-reason',
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <label className="mt-2 block text-sm" htmlFor={id}>
      <span className="text-gray-500">
        Reason <span className="text-red-600">(required, min {MIN_REASON_LENGTH} chars — audit log)</span>
      </span>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60"
        placeholder="Explain why this action is being taken…"
      />
    </label>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  tooltip,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tooltip?: string
  tone?: 'default' | 'danger'
}) {
  const classes =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
      : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'

  return (
    <span className="inline-flex" title={disabled && tooltip ? tooltip : undefined}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-disabled={disabled}
        className={`rounded-[var(--radius)] border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-45 ${classes}`}
      >
        {label}
      </button>
    </span>
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return 'Forbidden — your role cannot perform this action (403).'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function ActionsPanel({ tenant }: ActionsPanelProps) {
  const role = useAuthStore((s) => s.user?.role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const ops = isOpsOrAbove(role)
  const admin = isAdmin(role)
  const sub = tenant.subscription
  const status = sub?.status ?? ''

  const [modal, setModal] = useState<ModalKind>(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState(7)
  const [couponType, setCouponType] = useState<'percent' | 'fixed'>('percent')
  const [couponValue, setCouponValue] = useState('10')
  const [couponExpires, setCouponExpires] = useState('')
  const [overrideKey, setOverrideKey] = useState<string>(KNOWN_FEATURE_KEYS[0])
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const [overrideExpires, setOverrideExpires] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<FeatureOverrideDto | null>(null)
  const [newTier, setNewTier] = useState<string>(sub?.planTier ?? PLAN_TIERS[0])
  const [tierEffectiveNow, setTierEffectiveNow] = useState(false)
  const [cancelImmediate, setCancelImmediate] = useState(false)
  const [restartTier, setRestartTier] = useState<string>(sub?.planTier ?? PLAN_TIERS[1])
  const [startTrialTier, setStartTrialTier] = useState<string>(PLAN_TIERS[1])
  const [startTrialDays, setStartTrialDays] = useState(14)

  const openModal = (kind: ModalKind) => {
    setModal(kind)
    setFormError(null)
    // Preserve reason only on error reopen of same flow — fresh open clears.
    setReason('')
  }

  const closeModal = () => {
    if (busy) return
    setModal(null)
    setRevokeTarget(null)
    setFormError(null)
  }

  const invalidateTenant = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['tenant-changes', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    ])
  }

  const onMutationSuccess = async (message: string) => {
    setModal(null)
    setRevokeTarget(null)
    setFormError(null)
    setReason('')
    showToast(message, 'success')
    await invalidateTenant()
  }

  const onMutationError = (err: unknown) => {
    setFormError(errorMessage(err))
  }

  const suspendMutation = useMutation({
    mutationFn: () => forceSuspendTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: () => onMutationSuccess(`Suspended ${tenant.name}.`),
    onError: onMutationError,
  })
  const reactivateMutation = useMutation({
    mutationFn: () => forceReactivateTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: () => onMutationSuccess(`Reactivated ${tenant.name}.`),
    onError: onMutationError,
  })
  const extendMutation = useMutation({
    mutationFn: () =>
      extendTrialTenant(tenant.id, { days: extendDays, reason: reason.trim() }),
    onSuccess: () => onMutationSuccess(`Extended trial for ${tenant.name} by ${extendDays} day(s).`),
    onError: onMutationError,
  })
  const couponMutation = useMutation({
    mutationFn: () => {
      const value = Number(couponValue)
      if (!Number.isFinite(value) || value <= 0) {
        return Promise.reject(new Error('Coupon value must be a positive number.'))
      }
      if (!couponExpires) {
        return Promise.reject(new Error('Expiry date is required.'))
      }
      const expiresAtUtc = new Date(couponExpires).toISOString()
      return applyCoupon(tenant.id, {
        discountType: couponType,
        value,
        expiresAtUtc,
        reason: reason.trim(),
      })
    },
    onSuccess: () => onMutationSuccess(`Coupon applied to ${tenant.name}.`),
    onError: onMutationError,
  })
  const overrideMutation = useMutation({
    mutationFn: () =>
      upsertFeatureOverride(tenant.id, {
        featureKey: overrideKey,
        enabled: overrideEnabled,
        reason: reason.trim(),
        expiresAtUtc: overrideExpires ? new Date(overrideExpires).toISOString() : null,
      }),
    onSuccess: () => onMutationSuccess(`Feature override saved for ${tenant.name}.`),
    onError: onMutationError,
  })
  const revokeMutation = useMutation({
    mutationFn: () => {
      if (!revokeTarget) return Promise.reject(new Error('No override selected.'))
      return deleteFeatureOverride(tenant.id, revokeTarget.id)
    },
    onSuccess: () => onMutationSuccess(`Feature override revoked for ${tenant.name}.`),
    onError: onMutationError,
  })
  const changeTierMutation = useMutation({
    mutationFn: () =>
      changeTenantTier(tenant.id, {
        newTier,
        effectiveNow: tierEffectiveNow,
        reason: reason.trim(),
      }),
    onSuccess: () =>
      onMutationSuccess(
        planTierRank(newTier) > planTierRank(sub?.planTier ?? '')
          ? `Upgraded ${tenant.name} to ${newTier}.`
          : tierEffectiveNow
            ? `Changed ${tenant.name} to ${newTier} immediately.`
            : `Scheduled ${tenant.name} to move to ${newTier} at period end.`,
      ),
    onError: onMutationError,
  })
  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelTenantSubscription(tenant.id, {
        immediate: cancelImmediate,
        reason: reason.trim(),
      }),
    onSuccess: () =>
      onMutationSuccess(
        cancelImmediate
          ? `Cancelled ${tenant.name} immediately.`
          : `${tenant.name} will cancel at the end of the current period.`,
      ),
    onError: onMutationError,
  })

  const undoCancelMutation = useMutation({
    mutationFn: () => undoCancelTenantSubscription(tenant.id, { reason: reason.trim() }),
    onSuccess: () =>
      onMutationSuccess(`Cleared scheduled cancellation for ${tenant.name}.`),
    onError: onMutationError,
  })

  const convertTrialMutation = useMutation({
    mutationFn: () => convertTrialTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: () => onMutationSuccess(`Converted ${tenant.name} from trial to active.`),
    onError: onMutationError,
  })

  const restartPaidMutation = useMutation({
    mutationFn: () =>
      restartPaidTenant(tenant.id, { tier: restartTier, reason: reason.trim() }),
    onSuccess: () =>
      onMutationSuccess(`Created a new paid subscription for ${tenant.name}.`),
    onError: onMutationError,
  })

  const startTrialMutation = useMutation({
    mutationFn: () =>
      startTrialTenant(tenant.id, { tier: startTrialTier, trialDays: startTrialDays }),
    onSuccess: () => onMutationSuccess(`Started a new trial for ${tenant.name}.`),
    onError: onMutationError,
  })

  const busy =
    suspendMutation.isPending ||
    reactivateMutation.isPending ||
    extendMutation.isPending ||
    couponMutation.isPending ||
    overrideMutation.isPending ||
    revokeMutation.isPending ||
    changeTierMutation.isPending ||
    cancelMutation.isPending ||
    undoCancelMutation.isPending ||
    convertTrialMutation.isPending ||
    restartPaidMutation.isPending ||
    startTrialMutation.isPending

  const reasonOk = validateReason(reason) === null
  const canSuspend = status === 'active' || status === 'past_due' || status === 'trialing'
  const canReactivate = status === 'suspended'
  const canExtend = status === 'trialing'
  const canChangeTier = status === 'active' || status === 'past_due' || status === 'trialing'
  const canCancel = status !== '' && status !== 'cancelled' && status !== 'suspended'
  const canUndoCancel =
    (status === 'active' || status === 'past_due' || status === 'trialing') && !!sub?.cancelAtPeriodEnd
  const canConvertTrial = status === 'trialing'
  const canRestartPaid = status === 'cancelled'
  const canStartTrial = !sub || status === 'cancelled'
  const adminTooltip = 'Requires Platform Admin'
  const isDowngrade = planTierRank(newTier) < planTierRank(sub?.planTier ?? '')

  const overrides = tenant.featureOverrides ?? []
  const coupons = useMemo(
    () => (tenant.priceOverrides ?? []).filter((c) => c.isActive !== false),
    [tenant.priceOverrides],
  )

  const runWithReason = (fn: () => void) => {
    const err = validateReason(reason)
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    fn()
  }

  const supportTooltip = 'Requires Platform Ops'

  return (
    <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium">Actions</h2>
      <p className="mt-1 text-xs text-gray-500">
        Write operations against this tenant&apos;s billing state. Every confirm requires an audit reason.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          label="Force suspend"
          tone="danger"
          disabled={!ops || !canSuspend}
          tooltip={
            !ops
              ? supportTooltip
              : !canSuspend
                ? 'Only active, past due, or trialing subscriptions can be suspended'
                : undefined
          }
          onClick={() => openModal('suspend')}
        />
        {canExtend ? (
          <ActionButton
            label="Extend trial"
            disabled={!ops}
            tooltip={!ops ? supportTooltip : undefined}
            onClick={() => openModal('extend')}
          />
        ) : null}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">More</summary>
        <div className="mt-2 flex flex-wrap gap-2">
        <ActionButton
          label="Force reactivate"
          disabled={!ops || !canReactivate}
          tooltip={
            !ops
              ? supportTooltip
              : !canReactivate
                ? 'Only suspended subscriptions can be reactivated'
                : undefined
          }
          onClick={() => openModal('reactivate')}
        />
        {canConvertTrial ? (
          <ActionButton
            label="Convert to paid"
            disabled={!ops}
            tooltip={!ops ? supportTooltip : undefined}
            onClick={() => openModal('convert-trial')}
          />
        ) : null}
        {ops ? (
          <ActionButton label="Apply coupon" onClick={() => openModal('coupon')} />
        ) : null}
        <ActionButton
          label="Change plan"
          disabled={!admin || !canChangeTier}
          tooltip={
            !admin
              ? adminTooltip
              : !canChangeTier
                ? 'Only active, past due, or trialing subscriptions can change tier'
                : undefined
          }
          onClick={() => {
            setNewTier(sub?.planTier ?? PLAN_TIERS[0])
            setTierEffectiveNow(false)
            openModal('change-tier')
          }}
        />
        <ActionButton
          label="Cancel subscription"
          tone="danger"
          disabled={!admin || !canCancel}
          tooltip={
            !admin
              ? adminTooltip
              : !canCancel
                ? 'No live subscription to cancel'
                : undefined
          }
          onClick={() => {
            setCancelImmediate(false)
            openModal('cancel')
          }}
        />
        {canUndoCancel ? (
          <ActionButton
            label="Undo scheduled cancellation"
            disabled={!admin}
            tooltip={!admin ? adminTooltip : undefined}
            onClick={() => openModal('undo-cancel')}
          />
        ) : null}
        {canRestartPaid ? (
          <ActionButton
            label="Restart as paid"
            disabled={!ops}
            tooltip={!ops ? supportTooltip : undefined}
            onClick={() => {
              setRestartTier(sub?.planTier ?? PLAN_TIERS[1])
              openModal('restart-paid')
            }}
          />
        ) : null}
        {canStartTrial ? (
          <ActionButton
            label="Start new trial"
            disabled={!ops}
            tooltip={!ops ? supportTooltip : undefined}
            onClick={() => {
              setStartTrialTier(PLAN_TIERS[1])
              setStartTrialDays(14)
              openModal('start-trial')
            }}
          />
        ) : null}
      </div>
      </details>

      {ops && coupons.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-500">Active coupons</h3>
          <ul className="mt-1 space-y-1 text-sm text-gray-700">
            {coupons.map((c: PriceOverrideDto) => (
              <li key={c.id}>
                {c.discountType === 'percent' ? `${c.value}%` : formatEgp(c.value)} off · expires{' '}
                {formatCairoDateTime(c.expiresAtUtc)} · {c.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ops ? (
        <FeatureOverridesSubPanel
          overrides={overrides}
          busy={busy}
          onAdd={() => openModal('override-add')}
          onRevoke={(row) => {
            setRevokeTarget(row)
            openModal('override-revoke')
          }}
        />
      ) : null}

      {/* Suspend */}
      <ConfirmDialog
        open={modal === 'suspend'}
        title="Force suspend"
        description={
          <p>
            This will immediately suspend <strong>{tenant.name}</strong>&apos;s admin dashboard
            access (owner/manager/receptionist logins blocked). Member check-in can continue for a
            short buffer (typically 48–72 hours) before all tenant APIs lock. Document why —
            this is written to the platform audit log.
          </p>
        }
        confirmLabel="Suspend now"
        confirmTone="danger"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => suspendMutation.mutate())}
      >
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Reactivate */}
      <ConfirmDialog
        open={modal === 'reactivate'}
        title="Force reactivate"
        description={
          <p>
            This will immediately restore <strong>{tenant.name}</strong> to an active subscription
            and unlock admin access. Use when payment was confirmed offline or a mistaken
            suspension needs correcting.
          </p>
        }
        confirmLabel="Reactivate"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => reactivateMutation.mutate())}
      >
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Extend trial */}
      <ConfirmDialog
        open={modal === 'extend'}
        title="Extend trial"
        description={
          <p>
            Extends the trial end date and current period end for <strong>{tenant.name}</strong>.
            Only valid while status is <code>trialing</code>.
          </p>
        }
        confirmLabel="Extend trial"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk || extendDays < 1}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => extendMutation.mutate())}
      >
        <label className="mt-2 block text-sm" htmlFor="extend-days">
          <span className="text-gray-500">Days to add</span>
          <input
            id="extend-days"
            type="number"
            min={1}
            max={90}
            disabled={busy}
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value))}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Coupon */}
      <ConfirmDialog
        open={modal === 'coupon'}
        title="Apply coupon"
        description={
          <p>
            Creates a time-boxed price override for <strong>{tenant.name}</strong>. The next renewal
            invoice picks up the newest non-expired coupon automatically.
          </p>
        }
        confirmLabel="Apply coupon"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => couponMutation.mutate())}
      >
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-gray-500">Type</span>
            <select
              disabled={busy}
              value={couponType}
              onChange={(e) => setCouponType(e.target.value as 'percent' | 'fixed')}
              className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed EGP</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-500">Value</span>
            <input
              disabled={busy}
              type="number"
              min={0.01}
              step="0.01"
              value={couponValue}
              onChange={(e) => setCouponValue(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>
        </div>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Expires at (local)</span>
          <input
            disabled={busy}
            type="datetime-local"
            value={couponExpires}
            onChange={(e) => setCouponExpires(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Change tier */}
      <ConfirmDialog
        open={modal === 'change-tier'}
        title="Change plan"
        description={
          <p>
            Changes <strong>{tenant.name}</strong>&apos;s plan from{' '}
            <strong className="capitalize">{sub?.planTier ?? '—'}</strong> to{' '}
            <strong className="capitalize">{newTier}</strong>. Upgrades always apply immediately.
            {isDowngrade
              ? ' Downgrades can apply now or at the end of the current billing period.'
              : null}
          </p>
        }
        confirmLabel="Change plan"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk || newTier === sub?.planTier}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => changeTierMutation.mutate())}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">New plan</span>
          <select
            disabled={busy}
            value={newTier}
            onChange={(e) => setNewTier(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 capitalize"
          >
            {PLAN_TIERS.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </label>
        {isDowngrade ? (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busy}
              checked={tierEffectiveNow}
              onChange={(e) => setTierEffectiveNow(e.target.checked)}
            />
            Apply now instead of at period end
          </label>
        ) : null}
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Cancel subscription */}
      <ConfirmDialog
        open={modal === 'cancel'}
        title="Cancel subscription"
        description={
          <p>
            {cancelImmediate ? (
              <>
                Cancels <strong>{tenant.name}</strong>&apos;s subscription <strong>immediately</strong>.
                Admin access is cut off right away, subject to the same check-in buffer as a suspension.
              </>
            ) : (
              <>
                Schedules <strong>{tenant.name}</strong>&apos;s subscription to cancel at the end of the
                current billing period ({formatCairoDate(sub?.currentPeriodEnd ?? '')}). No further
                renewal invoice will be issued.
              </>
            )}
          </p>
        }
        confirmLabel="Cancel subscription"
        confirmTone="danger"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => cancelMutation.mutate())}
      >
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={busy}
            checked={cancelImmediate}
            onChange={(e) => setCancelImmediate(e.target.checked)}
          />
          Cancel immediately (instead of at period end)
        </label>
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'undo-cancel'}
        title="Undo scheduled cancellation"
        description={
          <p>
            Clears the scheduled cancellation for <strong>{tenant.name}</strong>. Status stays{' '}
            <strong>{status || 'unchanged'}</strong>, period end stays{' '}
            {formatCairoDate(sub?.currentPeriodEnd ?? '')}, and price is not changed. The tenant will
            renew normally at period end.
          </p>
        }
        confirmLabel="Undo cancellation"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => undoCancelMutation.mutate())}
      >
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'convert-trial'}
        title="Convert trial to paid"
        description={
          <p>
            Sales-assisted conversion for <strong>{tenant.name}</strong>. Moves{' '}
            <strong>trialing → active</strong> without collecting payment. Plan and frozen price stay
            unchanged. Automatic card-based conversion at period end still applies for other tenants.
          </p>
        }
        confirmLabel="Convert to paid"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => convertTrialMutation.mutate())}
      >
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'restart-paid'}
        title="Restart as paid"
        description={
          <p>
            Creates a <strong>new active subscription</strong> for <strong>{tenant.name}</strong>. The
            cancelled subscription row stays terminal — it is not revived.
          </p>
        }
        confirmLabel="Restart as paid"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => restartPaidMutation.mutate())}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Plan tier (current list price)</span>
          <select
            disabled={busy}
            value={restartTier}
            onChange={(e) => setRestartTier(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 capitalize"
          >
            {PLAN_TIERS.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </label>
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'start-trial'}
        title="Start new trial"
        description={
          <p>
            Starts a fresh <strong>trialing</strong> subscription for <strong>{tenant.name}</strong>.
            Only available when no live subscription exists.
          </p>
        }
        confirmLabel="Start trial"
        busy={busy}
        error={formError}
        confirmDisabled={startTrialDays < 1 || startTrialDays > 90}
        onClose={closeModal}
        onConfirm={() => startTrialMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Plan</span>
          <select
            disabled={busy}
            value={startTrialTier}
            onChange={(e) => setStartTrialTier(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 capitalize"
          >
            {PLAN_TIERS.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm" htmlFor="start-trial-days">
          <span className="text-gray-500">Trial duration (days, 1–90)</span>
          <input
            id="start-trial-days"
            type="number"
            min={1}
            max={90}
            disabled={busy}
            value={startTrialDays}
            onChange={(e) => setStartTrialDays(Number(e.target.value))}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
      </ConfirmDialog>

      {/* Add override */}
      <ConfirmDialog
        open={modal === 'override-add'}
        title="Add feature override"
        description={
          <p>
            Grants or denies a feature for <strong>{tenant.name}</strong> outside their plan tier.
            Expiry is optional; leave blank for no automatic expiry.
          </p>
        }
        confirmLabel="Save override"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => overrideMutation.mutate())}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Feature key</span>
          <select
            disabled={busy}
            value={overrideKey}
            onChange={(e) => setOverrideKey(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            {KNOWN_FEATURE_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={busy}
            checked={overrideEnabled}
            onChange={(e) => setOverrideEnabled(e.target.checked)}
          />
          Enabled (grant access)
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Expires at (optional)</span>
          <input
            disabled={busy}
            type="datetime-local"
            value={overrideExpires}
            onChange={(e) => setOverrideExpires(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <ReasonField value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      {/* Revoke override — DELETE has no reason body; still confirm before mutating. */}
      <ConfirmDialog
        open={modal === 'override-revoke'}
        title="Revoke feature override"
        description={
          <p>
            Permanently deletes the override for feature{' '}
            <strong>{revokeTarget?.featureKey ?? '—'}</strong> on <strong>{tenant.name}</strong>.
            Tier defaults apply again immediately. This is written to the platform audit log.
          </p>
        }
        confirmLabel="Revoke"
        confirmTone="danger"
        busy={busy}
        error={formError}
        onClose={closeModal}
        onConfirm={() => revokeMutation.mutate()}
      />
    </section>
  )
}

function FeatureOverridesSubPanel({
  overrides,
  busy,
  onAdd,
  onRevoke,
}: {
  overrides: FeatureOverrideDto[]
  busy: boolean
  onAdd: () => void
  onRevoke: (row: FeatureOverrideDto) => void
}) {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium">Feature overrides</h3>
        <button
          type="button"
          disabled={busy}
          onClick={onAdd}
          className="rounded-[var(--radius)] border border-gray-300 bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          Add override
        </button>
      </div>
      {!overrides.length ? (
        <p className="mt-2 text-sm text-gray-500">No active feature overrides.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="px-2 py-1">Feature</th>
                <th className="px-2 py-1">State</th>
                <th className="px-2 py-1">Reason</th>
                <th className="px-2 py-1">Granted by</th>
                <th className="px-2 py-1">Expires</th>
                <th className="px-2 py-1"> </th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((row) => (
                <tr key={row.id} className="border-t border-gray-200">
                  <td className="px-2 py-2 font-[var(--mono)]">{row.featureKey}</td>
                  <td className="px-2 py-2">{row.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td className="px-2 py-2 text-gray-500">{row.reason}</td>
                  <td className="px-2 py-2 font-[var(--mono)] text-xs">{row.grantedByPlatformUserId}</td>
                  <td className="px-2 py-2">
                    {row.expiresAtUtc ? formatCairoDateTime(row.expiresAtUtc) : 'Never'}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRevoke(row)}
                      className="text-red-600 underline disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
