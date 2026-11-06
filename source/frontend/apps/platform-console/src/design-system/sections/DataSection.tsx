import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { DsAlert, DsBadge, DsButton } from '../components/Button'
import { SearchInput } from '../components/forms'
import { Tooltip } from '../components/overlays'
import { SAMPLE_INSTALLS } from '../sample-data'
import { usePreview } from '../preview-context'

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'expiring' || status === 'pending') return 'warning'
  if (status === 'suspended') return 'danger'
  return 'neutral'
}

function statusLabel(status: string, t: (k: 'statusActive' | 'statusExpiring' | 'statusSuspended' | 'statusPending') => string) {
  if (status === 'active') return t('statusActive')
  if (status === 'expiring') return t('statusExpiring')
  if (status === 'suspended') return t('statusSuspended')
  return t('statusPending')
}

export function DataSection() {
  const { t, locale } = usePreview()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active'>('all')
  const [tableMode, setTableMode] = useState<'data' | 'empty' | 'loading' | 'error'>('data')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    return SAMPLE_INSTALLS.filter((row) => {
      const gym = locale === 'ar' ? row.gymAr : row.gymEn
      const matches = `${gym} ${row.id}`.toLowerCase().includes(query.toLowerCase())
      const statusOk = filter === 'all' || row.status === 'active'
      return matches && statusOk
    })
  }, [query, filter, locale])

  return (
    <section id="data" className="ds-section">
      <p className="ds-section-kicker">F</p>
      <h2 className="ds-section-title">{t('dataTitle')}</h2>
      <p className="ds-section-lead">{t('dataLead')}</p>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        {[
          [t('metricGyms'), '24'],
          [t('metricLicenses'), '18'],
          [t('metricOpen'), '6'],
          [t('metricBackups'), '11'],
        ].map(([label, value]) => (
          <div className="ds-card ds-metric" key={label}>
            <span className="ds-metric-label">{label}</span>
            <span className="ds-metric-value ds-ltr-isolate">{value}</span>
            <span className="ds-metric-hint">{t('sampleGym')}</span>
          </div>
        ))}
      </div>

      <div className="ds-card mb-4 flex flex-wrap gap-2">
        <DsBadge tone="success">{t('statusActive')}</DsBadge>
        <DsBadge tone="warning">{t('statusExpiring')}</DsBadge>
        <DsBadge tone="danger">{t('statusSuspended')}</DsBadge>
        <DsBadge tone="neutral">{t('statusPending')}</DsBadge>
        <DsBadge tone="info">{t('statusInfo')}</DsBadge>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput label={t('searchFilter')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ds-segment" role="group">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('filterAll')}
          </button>
          <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>
            {t('filterActive')}
          </button>
        </div>
        <div className="ds-segment" role="group" aria-label={t('tableGym')}>
          <button type="button" aria-pressed={tableMode === 'data'} onClick={() => setTableMode('data')}>
            Data
          </button>
          <button type="button" aria-pressed={tableMode === 'empty'} onClick={() => setTableMode('empty')}>
            Empty
          </button>
          <button type="button" aria-pressed={tableMode === 'loading'} onClick={() => setTableMode('loading')}>
            Loading
          </button>
          <button type="button" aria-pressed={tableMode === 'error'} onClick={() => setTableMode('error')}>
            Error
          </button>
        </div>
      </div>

      {tableMode === 'error' ? (
        <div className="mb-4">
          <DsAlert tone="danger">
            {t('errorState')}{' '}
            <button type="button" className="underline" onClick={() => setTableMode('data')}>
              {t('retry')}
            </button>
          </DsAlert>
        </div>
      ) : (
        <div className="ds-table-wrap mb-3">
          <table className="ds-table">
            <thead>
              <tr>
                <th>{t('tableGym')}</th>
                <th>{t('tableLicense')}</th>
                <th>{t('tableStatus')}</th>
                <th>{t('tableInstall')}</th>
                <th>{t('tableUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {tableMode === 'loading'
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j}>
                          <span className="ds-skeleton" aria-hidden />
                        </td>
                      ))}
                    </tr>
                  ))
                : tableMode === 'empty' || rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="ds-empty">
                          <strong>{t('emptyTitle')}</strong>
                          {t('emptyHint')}
                        </div>
                      </td>
                    </tr>
                    )
                  : rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="font-semibold">{locale === 'ar' ? row.gymAr : row.gymEn}</div>
                          <div className="text-[11px] text-[var(--ds-text-muted)] ds-ltr-isolate">{row.id}</div>
                        </td>
                        <td>{row.license}</td>
                        <td>
                          <DsBadge tone={statusTone(row.status)}>{statusLabel(row.status, t)}</DsBadge>
                        </td>
                        <td>{locale === 'ar' ? row.installAr : row.installEn}</td>
                        <td>
                          <span className="ds-ltr-isolate">{row.updated}</span>
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-[var(--ds-text-muted)]">{t('pagination')}</span>
        <div className="flex gap-2">
          <DsButton size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(1)}>
            {t('prev')}
          </DsButton>
          <DsButton size="sm" variant="secondary" disabled onClick={() => setPage(2)}>
            {t('next')}
          </DsButton>
        </div>
      </div>

      <div className="grid gap-3 mb-4">
        <DsAlert tone="success">{t('alertOk')}</DsAlert>
        <DsAlert tone="warning">{t('alertWarn')}</DsAlert>
        <DsAlert tone="danger">{t('alertErr')}</DsAlert>
        <DsAlert tone="info">{t('alertInfo')}</DsAlert>
      </div>

      <div className="ds-card">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="m-0">{t('timelineTitle')}</h3>
          <Tooltip label={t('tooltip')}>
            <button type="button" className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm" aria-label={t('tooltip')}>
              <Info size={14} />
            </button>
          </Tooltip>
        </div>
        <div className="ds-timeline">
          {[t('time1'), t('time2'), t('time3')].map((item, i) => (
            <div className="ds-timeline-item" key={item}>
              <span className="ds-timeline-dot" />
              <div className="font-semibold text-[13px]">{item}</div>
              <div className="text-[12px] text-[var(--ds-text-muted)] ds-ltr-isolate">16 Sep 2026 · 0{8 + i}:14</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
