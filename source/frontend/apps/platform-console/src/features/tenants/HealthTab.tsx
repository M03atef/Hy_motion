import { RiskBandBadge } from '@/components/Badges'
import { toHealthScoreView } from '@/features/tenants/HealthScorePanel'
import type { HealthFactorView, TenantHealthScoreDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'

/**
 * Groups the real rules_v1 signals for display only — Strong / Warning / Declining.
 * The score, band, confidence, and per-signal values are all computed server-side by the
 * nightly health job; this component does not calculate anything, it only groups what
 * toHealthScoreView() already parsed from contributingFactorsJson.
 */
function groupFactors(factors: HealthFactorView[]) {
  const strong: HealthFactorView[] = []
  const declining: HealthFactorView[] = []
  const warning: HealthFactorView[] = []
  for (const f of factors) {
    if (f.impact === 'positive') strong.push(f)
    else if (f.impact === 'negative') declining.push(f)
    else warning.push(f)
  }
  return { strong, warning, declining }
}

function FactorRow({ factor }: { factor: HealthFactorView }) {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{factor.label}</span>
        <span className="font-[var(--mono)] text-xs text-gray-500">
          weight {factor.weight}
          {!factor.available ? ' · unavailable' : ''}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-gray-500">{factor.signalValue}</p>
    </li>
  )
}

function FactorGroup({
  title,
  tone,
  factors,
  emptyLabel,
}: {
  title: string
  tone: 'strong' | 'warning' | 'declining'
  factors: HealthFactorView[]
  emptyLabel: string
}) {
  const toneClass =
    tone === 'strong' ? 'text-emerald-700' : tone === 'declining' ? 'text-red-600' : 'text-amber-800'
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{title}</h3>
      {factors.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 divide-y divide-gray-200">
          {factors.map((f) => (
            <FactorRow key={f.factor} factor={f} />
          ))}
        </ul>
      )}
    </div>
  )
}

interface HealthTabProps {
  health: TenantHealthScoreDto | null | undefined
}

export function HealthTab({ health }: HealthTabProps) {
  const view = toHealthScoreView(health)

  if (!view) {
    return (
      <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium">Health</h2>
        <div className="mt-3 rounded border border-dashed border-gray-200 bg-white/40 px-4 py-6 text-center">
          <p className="text-base font-medium text-gray-800">Not yet computed</p>
          <p className="mt-1 text-sm text-gray-500">
            Brand-new or recently activated tenants appear here after the nightly health job runs.
            The score is never calculated in the browser.
          </p>
        </div>
      </section>
    )
  }

  const { strong, warning, declining } = groupFactors(view.contributingFactors)
  const confidenceLabel =
    view.confidence == null
      ? null
      : view.confidence >= 0.75
        ? 'High'
        : view.confidence >= 0.5
          ? 'Medium'
          : 'Low'

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium">Health Score</h2>
        <p className="mt-1 text-xs text-gray-500">
          Real 6-signal weighted model (login frequency, feature breadth, payment health, member-base
          trend, support tickets, usage vs. cap) — computed nightly. Server-authoritative.
        </p>
        <header className="mt-4 flex flex-wrap items-end gap-4">
          <div
            className="font-[var(--mono)] text-5xl font-semibold tabular-nums leading-none text-gray-900"
            aria-label={`Health score ${view.score} out of 100`}
          >
            {view.score}
            <span className="text-lg text-gray-500"> / 100</span>
          </div>
          <div className="flex flex-col gap-1 pb-1">
            <RiskBandBadge band={view.riskBand} />
            {view.computedAt ? (
              <p className="text-xs text-gray-500">Computed {formatCairoDateTime(view.computedAt)}</p>
            ) : null}
          </div>
          {confidenceLabel ? (
            <div className="ml-auto pb-1 text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">Confidence</div>
              <div className="text-sm font-medium text-gray-800">
                {confidenceLabel}
                <span className="ml-1 font-[var(--mono)] text-xs text-gray-500">
                  ({((view.confidence ?? 0) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          ) : null}
        </header>
        {view.summary ? <p className="mt-3 text-sm text-gray-700">{view.summary}</p> : null}
      </section>

      <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium">Why This Score</h2>
        <p className="mt-1 text-xs text-gray-500">
          The six real signals, grouped by whether they're helping, hurting, or unclear.
        </p>
        <div className="mt-4 flex flex-col gap-5">
          <FactorGroup title="Strong" tone="strong" factors={strong} emptyLabel="No signals currently positive." />
          <FactorGroup
            title="Warning"
            tone="warning"
            factors={warning}
            emptyLabel="No unavailable or borderline signals."
          />
          <FactorGroup title="Declining" tone="declining" factors={declining} emptyLabel="No signals currently negative." />
        </div>
      </section>
    </div>
  )
}
