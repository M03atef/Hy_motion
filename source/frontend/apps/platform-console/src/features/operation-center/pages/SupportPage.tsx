import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, DsPageHeader, SelectField } from '@/design-system'
import { assignRiskQueue, fetchDeskFeedback, fetchDeskFeedbackItem, fetchRiskQueue, fetchSupportTickets, recordRiskQueueOutcome, updateDeskFeedback } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { RISK_QUEUE_OUTCOMES } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { isOpsOrAbove, isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { PLAYBOOKS, getPlaybook } from '@/features/ops-playbook/catalog'
import { OcId, OcLoadError, OcSkeletons } from '../ui'
import { OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'

export function SupportPage() {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const canFeedback = isSupportOrAbove(role)
  const canRisk = isSupportOrAbove(role)
  return (
    <div className="oc-stack">
      <DsPageHeader title={t('support.title')} subtitle={t('support.subtitle')} />
      <div className="flex flex-wrap gap-2">
        <Link to="/oc/support" className="ds-btn ds-btn--secondary ds-btn--sm">
          {t('support.tickets')}
        </Link>
        {canFeedback ? (
          <Link to="/oc/support/feedback" className="ds-btn ds-btn--secondary ds-btn--sm">
            {t('support.feedback')}
          </Link>
        ) : null}
        {canRisk ? (
          <Link to="/oc/support/risk" className="ds-btn ds-btn--secondary ds-btn--sm">
            {t('support.risk')}
          </Link>
        ) : null}
        <Link to="/oc/support/playbooks" className="ds-btn ds-btn--secondary ds-btn--sm">
          {t('support.playbooks')}
        </Link>
      </div>
      <TicketsTable />
    </div>
  )
}

/** List preview: always surface the message; subject is secondary when present. */
export function feedbackListPreview(subject: string | null | undefined, message: string): {
  subject: string | null
  messagePreview: string
} {
  const trimmed = (message ?? '').trim()
  const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
  const sub = subject?.trim() ? subject.trim() : null
  return { subject: sub, messagePreview: preview }
}

export function FeedbackInboxPage() {
  const t = useOcCopy()
  return (
    <div className="oc-stack">
      <DsPageHeader title={t('support.feedback')} subtitle={t('support.feedbackSubtitle')} />
      <Link to="/oc/support">{t('common.back')}</Link>
      <FeedbackTable />
    </div>
  )
}

function FeedbackTable() {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const canReview = isSupportOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [nextStatus, setNextStatus] = useState('under_review')

  const query = useQuery({
    queryKey: ['desk-feedback', category, status],
    queryFn: () =>
      fetchDeskFeedback({
        category: category || undefined,
        status: status || undefined,
      }),
  })
  const detail = useQuery({
    queryKey: ['desk-feedback-item', selectedId],
    queryFn: () => fetchDeskFeedbackItem(selectedId!),
    enabled: !!selectedId,
  })
  const update = useMutation({
    mutationFn: () =>
      updateDeskFeedback(selectedId!, {
        status: nextStatus,
        internalNote: note || null,
      }),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['desk-feedback'] })
      await queryClient.invalidateQueries({ queryKey: ['desk-feedback-item'] })
    },
  })

  if (query.isLoading) return <OcSkeletons />
  if (query.isError) {
    return <OcLoadError error={query.error} source="GET /platform-api/desk-feedback" onRetry={() => void query.refetch()} />
  }
  const rows = query.data ?? []

  return (
    <div className="oc-stack">
      <div className="flex flex-wrap gap-2">
        <SelectField label={t('support.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('support.allCategories')}</option>
          <option value="feature">{t('support.cat.feature')}</option>
          <option value="problem">{t('support.cat.problem')}</option>
          <option value="general">{t('support.cat.general')}</option>
          <option value="other">{t('support.cat.other')}</option>
        </SelectField>
        <SelectField label={t('support.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('support.allStatuses')}</option>
          <option value="new">{t('support.status.new')}</option>
          <option value="under_review">{t('support.status.under_review')}</option>
          <option value="planned">{t('support.status.planned')}</option>
          <option value="resolved">{t('support.status.resolved')}</option>
          <option value="declined">{t('support.status.declined')}</option>
        </SelectField>
      </div>
      {rows.length === 0 ? <DsEmptyState title={t('support.emptyFeedback')} /> : null}
      {rows.length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table min-w-[900px]">
            <thead>
              <tr>
                <th>{t('support.when')}</th>
                <th>{t('support.gym')}</th>
                <th>{t('support.category')}</th>
                <th>{t('support.message')}</th>
                <th>{t('support.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const preview = feedbackListPreview(row.subject, row.message)
                return (
                <tr key={row.id} className="cursor-pointer" onClick={() => { setSelectedId(row.id); setNote(row.internalNote || ''); setNextStatus(row.status === 'new' ? 'under_review' : row.status) }}>
                  <td>{formatCairoDateTime(row.createdAtUtc)}</td>
                  <td>
                    {row.customerId ? (
                      <Link to={`/oc/gyms/local/${row.customerId}`}>{row.customerName || row.gymName || row.gymCode || row.customerId}</Link>
                    ) : (
                      row.gymName || row.gymCode || '—'
                    )}
                  </td>
                  <td>
                    <OcStatus value={row.category} />
                  </td>
                  <td>
                    {preview.subject ? (
                      <div className="text-xs font-semibold text-[var(--ds-text-muted)]">{preview.subject}</div>
                    ) : null}
                    <div>{preview.messagePreview || '—'}</div>
                  </td>
                  <td>
                    <OcStatus value={row.status} />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedId && detail.isLoading ? <OcSkeletons rows={3} /> : null}
      {selectedId && detail.isError ? (
        <OcLoadError
          error={detail.error}
          source={`GET /platform-api/desk-feedback/${selectedId}`}
          onRetry={() => void detail.refetch()}
        />
      ) : null}
      {selectedId && detail.data ? (
        <DsCard>
          <div className="oc-stack">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{detail.data.subject || t('support.feedback')}</h3>
                <p className="text-sm opacity-70">
                  {detail.data.senderDisplayName || detail.data.senderEmail || detail.data.senderRole} · {formatCairoDateTime(detail.data.createdAtUtc)}
                </p>
              </div>
              <DsButton variant="secondary" size="sm" onClick={() => setSelectedId(null)}>
                {t('common.close')}
              </DsButton>
            </div>
            <p className="whitespace-pre-wrap text-sm">{detail.data.message}</p>
            {canReview ? (
              <>
                <SelectField label={t('support.status')} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                  <option value="new">{t('support.status.new')}</option>
                  <option value="under_review">{t('support.status.under_review')}</option>
                  <option value="planned">{t('support.status.planned')}</option>
                  <option value="resolved">{t('support.status.resolved')}</option>
                  <option value="declined">{t('support.status.declined')}</option>
                </SelectField>
                <label className="ds-field">
                  <span className="ds-field__label">{t('support.internalNote')}</span>
                  <textarea className="ds-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                {update.error instanceof ApiClientError ? <DsAlert tone="danger">{update.error.message}</DsAlert> : null}
                <DsButton
                  variant="primary"
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => update.mutate()}
                >
                  {t('support.saveReview')}
                </DsButton>
              </>
            ) : null}
          </div>
        </DsCard>
      ) : null}
    </div>
  )
}

function TicketsTable() {
  const t = useOcCopy()
  const query = useQuery({ queryKey: ['support-tickets'], queryFn: () => fetchSupportTickets() })
  if (query.isLoading) return <OcSkeletons />
  if (query.isError) {
    return <OcLoadError error={query.error} source="GET /platform-api/support-tickets" onRetry={() => void query.refetch()} />
  }
  const rows = query.data ?? []
  if (rows.length === 0) return <DsEmptyState title={t('support.emptyTickets')} />
  return (
    <div className="ds-table-wrap">
      <table className="ds-table min-w-[800px]">
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('support.customer')}</th>
            <th>{t('support.subject')}</th>
            <th>{t('support.priority')}</th>
            <th>{t('support.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <OcId value={row.ticketNumber} />
              </td>
              <td>
                {row.customerId ? <Link to={`/oc/gyms/local/${row.customerId}`}>{row.customerName || row.customerId}</Link> : '—'}
              </td>
              <td>
                <Link to={`/oc/support/tickets/${row.id}`}>{row.subject}</Link>
              </td>
              <td>
                <OcStatus value={row.priority} />
              </td>
              <td>
                <OcStatus value={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RiskPage() {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const actorId = useAuthStore((s) => s.user?.id)
  const canAssign = isOpsOrAbove(role)
  const canOutcome = isSupportOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()
  const [outcomeByTenant, setOutcomeByTenant] = useState<Record<string, string>>({})
  const query = useQuery({ queryKey: ['risk-queue'], queryFn: () => fetchRiskQueue() })
  const assign = useMutation({
    mutationFn: (tenantId: string) => assignRiskQueue(tenantId, { assignedPlatformUserId: actorId }),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['risk-queue'] })
    },
  })
  const outcome = useMutation({
    mutationFn: ({ tenantId, value }: { tenantId: string; value: string }) =>
      recordRiskQueueOutcome(tenantId, { outcome: value }),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['risk-queue'] })
    },
  })
  const actionError = assign.error || outcome.error

  return (
    <div className="oc-stack">
      <DsPageHeader title={t('support.risk')} subtitle={t('risk.lastKnown')} />
      <Link to="/oc/support">{t('common.back')}</Link>
      <DsAlert tone="info">{t('support.riskCloudOnly')}</DsAlert>
      {actionError instanceof ApiClientError ? <DsAlert tone="danger">{actionError.message}</DsAlert> : null}
      {query.isLoading ? <OcSkeletons /> : null}
      {query.isError ? (
        <OcLoadError error={query.error} source="GET /platform-api/risk-queue" onRetry={() => void query.refetch()} />
      ) : null}
      {!query.isLoading && !query.isError && (query.data ?? []).length === 0 ? (
        <DsEmptyState title={t('support.emptyRisk')} />
      ) : null}
      {(query.data ?? []).length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table min-w-[960px]">
            <thead>
              <tr>
                <th>{t('gyms.gym')}</th>
                <th>{t('support.band')}</th>
                <th>{t('support.score')}</th>
                <th>{t('risk.computed')}</th>
                <th>{t('support.assigned')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((row) => (
                <tr key={row.tenantId}>
                  <td>
                    <div className="font-semibold">{row.name}</div>
                    <OcId value={row.gymCode} />
                    {row.summary ? <div className="text-xs text-[var(--ds-text-muted)]">{row.summary}</div> : null}
                  </td>
                  <td>
                    <OcStatus value={row.riskBand} />
                  </td>
                  <td className="ds-ltr-isolate tabular-nums">{row.score}</td>
                  <td className="ds-ltr-isolate">{formatCairoDateTime(row.computedAtUtc)}</td>
                  <td>
                    {row.assignedPlatformUserId ? <OcId value={row.assignedPlatformUserId} /> : t('common.none')}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-2">
                      <Link to={`/oc/gyms/cloud/${row.tenantId}`}>{t('common.view')}</Link>
                      {canAssign && actorId ? (
                        <DsButton
                          size="sm"
                          variant="secondary"
                          onClick={() => assign.mutate(row.tenantId)}
                          loading={assign.isPending}
                        >
                          {t('risk.assignMe')}
                        </DsButton>
                      ) : null}
                      {canOutcome ? (
                        <SelectField
                          label={t('risk.outcome')}
                          value={outcomeByTenant[row.tenantId] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value
                            setOutcomeByTenant((prev) => ({ ...prev, [row.tenantId]: value }))
                            if (value) outcome.mutate({ tenantId: row.tenantId, value })
                          }}
                        >
                          <option value="">{t('risk.outcome')}</option>
                          {RISK_QUEUE_OUTCOMES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </SelectField>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export function PlaybooksPage() {
  const t = useOcCopy()
  const locale = useUiStore((s) => s.locale)
  return (
    <div className="oc-stack">
      <DsPageHeader title={t('support.playbooks')} subtitle={t('support.catalogHint')} />
      <Link to="/oc/support">{t('common.back')}</Link>
      <DsAlert tone="info">{t('playbook.localCatalog')}</DsAlert>
      {PLAYBOOKS.length === 0 ? (
        <DsEmptyState title={t('support.emptyPlaybooks')} />
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>{t('support.playbooks')}</th>
                <th>{t('gyms.risk')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {PLAYBOOKS.map((row) => (
                <tr key={row.id}>
                  <td>{locale === 'ar' ? row.title.ar : row.title.en}</td>
                  <td>
                    <OcStatus value={row.risk} />
                  </td>
                  <td>
                    <Link to={`/oc/support/playbooks/${row.id}`}>{t('common.view')}</Link>
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

export function PlaybookDetailPage() {
  const t = useOcCopy()
  const { id = '' } = useParams()
  const locale = useUiStore((s) => s.locale)
  const playbook = getPlaybook(id)
  if (!playbook) return <DsEmptyState title={t('gyms.notFound')} hint="Local playbook catalog (no API)" />
  const lang = locale === 'ar' ? 'ar' : 'en'
  return (
    <div className="oc-stack">
      <Link to="/oc/support/playbooks">{t('common.back')}</Link>
      <DsAlert tone="info">{t('playbook.localCatalog')}</DsAlert>
      <DsCard>
        <h3>{t('playbook.next')}</h3>
        <p className="m-0 text-sm text-[var(--ds-text-muted)]">
          {playbook.steps[0] ? playbook.steps[0].action[lang] : t('common.none')}
        </p>
      </DsCard>
      <DsCard>
        <h3>{t('playbook.when')}</h3>
        <p className="m-0 text-sm text-[var(--ds-text-muted)]">{playbook.whenToUse[lang]}</p>
      </DsCard>
      <DsCard>
        <h3>{t('playbook.steps')}</h3>
        <ol className="m-0 flex flex-col gap-3 ps-4">
          {playbook.steps.map((step) => (
            <li key={step.id}>
              <div className="font-semibold">{step.action[lang]}</div>
              <div className="text-sm text-[var(--ds-text-muted)]">{step.expected[lang]}</div>
            </li>
          ))}
        </ol>
      </DsCard>
    </div>
  )
}
