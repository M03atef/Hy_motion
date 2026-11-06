import { RiskBandBadge } from '@/components/Badges'
import type {
  FactorImpact,
  HealthFactorView,
  HealthScoreView,
  TenantHealthScoreDto,
} from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'

export { RiskBandBadge }

/** Fallback labels when JSON label is missing — map internal signal keys. */
const FACTOR_LABELS: Record<string, string> = {
  login_frequency: 'Owner login frequency',
  feature_breadth: 'Feature breadth',
  payment_health: 'Payment health',
  member_base_trend: 'Member-base trend',
  support_ticket_volume: 'Support ticket volume',
  usage_vs_cap: 'Usage vs. plan caps',
}

interface RulesV1Signal {
  key?: string
  label?: string
  available?: boolean
  score?: number | null
  configuredWeight?: number
  effectiveWeight?: number
  summary?: string
  detail?: unknown
}

interface RulesV1Payload {
  model?: string
  mlUsed?: boolean
  computedAtUtc?: string
  score?: number
  riskBand?: string
  confidence?: number
  summary?: string
  signals?: RulesV1Signal[]
}

export function factorLabel(key: string, apiLabel?: string | null): string {
  if (apiLabel?.trim()) return apiLabel.trim()
  return FACTOR_LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Derive impact from the per-signal score (0–100 rules_v1). */
export function impactFromScore(score: number | null | undefined, available: boolean): FactorImpact {
  if (!available || score == null) return 'neutral'
  if (score >= 70) return 'positive'
  if (score < 45) return 'negative'
  return 'neutral'
}

export function toHealthScoreView(health: TenantHealthScoreDto | null | undefined): HealthScoreView | null {
  if (!health) return null

  const raw = health.contributingFactorsJson ?? health.breakdownJson ?? null
  let payload: RulesV1Payload | null = null
  if (raw) {
    try {
      payload = JSON.parse(raw) as RulesV1Payload
    } catch {
      payload = null
    }
  }

  const signals = payload?.signals ?? []
  const factors: HealthFactorView[] = signals.map((s) => {
    const key = s.key ?? 'unknown'
    const available = Boolean(s.available)
    const score = s.score ?? null
    const weight = Number(s.configuredWeight ?? s.effectiveWeight ?? 0)
    return {
      factor: key,
      label: factorLabel(key, s.label),
      weight,
      signalValue: s.summary?.trim() || (available ? `Signal score ${score}` : 'Signal unavailable'),
      impact: impactFromScore(score, available),
      available,
      score,
    }
  })

  factors.sort((a, b) => b.weight - a.weight)

  return {
    score: health.score,
    riskBand: health.riskBand,
    computedAt: health.computedAtUtc ?? health.updatedAtUtc ?? '',
    summary: health.summary ?? payload?.summary ?? null,
    confidence: health.confidence ?? payload?.confidence ?? null,
    contributingFactors: factors,
  }
}

function ImpactGlyph({ impact }: { impact: FactorImpact }) {
  if (impact === 'positive') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-sm font-bold text-emerald-700" title="Positive">
        ↑
      </span>
    )
  }
  if (impact === 'negative') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-red-50 text-sm font-bold text-red-600" title="Negative">
        ↓
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-200 text-sm font-bold text-gray-500" title="Neutral">
      −
    </span>
  )
}

interface HealthScorePanelProps {
  health: TenantHealthScoreDto | null | undefined
}

export function HealthScorePanel({ health }: HealthScorePanelProps) {
  const view = toHealthScoreView(health)

  return (
    <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium">Health score</h2>

      {!view ? (
        <div className="mt-3 rounded border border-dashed border-gray-200 bg-white/40 px-4 py-6 text-center">
          <p className="text-base font-medium text-gray-800">Not yet computed</p>
          <p className="mt-1 text-sm text-gray-500">
            Brand-new or recently activated tenants appear here after the nightly health job runs.
          </p>
        </div>
      ) : (
        <>
          <header className="mt-3 flex flex-wrap items-end gap-4">
            <div
              className="font-[var(--mono)] text-5xl font-semibold tabular-nums leading-none text-gray-900"
              aria-label={`Health score ${view.score} out of 100`}
            >
              {view.score}
            </div>
            <div className="flex flex-col gap-1 pb-1">
              <RiskBandBadge band={view.riskBand} />
              {view.computedAt ? (
                <p className="text-xs text-gray-500">{formatCairoDateTime(view.computedAt)}</p>
              ) : null}
            </div>
            {view.confidence != null ? (
              <p className="ml-auto pb-1 text-xs text-gray-500">
                Confidence {(view.confidence * 100).toFixed(0)}%
              </p>
            ) : null}
          </header>

          {view.summary ? (
            <p className="mt-3 text-sm text-gray-700">{view.summary}</p>
          ) : null}

          <h3 className="mt-5 text-sm font-medium text-gray-500">Why this score</h3>
          {!view.contributingFactors.length ? (
            <p className="mt-2 text-sm text-gray-500">
              No contributing-factor breakdown available for this score.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200">
              {view.contributingFactors.map((f) => (
                <li key={f.factor} className="flex items-start gap-3 py-2.5">
                  <ImpactGlyph impact={f.impact} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{f.label}</span>
                      <span className="font-[var(--mono)] text-xs text-gray-500">
                        weight {f.weight}
                        {!f.available ? ' · unavailable' : ''}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{f.signalValue}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
