import { useMemo, useState } from 'react'
import type { PlatformAuditLogDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'

const ACTION_LABELS: Record<string, string> = {
  'platform.tenant.impersonate': 'Started impersonation session',
  'platform.tenant.force_suspend': 'Force-suspended subscription',
  'platform.tenant.force_reactivate': 'Force-reactivated subscription',
  'platform.tenant.trial_extended': 'Extended trial',
  'platform.tenant.extend_trial': 'Extended trial',
  'platform.tenant.coupon_applied': 'Applied coupon',
  'platform.tenant.feature_override_upsert': 'Upserted feature override',
  'platform.tenant.feature_override_deleted': 'Revoked feature override',
  'platform.tenant.feature_override_delete': 'Revoked feature override',
  'platform.subscription.payment_reactivated': 'Payment reactivated subscription',
}

export function labelAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  // fallback: platform.tenant.force_suspend → Force suspend
  const leaf = action.split('.').pop() ?? action
  return leaf.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function extractReasonFromAudit(row: PlatformAuditLogDto): string | null {
  for (const raw of [row.afterJson, row.beforeJson]) {
    if (!raw) continue
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>
      const reason = obj.Reason ?? obj.reason
      if (typeof reason === 'string' && reason.trim()) return reason.trim()
    } catch {
      /* ignore */
    }
  }
  return null
}

type DiffOp = 'added' | 'removed' | 'changed' | 'same'

export interface DiffRow {
  key: string
  before: string
  after: string
  op: DiffOp
}

function stringifyValue(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return 'null'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function diffJson(beforeJson: string | null | undefined, afterJson: string | null | undefined): DiffRow[] {
  let before: Record<string, unknown> = {}
  let after: Record<string, unknown> = {}
  try {
    if (beforeJson) before = JSON.parse(beforeJson) as Record<string, unknown>
  } catch {
    before = { _raw: beforeJson }
  }
  try {
    if (afterJson) after = JSON.parse(afterJson) as Record<string, unknown>
  } catch {
    after = { _raw: afterJson }
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.map((key) => {
    const hasB = Object.prototype.hasOwnProperty.call(before, key)
    const hasA = Object.prototype.hasOwnProperty.call(after, key)
    const b = stringifyValue(before[key])
    const a = stringifyValue(after[key])
    let op: DiffOp = 'same'
    if (!hasB && hasA) op = 'added'
    else if (hasB && !hasA) op = 'removed'
    else if (b !== a) op = 'changed'
    return { key, before: b, after: a, op }
  })
}

interface AuditTrailPanelProps {
  recentAudit: PlatformAuditLogDto[] | undefined | null
}

export function AuditTrailPanel({ recentAudit }: AuditTrailPanelProps) {
  const rows = recentAudit ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const expandedDiff = useMemo(() => {
    if (!expandedId) return null
    const row = rows.find((r) => r.id === expandedId)
    if (!row) return null
    return diffJson(row.beforeJson, row.afterJson)
  }, [expandedId, rows])

  return (
    <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium">Audit trail</h2>
      <p className="mt-1 text-xs text-gray-500">
        Recent platform actions for this tenant (including impersonation). Expand a row for
        before/after JSON.
      </p>

      {!rows.length ? (
        <p className="mt-3 text-sm text-gray-500">No audit events yet for this tenant.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Actor</th>
                <th className="px-2 py-1">Action</th>
                <th className="px-2 py-1">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.id
                const reason = extractReasonFromAudit(row)
                return (
                  <tr key={row.id} className="border-t border-gray-200 align-top">
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500">
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        aria-expanded={open}
                        onClick={() => setExpandedId(open ? null : row.id)}
                      >
                        {formatCairoDateTime(row.createdAtUtc)}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      {row.actorName ?? (
                        <span className="font-[var(--mono)] text-xs text-gray-500">
                          {row.actorPlatformUserId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div>{labelAuditAction(row.action)}</div>
                      <div className="font-[var(--mono)] text-[10px] text-gray-400">{row.action}</div>
                    </td>
                    <td className="px-2 py-2 text-gray-500">{reason ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {expandedId && expandedDiff ? (
            <div className="mt-3 rounded border border-gray-200 bg-white/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-800">Before / after</h3>
                <button
                  type="button"
                  className="text-xs text-gray-500 underline"
                  onClick={() => setExpandedId(null)}
                >
                  Close
                </button>
              </div>
              {!expandedDiff.length ? (
                <p className="text-sm text-gray-500">No JSON payload for this event.</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="px-1 py-1">Key</th>
                      <th className="px-1 py-1">Before</th>
                      <th className="px-1 py-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedDiff.map((d) => (
                      <tr
                        key={d.key}
                        className={
                          d.op === 'added'
                            ? 'bg-emerald-50'
                            : d.op === 'removed'
                              ? 'bg-red-50'
                              : d.op === 'changed'
                                ? 'bg-amber-50'
                                : undefined
                        }
                      >
                        <td className="px-1 py-1 font-[var(--mono)] text-gray-700">{d.key}</td>
                        <td className="px-1 py-1 font-[var(--mono)] text-gray-500 break-all">{d.before}</td>
                        <td className="px-1 py-1 font-[var(--mono)] text-gray-800 break-all">{d.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
