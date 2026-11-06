import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ActionMenu, DsButton, TextInput } from '@/design-system'
import {
  authorizeLocalLicenseTransfer,
  reactivateLocalLicense,
  revokeLocalLicense,
  suspendLocalLicense,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { isAdmin, isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcReasonDrawer } from './OcReasonDrawer'
import { useOcCopy } from './useOcCopy'

type ActionKind = 'suspend' | 'revoke' | 'restore' | 'transfer'

export function OcLicenseActions({
  licenseId,
  licenseKey,
  status,
  installations = [],
}: {
  licenseId: string
  licenseKey?: string
  status: string
  installations?: Array<{ installationId: string; status: string }>
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
  const [oldInstallationId, setOldInstallationId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeInstall = installations.find((row) => row.status === 'active')
  const canSuspend = ops && status === 'active'
  const canRevoke = admin && status !== 'revoked'
  const canRestore = admin && (status === 'suspended' || status === 'revoked')
  const canTransfer = ops && Boolean(activeInstall)
  const hasAny = canSuspend || canRevoke || canRestore || canTransfer

  function open(kind: ActionKind) {
    setMenuOpen(false)
    setAction(kind)
    setReason('')
    setError(null)
    setOldInstallationId(activeInstall?.installationId ?? '')
  }

  function close() {
    setAction(null)
    setError(null)
  }

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['local-license', licenseId] }),
      queryClient.invalidateQueries({ queryKey: ['local-licenses'] }),
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] }),
    ])
  }

  const suspend = useMutation({
    mutationFn: () => suspendLocalLicense(licenseId, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('gyms.suspendDone'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const revoke = useMutation({
    mutationFn: () => revokeLocalLicense(licenseId, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('gyms.revokeDone'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const restore = useMutation({
    mutationFn: () => reactivateLocalLicense(licenseId, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast(t('gyms.restoreDone'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })
  const transfer = useMutation({
    mutationFn: () =>
      authorizeLocalLicenseTransfer(licenseId, {
        oldInstallationId: oldInstallationId.trim() || null,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      showToast(t('gyms.transferDone'), 'success')
      await invalidate()
      close()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const loading = suspend.isPending || revoke.isPending || restore.isPending || transfer.isPending
  if (!hasAny) return null

  return (
    <div className="relative">
      <DsButton variant="secondary" size="sm" onClick={() => setMenuOpen((v) => !v)}>
        {t('common.more')}
      </DsButton>
      <ActionMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        {canSuspend ? (
          <button type="button" onClick={() => open('suspend')}>
            {t('gyms.suspend')}
          </button>
        ) : null}
        {canRestore ? (
          <button type="button" onClick={() => open('restore')}>
            {t('gyms.restore')}
          </button>
        ) : null}
        {canTransfer ? (
          <button type="button" onClick={() => open('transfer')}>
            {t('gyms.transfer')}
          </button>
        ) : null}
        {canRevoke ? (
          <button type="button" onClick={() => open('revoke')}>
            {t('gyms.revoke')}
          </button>
        ) : null}
      </ActionMenu>
      <OcReasonDrawer
        open={action === 'suspend'}
        title={t('gyms.suspend')}
        body={t('gyms.suspendBody')}
        confirmLabel={t('gyms.suspend')}
        reason={reason}
        onReasonChange={setReason}
        extra={
          licenseKey ? (
            <p className="mt-3 text-sm">
              {t('gyms.actionTarget')}: <span className="ds-ltr-isolate font-semibold">{licenseKey}</span>
            </p>
          ) : null
        }
        error={error}
        loading={loading}
        onConfirm={() => suspend.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'revoke'}
        title={t('gyms.revoke')}
        body={t('gyms.revokeBody')}
        confirmLabel={t('gyms.revoke')}
        tone="danger"
        reason={reason}
        onReasonChange={setReason}
        extra={
          licenseKey ? (
            <p className="mt-3 text-sm">
              {t('gyms.actionTarget')}: <span className="ds-ltr-isolate font-semibold">{licenseKey}</span>
            </p>
          ) : null
        }
        error={error}
        loading={loading}
        onConfirm={() => revoke.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'restore'}
        title={t('gyms.restore')}
        body={t('gyms.restoreBody')}
        confirmLabel={t('gyms.restore')}
        reason={reason}
        onReasonChange={setReason}
        extra={
          licenseKey ? (
            <p className="mt-3 text-sm">
              {t('gyms.actionTarget')}: <span className="ds-ltr-isolate font-semibold">{licenseKey}</span>
            </p>
          ) : null
        }
        error={error}
        loading={loading}
        onConfirm={() => restore.mutate()}
        onClose={close}
      />
      <OcReasonDrawer
        open={action === 'transfer'}
        title={t('gyms.transfer')}
        body={t('gyms.transferBody')}
        confirmLabel={t('gyms.transfer')}
        reason={reason}
        onReasonChange={setReason}
        extra={
          <div className="mt-4 oc-stack">
            {licenseKey ? (
              <p className="m-0 text-sm">
                {t('gyms.actionTarget')}: <span className="ds-ltr-isolate font-semibold">{licenseKey}</span>
              </p>
            ) : null}
            <TextInput
              label={t('gyms.oldInstall')}
              value={oldInstallationId}
              onChange={(e) => setOldInstallationId(e.target.value)}
              disabled={loading}
            />
          </div>
        }
        error={error}
        loading={loading}
        onConfirm={() => transfer.mutate()}
        onClose={close}
      />
    </div>
  )
}
