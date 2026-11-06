import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ActionMenu, DsButton, SelectField } from '@/design-system'
import {
  cancelTenantSubscription,
  changeTenantTier,
  convertTrialTenant,
  extendTrialTenant,
  forceReactivateTenant,
  forceSuspendTenant,
  restartPaidTenant,
  undoCancelTenantSubscription,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { PLAN_TIERS, type PlatformTenantDetailDto } from '@/lib/api/types'
import { isAdmin, isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcReasonDrawer } from './OcReasonDrawer'
import { useOcCopy } from './useOcCopy'

type ActionKind = 'suspend' | 'reactivate' | 'extend' | 'convert' | 'restart' | 'changePlan' | 'cancel' | 'undoCancel'

export function OcCloudActions({
  tenant,
  onImpersonate,
}: {
  tenant: PlatformTenantDetailDto
  onImpersonate?: () => void
}) {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const ops = isOpsOrAbove(role)
  const admin = isAdmin(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [action, setAction] = useState<ActionKind | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState('7')
  const [tier, setTier] = useState(tenant.subscription?.planTier ?? 'growth')
  const [effectiveNow, setEffectiveNow] = useState(true)
  const [immediate, setImmediate] = useState(false)

  const sub = tenant.subscription
  const status = sub?.status ?? ''
  const canSuspend = ops && (status === 'active' || status === 'past_due' || status === 'trialing')
  const canReactivate = ops && status === 'suspended'
  const canExtend = ops && status === 'trialing'
  const canConvert = ops && status === 'trialing'
  const canRestart = ops && status === 'cancelled'
  const canChangePlan = admin && (status === 'active' || status === 'past_due' || status === 'trialing')
  const canCancel = admin && status !== '' && status !== 'cancelled' && status !== 'suspended'
  const canUndoCancel = admin && (status === 'active' || status === 'past_due' || status === 'trialing') && Boolean(sub?.cancelAtPeriodEnd)
  const hasAny = Boolean(onImpersonate) || canSuspend || canReactivate || canExtend || canConvert || canRestart || canChangePlan || canCancel || canUndoCancel

  function open(kind: ActionKind) {
    setMenuOpen(false)
    setAction(kind)
    setReason('')
    setError(null)
    setDays('7')
    setTier(tenant.subscription?.planTier ?? 'growth')
    setEffectiveNow(true)
    setImmediate(false)
  }

  function close() {
    setAction(null)
    setError(null)
  }

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] })
    await queryClient.invalidateQueries({ queryKey: ['tenant-changes', tenant.id] })
  }

  const suspend = useMutation({
    mutationFn: () => forceSuspendTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const reactivate = useMutation({
    mutationFn: () => forceReactivateTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const extend = useMutation({
    mutationFn: () => forceExtend(),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const convert = useMutation({
    mutationFn: () => convertTrialTenant(tenant.id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const restart = useMutation({
    mutationFn: () => restartPaidTenant(tenant.id, { tier, reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const changePlan = useMutation({
    mutationFn: () => changeTenantTier(tenant.id, { newTier: tier, effectiveNow, reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const cancel = useMutation({
    mutationFn: () => cancelTenantSubscription(tenant.id, { immediate, reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const undoCancel = useMutation({
    mutationFn: () => undoCancelTenantSubscription(tenant.id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('cloud.done'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  function forceExtend() {
    const parsed = Number(days)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return Promise.reject(new Error(t('errors.generic')))
    }
    return extendTrialTenant(tenant.id, { days: parsed, reason: reason.trim() })
  }

  const loading =
    suspend.isPending ||
    reactivate.isPending ||
    extend.isPending ||
    convert.isPending ||
    restart.isPending ||
    changePlan.isPending ||
    cancel.isPending ||
    undoCancel.isPending
  if (!hasAny) return null

  return (
    <div className="relative">
      <DsButton variant="secondary" size="sm" onClick={() => setMenuOpen((v) => !v)}>
        {t('common.more')}
      </DsButton>
      <ActionMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        {onImpersonate ? (
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onImpersonate()
            }}
          >
            {t('gyms.impersonate')}
          </button>
        ) : null}
        {canSuspend ? (
          <button type="button" onClick={() => open('suspend')}>
            {t('cloud.suspend')}
          </button>
        ) : null}
        {canReactivate ? (
          <button type="button" onClick={() => open('reactivate')}>
            {t('cloud.reactivate')}
          </button>
        ) : null}
        {canExtend ? (
          <button type="button" onClick={() => open('extend')}>
            {t('cloud.extend')}
          </button>
        ) : null}
        {canConvert ? (
          <button type="button" onClick={() => open('convert')}>
            {t('cloud.convert')}
          </button>
        ) : null}
        {canRestart ? (
          <button type="button" onClick={() => open('restart')}>
            {t('cloud.restart')}
          </button>
        ) : null}
        {canChangePlan ? (
          <button type="button" onClick={() => open('changePlan')}>
            {t('cloud.changePlan')}
          </button>
        ) : null}
        {canUndoCancel ? (
          <button type="button" onClick={() => open('undoCancel')}>
            {t('cloud.undoCancel')}
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" onClick={() => open('cancel')}>
            {t('cloud.cancel')}
          </button>
        ) : null}
      </ActionMenu>
      <OcReasonDrawer
        open={action === 'suspend'}
        title={t('cloud.suspend')}
        body={t('cloud.suspendBody')}
        confirmLabel={t('cloud.suspend')}
        tone="danger"
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={loading}
        onConfirm={() => suspend.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'reactivate'}
        title={t('cloud.reactivate')}
        body={t('cloud.reactivateBody')}
        confirmLabel={t('cloud.reactivate')}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={loading}
        onConfirm={() => reactivate.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'extend'}
        title={t('cloud.extend')}
        body={t('cloud.extendBody')}
        confirmLabel={t('cloud.extend')}
        reason={reason}
        onReasonChange={setReason}
        extra={
          <div className="mt-4">
            <SelectField label={t('cloud.days')} value={days} onChange={(e) => setDays(e.target.value)}>
              {['7', '14', '30'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
          </div>
        }
        error={error}
        loading={loading}
        onConfirm={() => extend.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'convert'}
        title={t('cloud.convert')}
        body={t('cloud.convertBody')}
        confirmLabel={t('cloud.convert')}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={loading}
        onConfirm={() => convert.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'restart'}
        title={t('cloud.restart')}
        body={t('cloud.restartBody')}
        confirmLabel={t('cloud.restart')}
        reason={reason}
        onReasonChange={setReason}
        extra={<TierSelect value={tier} onChange={setTier} />}
        error={error}
        loading={loading}
        onConfirm={() => restart.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'changePlan'}
        title={t('cloud.changePlan')}
        body={t('cloud.changePlanBody')}
        confirmLabel={t('cloud.changePlan')}
        reason={reason}
        onReasonChange={setReason}
        extra={
          <div className="mt-4 oc-stack">
            <TierSelect value={tier} onChange={setTier} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={effectiveNow} onChange={(e) => setEffectiveNow(e.target.checked)} />
              {t('cloud.effectiveNow')}
            </label>
          </div>
        }
        error={error}
        loading={loading}
        onConfirm={() => changePlan.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'cancel'}
        title={t('cloud.cancel')}
        body={t('cloud.cancelBody')}
        confirmLabel={t('cloud.cancel')}
        tone="danger"
        reason={reason}
        onReasonChange={setReason}
        extra={
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
            {t('cloud.immediateCancel')}
          </label>
        }
        error={error}
        loading={loading}
        onConfirm={() => cancel.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'undoCancel'}
        title={t('cloud.undoCancel')}
        body={t('cloud.undoCancelBody')}
        confirmLabel={t('cloud.undoCancel')}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={loading}
        onConfirm={() => undoCancel.mutate()}
        onClose={close}
      />
    </div>
  )
}

function TierSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useOcCopy()
  return (
    <div className="mt-4">
      <SelectField label={t('cloud.newTier')} value={value} onChange={(e) => onChange(e.target.value)}>
        {PLAN_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {tier}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
