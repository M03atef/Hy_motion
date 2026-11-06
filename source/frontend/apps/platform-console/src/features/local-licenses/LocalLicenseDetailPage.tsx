import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  authorizeLocalLicenseTransfer,
  fetchLocalLicenseDetail,
  reactivateLocalLicense,
  revokeLocalLicense,
  suspendLocalLicense,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { formatCairoDateTime } from '@/lib/format'
import { isAdmin, isOpsOrAbove, MIN_REASON_LENGTH, validateReason } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { StatusChip } from '@/components/Status'

type ModalKind = 'suspend' | 'revoke' | 'reactivate' | 'transfer' | null

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return 'Forbidden — you do not have permission for this action (403).'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function LocalLicenseDetailPage() {
  const { id = '' } = useParams()
  const currentUser = useAuthStore((s) => s.user)
  const ops = isOpsOrAbove(currentUser?.role)
  const admin = isAdmin(currentUser?.role)
  const showToast = useUiStore((s) => s.showToast)
  const t = useUiStore((s) => s.t)
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['local-license', id],
    queryFn: () => fetchLocalLicenseDetail(id),
    enabled: Boolean(id),
  })

  const [modal, setModal] = useState<ModalKind>(null)
  const [reason, setReason] = useState('')
  const [oldInstallationId, setOldInstallationId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function openModal(kind: ModalKind) {
    setModal(kind)
    setReason('')
    setOldInstallationId('')
    setFormError(null)
  }

  function closeModal() {
    if (busy) return
    setModal(null)
    setFormError(null)
  }

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['local-license', id] }),
      queryClient.invalidateQueries({ queryKey: ['local-licenses'] }),
    ])

  const suspendMutation = useMutation({
    mutationFn: () => suspendLocalLicense(id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast('License suspended.', 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const revokeMutation = useMutation({
    mutationFn: () => revokeLocalLicense(id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast('License revoked.', 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateLocalLicense(id, { reason: reason.trim() }),
    onSuccess: async () => {
      showToast('License reactivated.', 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const transferMutation = useMutation({
    mutationFn: () =>
      authorizeLocalLicenseTransfer(id, {
        oldInstallationId: oldInstallationId.trim() || null,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      showToast('Transfer authorized — the old installation slot has been released.', 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const busy =
    suspendMutation.isPending || revokeMutation.isPending || reactivateMutation.isPending || transferMutation.isPending

  if (detailQuery.isLoading) {
    return <div className="text-sm text-gray-500">Loading license…</div>
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/oc/gyms" className="text-sm text-blue-700 hover:underline">
          ← {t('gyms.back')}
        </Link>
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
          {detailQuery.error instanceof ApiClientError ? detailQuery.error.message : 'License not found.'}
        </div>
      </div>
    )
  }

  const lic = detailQuery.data
  const canSuspend = ops && lic.status === 'active'
  const canRevoke = admin && (lic.status === 'active' || lic.status === 'suspended' || lic.status === 'pending_activation')
  const canReactivate = admin && (lic.status === 'revoked' || lic.status === 'suspended')
  const canTransfer = ops && lic.installations.some((i) => i.status === 'active')

  return (
    <div className="flex flex-col gap-4">
      <Link to={lic.customerId ? `/customers/${lic.customerId}` : '/oc/gyms'} className="text-sm text-blue-700 hover:underline">
        ← {lic.customerId ? t('customers.backGyms') : t('gyms.back')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">HyMotion Local</p>
          <h1 className="text-2xl font-semibold text-gray-900">{lic.customerName || t('gyms.unlinkedLicense')}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-[var(--mono)] text-sm text-gray-700">
            {lic.licenseKey}
            <button
              type="button"
              className="text-xs font-sans text-blue-700 hover:underline"
              onClick={() => void navigator.clipboard.writeText(lic.licenseKey)}
            >
              {t('gyms.copyKey')}
            </button>
          </p>
          <p className="text-sm text-gray-500">
            {lic.customerId ? (
              <Link to={`/customers/${lic.customerId}`} className="text-blue-700 hover:underline">
                {lic.customerName}
              </Link>
            ) : (
              lic.customerName
            )}
            {lic.customerContact ? ` · ${lic.customerContact}` : ''}
          </p>
        </div>
        <StatusChip value={lic.status === 'created' ? 'pending_activation' : lic.status} />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Customer</div>
          <div className="truncate text-lg font-semibold text-gray-900">{lic.customerName || '—'}</div>
          {lic.customerId ? (
            <Link to={`/customers/${lic.customerId}`} className="text-xs text-blue-700 hover:underline">
              View customer
            </Link>
          ) : null}
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Contract</div>
          <div className="truncate text-lg font-semibold text-gray-900">{lic.contractNumber || '—'}</div>
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Edition</div>
          <div className="text-lg font-semibold text-gray-900">{lic.edition}</div>
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Installations</div>
          <div className="text-lg font-semibold text-gray-900">
            {lic.activeInstallationCount} / {lic.deviceLimit}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Transfers</div>
          <div className="text-lg font-semibold text-gray-900">{lic.transferCount}</div>
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Suspicious events</div>
          <div className={`text-lg font-semibold ${lic.suspiciousEventCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {lic.suspiciousEventCount}
          </div>
        </div>
      </div>

      {lic.status === 'revoked' && lic.revokedReason ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          Revoked {formatCairoDateTime(lic.revokedAtUtc)}: {lic.revokedReason}
        </div>
      ) : null}

      {lic.dealReference || lic.notes ? (
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-3 text-sm text-gray-700">
          {lic.dealReference ? (
            <div>
              <span className="text-gray-500">Deal reference:</span> {lic.dealReference}
            </div>
          ) : null}
          {lic.notes ? (
            <div>
              <span className="text-gray-500">Notes:</span> {lic.notes}
            </div>
          ) : null}
        </div>
      ) : null}

      {(canSuspend || canRevoke || canReactivate || canTransfer) ? (
        <div className="flex flex-wrap gap-2">
          {canSuspend ? (
            <button
              type="button"
              onClick={() => openModal('suspend')}
              className="rounded-[var(--radius)] border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-800 hover:bg-orange-100"
            >
              Suspend
            </button>
          ) : null}
          {canTransfer ? (
            <button
              type="button"
              onClick={() => openModal('transfer')}
              className="rounded-[var(--radius)] border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Authorize Transfer
            </button>
          ) : null}
          {canReactivate ? (
            <button
              type="button"
              onClick={() => openModal('reactivate')}
              className="rounded-[var(--radius)] border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Reactivate
            </button>
          ) : null}
          {canRevoke ? (
            <button
              type="button"
              onClick={() => openModal('revoke')}
              className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Revoke
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Installations</h2>
        <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Installation ID</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">First Activated</th>
                <th className="px-3 py-2 font-medium">Last Validated</th>
                <th className="px-3 py-2 font-medium">Deactivated</th>
              </tr>
            </thead>
            <tbody>
              {lic.installations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No installations have activated this license yet.
                  </td>
                </tr>
              ) : null}
              {lic.installations.map((inst) => (
                <tr key={inst.installationId} className="border-t border-gray-200">
                  <td className="px-3 py-2 font-[var(--mono)] text-xs text-gray-900">{inst.installationId}</td>
                  <td className="px-3 py-2 text-gray-700">{inst.status}</td>
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(inst.firstActivatedAtUtc)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(inst.lastValidatedAtUtc)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {inst.deactivatedAtUtc ? (
                      <span title={inst.deactivationReason ?? undefined}>{formatCairoDateTime(inst.deactivatedAtUtc)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Recent Changes</h2>
        <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Change</th>
                <th className="px-3 py-2 font-medium">From → To</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {lic.recentChanges.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No changes recorded yet.
                  </td>
                </tr>
              ) : null}
              {lic.recentChanges.map((change, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(change.createdAtUtc)}</td>
                  <td className="px-3 py-2 text-gray-900">{change.changeType}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {change.fromStatus ?? '—'} → {change.toStatus ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{change.initiatedBy}</td>
                  <td className="px-3 py-2 text-gray-700">{change.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={modal === 'suspend'}
        title="Suspend License"
        description="Suspends the license. The gym PC may keep working until it next validates. This is not Activate."
        confirmLabel="Suspend"
        confirmTone="danger"
        busy={busy}
        error={formError}
        confirmDisabled={!!validateReason(reason)}
        onClose={closeModal}
        onConfirm={() => suspendMutation.mutate()}
      >
        <ReasonField reason={reason} setReason={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'revoke'}
        title="Revoke License"
        description="Permanently revokes the license. This is a documented, audited action — reactivation is possible but requires its own reason."
        confirmLabel="Revoke"
        confirmTone="danger"
        busy={busy}
        error={formError}
        confirmDisabled={!!validateReason(reason)}
        onClose={closeModal}
        onConfirm={() => revokeMutation.mutate()}
      >
        <ReasonField reason={reason} setReason={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'reactivate'}
        title="Reactivate License"
        description="Moves the license back to Active. Never an implicit side effect of another action — always its own documented step."
        confirmLabel="Reactivate"
        busy={busy}
        error={formError}
        confirmDisabled={!!validateReason(reason)}
        onClose={closeModal}
        onConfirm={() => reactivateMutation.mutate()}
      >
        <ReasonField reason={reason} setReason={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'transfer'}
        title="Authorize Transfer"
        description="Releases a device slot on this license — the authorized PC-replacement workflow. The old PC can reclaim the slot until the new PC activates. Console cannot activate."
        confirmLabel="Authorize Transfer"
        busy={busy}
        error={formError}
        confirmDisabled={!!validateReason(reason)}
        onClose={closeModal}
        onConfirm={() => transferMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Old installation ID (optional)</span>
          <input
            value={oldInstallationId}
            disabled={busy}
            onChange={(e) => setOldInstallationId(e.target.value)}
            placeholder="INS-XXXXXXXXXX"
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 font-[var(--mono)] text-xs"
          />
        </label>
        <ReasonField reason={reason} setReason={setReason} disabled={busy} />
      </ConfirmDialog>
    </div>
  )
}

function ReasonField({
  reason,
  setReason,
  disabled,
}: {
  reason: string
  setReason: (v: string) => void
  disabled: boolean
}) {
  return (
    <label className="mt-2 block text-sm">
      <span className="text-gray-500">Reason (min {MIN_REASON_LENGTH} characters, required for the audit log)</span>
      <textarea
        value={reason}
        disabled={disabled}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
      />
    </label>
  )
}
