import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, TextAreaField } from '@/design-system'
import {
  approveLocalOwnerRecovery,
  fetchLocalOwnerRecoveries,
  fetchLocalOwnerRecovery,
  importLocalOwnerRecoveryChallenge,
  rejectLocalOwnerRecovery,
  revokeLocalOwnerRecovery,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type { LocalOwnerRecoveryListItemDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcId } from './ui'
import { OcReasonDrawer } from './OcReasonDrawer'
import { OcStatus } from './OcStatus'
import { useOcCopy } from './useOcCopy'

export function recoveryCopyKey(status: string): 'gyms.recoveryPending' | 'gyms.recoveryApproved' | 'gyms.recoveryCompleted' | 'gyms.recoveryRejected' | 'gyms.recoveryExpired' | 'gyms.recoveryCancelled' | 'gyms.recoveryRevoked' {
  switch (status) {
    case 'approved':
      return 'gyms.recoveryApproved'
    case 'completed':
      return 'gyms.recoveryCompleted'
    case 'rejected':
      return 'gyms.recoveryRejected'
    case 'expired':
      return 'gyms.recoveryExpired'
    case 'cancelled':
      return 'gyms.recoveryCancelled'
    case 'revoked':
      return 'gyms.recoveryRevoked'
    default:
      return 'gyms.recoveryPending'
  }
}

export function OcOwnerRecoveryCard({ customerId }: { customerId: string }) {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const canAct = isOpsOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['local-owner-recoveries', customerId],
    queryFn: () => fetchLocalOwnerRecoveries(customerId),
    enabled: Boolean(customerId),
  })
  const [challenge, setChallenge] = useState('')
  const [decision, setDecision] = useState<{ id: string; action: 'approve-online' | 'approve-offline' | 'reject' | 'revoke' } | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['local-owner-recoveries', customerId] })

  const showCodeMutation = useMutation({
    mutationFn: (id: string) => fetchLocalOwnerRecovery(id),
    onSuccess: (row) => setIssuedCode(row.recoveryCode ?? null),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const importMutation = useMutation({
    mutationFn: () => importLocalOwnerRecoveryChallenge(challenge.trim(), customerId),
    onSuccess: async () => {
      showToast(t('gyms.recoveryImport'), 'success')
      setChallenge('')
      setError(null)
      await invalidate()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const decideMutation = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error('missing')
      const body = {
        reason: reason.trim(),
        method: decision.action === 'approve-offline' ? 'offline' : 'online',
      }
      if (decision.action === 'reject') return rejectLocalOwnerRecovery(decision.id, body)
      if (decision.action === 'revoke') return revokeLocalOwnerRecovery(decision.id, body)
      return approveLocalOwnerRecovery(decision.id, body)
    },
    onSuccess: async (row) => {
      setIssuedCode(row.recoveryCode ?? null)
      setDecision(null)
      setReason('')
      setError(null)
      await invalidate()
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const rows = listQuery.data ?? []

  return (
    <DsCard>
      <h3>{t('gyms.recovery')}</h3>
      <p className="m-0 mt-2 text-sm text-[var(--ds-text-muted)]">{t('gyms.recoveryHint')}</p>
      {issuedCode ? (
        <div className="oc-stack mt-3">
          <DsAlert tone="warning">{t('gyms.recoveryCode')}</DsAlert>
          <p className="ds-ltr-isolate m-0 break-all text-sm">{issuedCode}</p>
          <DsButton
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(issuedCode)
              showToast(t('gyms.recoveryCopy'), 'success')
            }}
          >
            {t('gyms.recoveryCopy')}
          </DsButton>
        </div>
      ) : null}
      {listQuery.isError ? <p className="mt-3 text-sm text-[var(--ds-status-danger)]">{t('errors.generic')}</p> : null}
      {rows.length === 0 && !listQuery.isLoading ? (
        <div className="mt-3">
          <DsEmptyState title={t('gyms.recoveryEmpty')} />
        </div>
      ) : (
        <ul className="oc-stack mt-3" style={{ listStyle: 'none', padding: 0 }}>
          {rows.map((row) => (
            <RecoveryRow
              key={row.id}
              row={row}
              canAct={canAct}
              onApproveOnline={() => setDecision({ id: row.id, action: 'approve-online' })}
              onApproveOffline={() => setDecision({ id: row.id, action: 'approve-offline' })}
              onReject={() => setDecision({ id: row.id, action: 'reject' })}
              onRevoke={() => setDecision({ id: row.id, action: 'revoke' })}
              onShowCode={() => showCodeMutation.mutate(row.id)}
            />
          ))}
        </ul>
      )}
      {canAct ? (
        <form
          className="oc-stack mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            importMutation.mutate()
          }}
        >
          <TextAreaField
            label={t('gyms.recoveryImport')}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            rows={3}
          />
          <p className="m-0 text-xs text-[var(--ds-text-muted)]">{t('gyms.recoveryImportBody')}</p>
          {error && !decision ? <p className="m-0 text-sm text-[var(--ds-status-danger)]">{error}</p> : null}
          <DsButton type="submit" variant="secondary" loading={importMutation.isPending} disabled={!challenge.trim()}>
            {t('gyms.recoveryImport')}
          </DsButton>
        </form>
      ) : null}
      <OcReasonDrawer
        open={Boolean(decision)}
        title={
          decision?.action === 'reject'
            ? t('gyms.recoveryReject')
            : decision?.action === 'revoke'
              ? t('gyms.recoveryRevoke')
              : decision?.action === 'approve-offline'
                ? t('gyms.recoveryApproveOffline')
                : t('gyms.recoveryApproveOnline')
        }
        body={
          decision?.action === 'reject'
            ? t('gyms.recoveryRejectBody')
            : decision?.action === 'revoke'
              ? t('gyms.recoveryRevokeBody')
              : t('gyms.recoveryApproveBody')
        }
        confirmLabel={
          decision?.action === 'reject'
            ? t('gyms.recoveryReject')
            : decision?.action === 'revoke'
              ? t('gyms.recoveryRevoke')
              : t('gyms.recoveryApprove')
        }
        tone={decision?.action === 'reject' || decision?.action === 'revoke' ? 'danger' : 'default'}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate()}
        onClose={() => {
          setDecision(null)
          setError(null)
        }}
      />
    </DsCard>
  )
}

function RecoveryRow({
  row,
  canAct,
  onApproveOnline,
  onApproveOffline,
  onReject,
  onRevoke,
  onShowCode,
}: {
  row: LocalOwnerRecoveryListItemDto
  canAct: boolean
  onApproveOnline: () => void
  onApproveOffline: () => void
  onReject: () => void
  onRevoke: () => void
  onShowCode: () => void
}) {
  const t = useOcCopy()
  return (
    <li className="rounded-lg border border-[var(--ds-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <OcStatus value={row.status} />
        <span className="text-sm">{t(recoveryCopyKey(row.status))}</span>
        <OcId value={row.reference} />
      </div>
      <dl className="oc-dl mt-2">
        <div>
          <dt>{t('gyms.code')}</dt>
          <dd><OcId value={row.gymCode} /></dd>
        </div>
        <div>
          <dt>{t('gyms.installation')}</dt>
          <dd><OcId value={row.installationId} /></dd>
        </div>
        <div>
          <dt>{t('gyms.recoveryReference')}</dt>
          <dd className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</dd>
        </div>
      </dl>
      {canAct && row.status === 'pending' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <DsButton type="button" onClick={onApproveOnline}>{t('gyms.recoveryApproveOnline')}</DsButton>
          <DsButton type="button" variant="secondary" onClick={onApproveOffline}>{t('gyms.recoveryApproveOffline')}</DsButton>
          <DsButton type="button" variant="danger" onClick={onReject}>{t('gyms.recoveryReject')}</DsButton>
        </div>
      ) : null}
      {canAct && row.status === 'approved' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <DsButton type="button" variant="secondary" onClick={onShowCode}>{t('gyms.recoveryCode')}</DsButton>
          <DsButton type="button" variant="danger" onClick={onRevoke}>{t('gyms.recoveryRevoke')}</DsButton>
        </div>
      ) : null}
    </li>
  )
}
