import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAuditLog } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { labelAuditAction, extractReasonFromAudit } from '@/features/tenants/AuditTrailPanel'
import { formatCairoDateTime } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/ui-store'

const PAGE_SIZE = 25

export function AuditLogPage() {
  const t = useUiStore((s) => s.t)
  const [params, setParams] = useSearchParams()
  const tenantId = params.get('tenantId') ?? ''
  const action = params.get('action') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? '1') || 1

  // Actor has no server-side filter on GET /platform-api/audit today (the endpoint takes
  // tenantId/action/from/to only) — filtering here narrows the current page's rows client-side
  // rather than pretending to be a real server-side filter across all pages.
  const [actorFilter, setActorFilter] = useState('')

  const queryKey = useMemo(
    () => ['audit-log', { tenantId, action, from, to, page }] as const,
    [tenantId, action, from, to, page],
  )

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchAuditLog({
        tenantId: tenantId || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    setParams(next, { replace: true })
  }

  const rows = query.data?.items ?? []
  const visibleRows = actorFilter.trim()
    ? rows.filter((r) => (r.actorName ?? r.actorPlatformUserId).toLowerCase().includes(actorFilter.trim().toLowerCase()))
    : rows
  const colCount = 5

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">{t('audit.tenantId')}</span>
            <input
              value={tenantId}
              onChange={(e) => patchParams({ tenantId: e.target.value || null, page: '1' })}
              placeholder={t('audit.tenantPlaceholder')}
              className="cp-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">{t('audit.action')}</span>
            <input
              value={action}
              onChange={(e) => patchParams({ action: e.target.value || null, page: '1' })}
              placeholder={t('audit.actionPlaceholder')}
              className="cp-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">{t('audit.actor')}</span>
            <input
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder={t('audit.actorPlaceholder')}
              className="cp-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">{t('audit.from')}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => patchParams({ from: e.target.value || null, page: '1' })}
              className="cp-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">{t('audit.to')}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => patchParams({ to: e.target.value || null, page: '1' })}
              className="cp-input"
            />
          </label>
        </div>
        <p className="text-xs text-gray-500">{t('audit.filterHint')}</p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
        <table className="cp-table min-w-full text-left text-sm">
          <thead>
            <tr>
              <th>{t('audit.timestamp')}</th>
              <th>{t('audit.gym')}</th>
              <th>{t('audit.action')}</th>
              <th>{t('audit.actorCol')}</th>
              <th>{t('audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {query.isError ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-red-600">
                  {query.error instanceof ApiClientError ? query.error.message : t('audit.failedLoad')}{' '}
                  <button type="button" className="underline" onClick={() => query.refetch()}>
                    {t('common.retry')}
                  </button>
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-gray-500">
                  {t('audit.empty')}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row) => {
              const reason = extractReasonFromAudit(row)
              return (
                <tr key={row.id} className="border-t border-gray-200 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {formatCairoDateTime(row.createdAtUtc)}
                  </td>
                  <td className="px-3 py-2">
                    {row.tenantId ? (
                      <Link to={`/oc/gyms/cloud/${row.tenantId}`} className="text-blue-600 underline-offset-2 hover:underline">
                        {row.tenantName ?? row.gymCode ?? row.tenantId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{labelAuditAction(row.action)}</div>
                    <div className="font-[var(--mono)] text-[10px] text-gray-400">{row.action}</div>
                  </td>
                  <td className="px-3 py-2">
                    {row.actorName ?? (
                      <span className="font-[var(--mono)] text-xs text-gray-500">
                        {row.actorPlatformUserId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{reason ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {query.data ? (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('gyms.pageOf', { page: query.data.page, pages: Math.max(query.data.totalPages, 1), total: query.data.totalCount })}
            {query.isFetching && !query.isLoading ? ` · ${t('gyms.updating')}` : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!query.data.hasPrevious}
              className="cp-btn cp-btn-secondary"
              onClick={() => patchParams({ page: String(page - 1) })}
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              disabled={!query.data.hasNext}
              className="cp-btn cp-btn-secondary"
              onClick={() => patchParams({ page: String(page + 1) })}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
