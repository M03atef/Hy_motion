import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, DsPageHeader, TextAreaField } from '@/design-system'
import { fetchLocalLicenseDetail, fetchSupportTicket, updateSupportTicket } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { formatCairoDateTime } from '@/lib/format'
import { isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcId, OcLoadError, OcSkeletons } from '../ui'
import { OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'

export function TicketDetailPage() {
  const { id = '' } = useParams()
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const actorId = useAuthStore((s) => s.user?.id)
  const canPatch = isSupportOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => fetchSupportTicket(id),
    enabled: Boolean(id),
  })
  const licenseQuery = useQuery({
    queryKey: ['local-license', query.data?.localLicenseId],
    queryFn: () => fetchLocalLicenseDetail(query.data!.localLicenseId!),
    enabled: Boolean(query.data?.localLicenseId),
  })

  const patch = useMutation({
    mutationFn: (body: { status?: string; assignedToPlatformAdminUserId?: string | null; resolution?: string }) =>
      updateSupportTicket(id, body),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['support-ticket', id] })
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  if (query.isLoading) return <OcSkeletons rows={5} />
  if (query.isError) {
    return (
      <OcLoadError
        error={query.error}
        source={`GET /platform-api/support-tickets/${id}`}
        onRetry={() => void query.refetch()}
      />
    )
  }
  const ticket = query.data
  if (!ticket) return <DsEmptyState title={t('gyms.notFound')} />
  const canMutate = canPatch && ticket.status !== 'closed'
  const license = licenseQuery.data
  const installation = license?.installations?.find((row) => row.id === ticket.localInstallationId) ?? null

  return (
    <div className="oc-stack">
      <Link to="/oc/support">{t('common.back')}</Link>
      <DsPageHeader title={ticket.subject} subtitle={ticket.ticketNumber} />
      <div className="flex flex-wrap gap-2">
        <OcStatus value={ticket.status} />
        <OcStatus value={ticket.priority} />
      </div>
      {error ? <DsAlert tone="danger">{error}</DsAlert> : null}
      <DsCard>
        <dl className="oc-dl">
          <div>
            <dt>{t('support.customer')}</dt>
            <dd>
              <Link to={`/oc/gyms/local/${ticket.customerId}`}>{ticket.customerName || ticket.customerId}</Link>
            </dd>
          </div>
          <div>
            <dt>{t('gyms.gymName')}</dt>
            <dd>{license?.gymName || ticket.customerName || t('common.none')}</dd>
          </div>
          <div>
            <dt>{t('gyms.code')}</dt>
            <dd>{license?.gymCode ? <OcId value={license.gymCode} /> : t('common.none')}</dd>
          </div>
          <div>
            <dt>{t('support.description')}</dt>
            <dd>{ticket.description || '—'}</dd>
          </div>
          <div>
            <dt>{t('support.assigned')}</dt>
            <dd>
              {ticket.assignedToPlatformAdminUserId ? <OcId value={ticket.assignedToPlatformAdminUserId} /> : t('common.none')}
            </dd>
          </div>
          <div>
            <dt>{t('gyms.license')}</dt>
            <dd>
              {ticket.localLicenseId ? (
                license?.customerId ? (
                  <Link to={`/oc/gyms/local/${license.customerId}`}>
                    <OcId value={license.licenseKey || ticket.localLicenseId} />
                  </Link>
                ) : (
                  <Link to={`/oc/gyms/licenses/${ticket.localLicenseId}`}>
                    <OcId value={license?.licenseKey || ticket.localLicenseId} />
                  </Link>
                )
              ) : (
                t('common.none')
              )}
            </dd>
          </div>
          <div>
            <dt>{t('gyms.installation')}</dt>
            <dd>
              {ticket.localInstallationId ? (
                <OcId value={installation?.installationId || ticket.localInstallationId} />
              ) : (
                t('common.none')
              )}
            </dd>
          </div>
          <div>
            <dt>{t('support.created')}</dt>
            <dd className="ds-ltr-isolate">{formatCairoDateTime(ticket.createdAtUtc)}</dd>
          </div>
          <div>
            <dt>{t('support.updated')}</dt>
            <dd className="ds-ltr-isolate">{formatCairoDateTime(ticket.updatedAtUtc)}</dd>
          </div>
          {ticket.resolution ? (
            <div>
              <dt>{t('support.resolution')}</dt>
              <dd>{ticket.resolution}</dd>
            </div>
          ) : null}
        </dl>
      </DsCard>
      {canMutate ? (
        <DsCard>
          <h3>{t('common.actions')}</h3>
          <p className="mt-0 text-sm text-[var(--ds-text-muted)]">{t('support.patchHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ticket.status === 'open' ? (
              <DsButton size="sm" onClick={() => patch.mutate({ status: 'in_progress' })} loading={patch.isPending}>
                {t('support.start')}
              </DsButton>
            ) : null}
            {ticket.status === 'in_progress' ? (
              <DsButton
                size="sm"
                variant="secondary"
                onClick={() => patch.mutate({ status: 'waiting_customer' })}
                loading={patch.isPending}
              >
                {t('support.wait')}
              </DsButton>
            ) : null}
            {ticket.status === 'waiting_customer' ? (
              <DsButton size="sm" onClick={() => patch.mutate({ status: 'in_progress' })} loading={patch.isPending}>
                {t('support.resume')}
              </DsButton>
            ) : null}
            {ticket.status === 'in_progress' ? (
              <DsButton
                size="sm"
                variant="secondary"
                onClick={() => patch.mutate({ status: 'resolved', resolution: resolution.trim() || undefined })}
                loading={patch.isPending}
              >
                {t('support.resolve')}
              </DsButton>
            ) : null}
            {ticket.status === 'resolved' ? (
              <DsButton size="sm" variant="secondary" onClick={() => patch.mutate({ status: 'closed' })} loading={patch.isPending}>
                {t('support.close')}
              </DsButton>
            ) : null}
            {actorId ? (
              <DsButton
                size="sm"
                variant="secondary"
                onClick={() => patch.mutate({ assignedToPlatformAdminUserId: actorId })}
                loading={patch.isPending}
              >
                {t('support.assignMe')}
              </DsButton>
            ) : null}
          </div>
          <div className="mt-4">
            <TextAreaField label={t('support.resolution')} value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
          </div>
        </DsCard>
      ) : canPatch ? null : (
        <DsAlert tone="info">{t('support.patchForbidden')}</DsAlert>
      )}
    </div>
  )
}
