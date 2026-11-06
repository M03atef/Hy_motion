import { useEffect, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchChurnMetrics,
  fetchConversionMetrics,
  fetchMrr,
  fetchMrrMovement,
  fetchTierDistribution,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import {
  cairoMonthStartYmd,
  cairoTodayYmd,
  formatCairoDate,
  formatCairoDateTime,
  formatEgp,
  formatPercent,
} from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/ui-store'

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-gray-200 pt-6 first:border-t-0 first:pt-0">
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  )
}

function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  retryLabel,
  children,
}: {
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  retryLabel: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    )
  }
  if (isError) {
    const msg =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : retryLabel
    return (
      <p role="alert" className="text-sm text-red-600">
        {msg}{' '}
        <button type="button" className="underline" onClick={onRetry}>
          {retryLabel}
        </button>
      </p>
    )
  }
  return <>{children}</>
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function MetricsPage() {
  const t = useUiStore((s) => s.t)
  const retry = t('common.retry')
  const [params, setParams] = useSearchParams()
  const defaults = useMemo(
    () => ({
      asOf: cairoTodayYmd(),
      from: cairoMonthStartYmd(),
      to: cairoTodayYmd(),
    }),
    [],
  )

  const asOf = params.get('asOf') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  // Seed URL with Cairo defaults once if missing.
  useEffect(() => {
    const next = new URLSearchParams(params)
    let changed = false
    if (!params.get('asOf')) {
      next.set('asOf', defaults.asOf)
      changed = true
    }
    if (!params.get('from')) {
      next.set('from', defaults.from)
      changed = true
    }
    if (!params.get('to')) {
      next.set('to', defaults.to)
      changed = true
    }
    if (changed) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveAsOf = isYmd(asOf) ? asOf : defaults.asOf
  const rangeValid = isYmd(from) && isYmd(to) && from <= to
  const rangeError =
    !from || !to
      ? t('metrics.rangeRequired')
      : !isYmd(from) || !isYmd(to)
        ? t('metrics.rangeFormat')
        : from > to
          ? t('metrics.rangeOrder')
          : null

  function patchDates(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    setParams(next, { replace: true })
  }

  const mrrQuery = useQuery({
    queryKey: ['metrics', 'mrr', effectiveAsOf],
    queryFn: () => fetchMrr(effectiveAsOf),
  })

  const tierQuery = useQuery({
    queryKey: ['metrics', 'tier-distribution', effectiveAsOf],
    queryFn: () => fetchTierDistribution(effectiveAsOf),
  })

  const movementQuery = useQuery({
    queryKey: ['metrics', 'movement', from, to],
    queryFn: () => fetchMrrMovement(from, to),
    enabled: rangeValid,
  })

  const churnQuery = useQuery({
    queryKey: ['metrics', 'churn', from, to],
    queryFn: () => fetchChurnMetrics(from, to),
    enabled: rangeValid,
  })

  const conversionQuery = useQuery({
    queryKey: ['metrics', 'conversion', from, to],
    queryFn: () => fetchConversionMetrics(from, to),
    enabled: rangeValid,
  })

  const tierMax = Math.max(1, ...(tierQuery.data?.tiers.map((t) => t.mrrEgp) ?? [0]))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('metrics.title')} subtitle={t('metrics.subtitle')} />

      <div className="flex flex-wrap gap-4 border-b border-gray-200 pb-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">{t('metrics.asOf')}</span>
          <input
            type="date"
            value={asOf || defaults.asOf}
            onChange={(e) => patchDates({ asOf: e.target.value })}
            className="rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">{t('metrics.rangeFrom')}</span>
          <input
            type="date"
            value={from || defaults.from}
            onChange={(e) => patchDates({ from: e.target.value })}
            className="rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">{t('metrics.rangeTo')}</span>
          <input
            type="date"
            value={to || defaults.to}
            onChange={(e) => patchDates({ to: e.target.value })}
            className="rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
      </div>

      <Section
        title={t('metrics.mrrArr')}
        subtitle={t('metrics.snapshotAsOf', { date: formatCairoDate(effectiveAsOf) })}
      >
        <QueryState
          isLoading={mrrQuery.isLoading}
          isError={mrrQuery.isError}
          error={mrrQuery.error}
          onRetry={() => mrrQuery.refetch()}
          retryLabel={retry}
        >
          {mrrQuery.data ? (
            mrrQuery.data.payingTenantCount === 0 ? (
              <p className="text-sm text-gray-500">{t('metrics.noPaying')}</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-3">
                <MetricStat label="MRR" value={formatEgp(mrrQuery.data.mrrEgp)} />
                <MetricStat label="ARR" value={formatEgp(mrrQuery.data.arrEgp)} />
                <MetricStat
                  label={t('metrics.payingTenants')}
                  value={String(mrrQuery.data.payingTenantCount)}
                />
                <p className="sm:col-span-3 text-xs text-gray-500">
                  {t('metrics.computed', { date: formatCairoDateTime(mrrQuery.data.computedAtUtc) })}
                </p>
              </div>
            )
          ) : null}
        </QueryState>
      </Section>

      <Section
        title={t('metrics.movement')}
        subtitle={
          rangeValid
            ? `${formatCairoDate(from)} → ${formatCairoDate(to)}`
            : t('metrics.validRange')
        }
      >
        {rangeError ? (
          <p role="alert" className="text-sm text-amber-800">
            {rangeError}
          </p>
        ) : (
          <QueryState
            isLoading={movementQuery.isLoading}
            isError={movementQuery.isError}
            error={movementQuery.error}
            onRetry={() => movementQuery.refetch()}
            retryLabel={retry}
          >
            {movementQuery.data ? (
              <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
                <MetricStat label={t('metrics.new')} value={formatEgp(movementQuery.data.newMrrEgp)} />
                <MetricStat label={t('metrics.expansion')} value={formatEgp(movementQuery.data.expansionMrrEgp)} />
                <MetricStat
                  label={t('metrics.contraction')}
                  value={formatEgp(movementQuery.data.contractionMrrEgp)}
                />
                <MetricStat label={t('metrics.churned')} value={formatEgp(movementQuery.data.churnedMrrEgp)} />
                <MetricStat label={t('metrics.ending')} value={formatEgp(movementQuery.data.endingMrrEgp)} />
                <p className="sm:col-span-3 lg:col-span-5 text-xs text-gray-500">
                  {t('metrics.starting', { value: formatEgp(movementQuery.data.startingMrrEgp) })}
                  {' · '}
                  {t('metrics.directEnd', { value: formatEgp(movementQuery.data.endingMrrDirectEgp) })}
                  {' · '}
                  {movementQuery.data.reconciles ? t('metrics.reconciles') : t('metrics.doesNotReconcile')}
                </p>
              </div>
            ) : null}
          </QueryState>
        )}
      </Section>

      <Section title={t('metrics.churn')} subtitle={rangeValid ? undefined : t('metrics.validRange')}>
        {rangeError ? (
          <p role="alert" className="text-sm text-amber-800">
            {rangeError}
          </p>
        ) : (
          <QueryState
            isLoading={churnQuery.isLoading}
            isError={churnQuery.isError}
            error={churnQuery.error}
            onRetry={() => churnQuery.refetch()}
            retryLabel={retry}
          >
            {churnQuery.data ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-6 sm:grid-cols-3">
                  <MetricStat
                    label={t('metrics.grossChurn')}
                    value={formatPercent(churnQuery.data.grossChurnRate)}
                  />
                  <MetricStat
                    label={t('metrics.churnedMrr')}
                    value={formatEgp(churnQuery.data.churnedMrrEgp)}
                  />
                  <MetricStat
                    label={t('metrics.payingTenants')}
                    value={t('metrics.churnedTenants', {
                      churned: churnQuery.data.churnedTenants,
                      start: churnQuery.data.startingPayingTenants,
                    })}
                  />
                </div>
                {churnQuery.data.cohorts.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      {t('metrics.cohorts')}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="py-1 pr-4 font-medium">{t('metrics.cohort')}</th>
                            <th className="py-1 pr-4 font-medium">{t('metrics.signedUp')}</th>
                            <th className="py-1 pr-4 font-medium">{t('metrics.stillPaying')}</th>
                            <th className="py-1 font-medium">{t('metrics.retention')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {churnQuery.data.cohorts.map((c) => (
                            <tr key={c.cohortMonth} className="border-t border-gray-200">
                              <td className="py-1.5 pr-4 font-[var(--mono)] text-gray-800">
                                {c.cohortMonth}
                              </td>
                              <td className="py-1.5 pr-4 tabular-nums">{c.signedUp}</td>
                              <td className="py-1.5 pr-4 tabular-nums">{c.retainedPaying}</td>
                              <td className="py-1.5 tabular-nums">
                                {formatPercent(c.retentionRate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('metrics.noCohorts')}</p>
                )}
              </div>
            ) : null}
          </QueryState>
        )}
      </Section>

      <Section
        title={t('metrics.conversion')}
        subtitle={rangeValid ? undefined : t('metrics.validRange')}
      >
        {rangeError ? (
          <p role="alert" className="text-sm text-amber-800">
            {rangeError}
          </p>
        ) : (
          <QueryState
            isLoading={conversionQuery.isLoading}
            isError={conversionQuery.isError}
            error={conversionQuery.error}
            onRetry={() => conversionQuery.refetch()}
            retryLabel={retry}
          >
            {conversionQuery.data ? (
              conversionQuery.data.trialsStarted === 0 ? (
                <p className="text-sm text-gray-500">{t('metrics.noTrials')}</p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-3">
                  <MetricStat
                    label={t('metrics.trialsStarted')}
                    value={String(conversionQuery.data.trialsStarted)}
                  />
                  <MetricStat
                    label={t('metrics.converted')}
                    value={String(conversionQuery.data.convertedToPaid)}
                  />
                  <MetricStat
                    label={t('metrics.conversionRate')}
                    value={formatPercent(conversionQuery.data.conversionRate)}
                  />
                </div>
              )
            ) : null}
          </QueryState>
        )}
      </Section>

      <Section
        title={t('metrics.tierDist')}
        subtitle={t('metrics.payingMix', { date: formatCairoDate(effectiveAsOf) })}
      >
        <QueryState
          isLoading={tierQuery.isLoading}
          isError={tierQuery.isError}
          error={tierQuery.error}
          onRetry={() => tierQuery.refetch()}
          retryLabel={retry}
        >
          {tierQuery.data ? (
            tierQuery.data.totalPayingTenants === 0 ? (
              <p className="text-sm text-gray-500">{t('metrics.noPaying')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-6 sm:grid-cols-2">
                  <MetricStat label={t('metrics.totalMrr')} value={formatEgp(tierQuery.data.totalMrrEgp)} />
                  <MetricStat
                    label={t('metrics.payingTenants')}
                    value={String(tierQuery.data.totalPayingTenants)}
                  />
                </div>
                <ul className="flex flex-col gap-3">
                  {tierQuery.data.tiers.map((row) => {
                    const pct = Math.round((row.mrrEgp / tierMax) * 100)
                    return (
                      <li key={row.planTier}>
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="capitalize text-gray-800">{row.planTier}</span>
                          <span className="tabular-nums text-gray-500">
                            {row.tenantCount} · {formatEgp(row.mrrEgp)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-gray-200">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${pct}%` }}
                            title={`${pct}% of max tier MRR`}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          ) : null}
        </QueryState>
      </Section>
    </div>
  )
}
