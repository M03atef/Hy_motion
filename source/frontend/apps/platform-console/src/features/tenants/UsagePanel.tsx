import type { TenantUsageView, UsageCounterDto, UsageMetricKey } from '@/lib/api/types'
import { formatCairoDateTime, formatEgp } from '@/lib/format'

const METRIC_ORDER: UsageMetricKey[] = [
  'active_members',
  'whatsapp_messages',
  'staff_seats',
  'branches',
]

export const METRIC_LABELS: Record<string, string> = {
  active_members: 'Active Members',
  whatsapp_messages: 'WhatsApp Messages',
  staff_seats: 'Staff Seats',
  branches: 'Branches',
}

export function toTenantUsageView(counters: UsageCounterDto[] | undefined | null): TenantUsageView | null {
  if (!counters?.length) return null

  const period =
    [...counters].sort((a, b) => b.period.localeCompare(a.period))[0]?.period ?? counters[0].period
  const forPeriod = counters.filter((c) => c.period === period)

  const byMetric = new Map(forPeriod.map((c) => [c.metric, c]))
  const orderedKeys = [
    ...METRIC_ORDER.filter((k) => byMetric.has(k)),
    ...forPeriod.map((c) => c.metric).filter((k) => !METRIC_ORDER.includes(k as UsageMetricKey)),
  ]

  const uniqueKeys = [...new Set(orderedKeys)]
  const metrics = uniqueKeys.map((metric) => {
    const row = byMetric.get(metric)!
    return {
      metric,
      count: row.count,
      cap: row.cap,
      overageBilledEgp: row.overageBilledEgp,
    }
  })

  let asOfUtc: string | null = null
  for (const row of forPeriod) {
    if (!asOfUtc || row.updatedAtUtc > asOfUtc) asOfUtc = row.updatedAtUtc
  }

  return { period, metrics, asOfUtc }
}

/** "2026-07" → "July 2026" */
export function formatUsagePeriodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return period
  const utc = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(utc)
}

export type CapTone = 'unlimited' | 'green' | 'amber' | 'red'

export function capTone(count: number, cap: number | null): CapTone {
  if (cap == null) return 'unlimited'
  if (cap <= 0) return count > 0 ? 'red' : 'green'
  const pct = (count / cap) * 100
  if (pct >= 100) return 'red'
  if (pct >= 80) return 'amber'
  return 'green'
}

const BAR_CLASS: Record<Exclude<CapTone, 'unlimited'>, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

const TEXT_CLASS: Record<Exclude<CapTone, 'unlimited'>, string> = {
  green: 'text-emerald-700',
  amber: 'text-amber-800',
  red: 'text-red-600',
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ')
}

interface UsagePanelProps {
  usageCounters: UsageCounterDto[] | undefined | null
}

export function UsagePanel({ usageCounters }: UsagePanelProps) {
  const usage = toTenantUsageView(usageCounters)

  return (
    <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          {usage
            ? `Usage this period — ${formatUsagePeriodLabel(usage.period)}`
            : 'Usage this period'}
        </h2>
        {usage?.asOfUtc ? (
          <p className="text-xs text-gray-500">{formatCairoDateTime(usage.asOfUtc)}</p>
        ) : null}
      </header>
      <p className="mt-1 text-xs text-gray-500">
        Monthly rollup (not live). Caps drive upsell / overage signals.
      </p>

      {!usage ? (
        <p className="mt-3 text-sm text-gray-500">No usage counters for this period yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {usage.metrics.map((m) => {
            const tone = capTone(m.count, m.cap)
            const label = metricLabel(m.metric)
            const usedCap =
              m.cap == null
                ? `${label} — ${m.count.toLocaleString('en-EG')} / Unlimited`
                : `${label} — ${m.count.toLocaleString('en-EG')} / ${m.cap.toLocaleString('en-EG')}`

            const pct =
              m.cap != null && m.cap > 0 ? Math.min(100, Math.round((m.count / m.cap) * 1000) / 10) : 0
            const barWidth = m.cap != null && m.cap > 0 ? Math.min(100, (m.count / m.cap) * 100) : 0

            return (
              <li key={m.metric}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className={tone === 'unlimited' ? 'text-gray-800' : TEXT_CLASS[tone]}>
                    {usedCap}
                  </span>
                  {tone !== 'unlimited' ? (
                    <span className="font-[var(--mono)] text-xs text-gray-500">{pct}%</span>
                  ) : null}
                </div>

                {tone === 'unlimited' ? (
                  <p className="mt-1 text-xs text-gray-500">Unlimited — no cap on this tier.</p>
                ) : (
                  <div
                    className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuenow={m.count}
                    aria-valuemin={0}
                    aria-valuemax={m.cap ?? undefined}
                    aria-label={usedCap}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] ${BAR_CLASS[tone]}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                )}

                {m.metric === 'whatsapp_messages' &&
                m.overageBilledEgp != null &&
                m.overageBilledEgp > 0 ? (
                  <p className="mt-1.5 text-xs font-medium text-amber-800">
                    + {formatEgp(m.overageBilledEgp)} overage this period
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
