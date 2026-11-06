import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, filterPlaybooks } from './catalog'
import { tx } from './i18n'
import { CATEGORY_ICONS, riskClass } from './labels'
import { usePlaybookProgress } from './progress-store'
import type { PlaybookCategory, RiskLevel } from './types'
import { useUiStore } from '@/stores/ui-store'

const RISKS: RiskLevel[] = ['safe', 'admin', 'destructive', 'support_only']

export function OpsPlaybookPage() {
  const t = useUiStore((s) => s.t)
  const locale = useUiStore((s) => s.locale)
  const theme = usePlaybookProgress((s) => s.theme)
  const setTheme = usePlaybookProgress((s) => s.setTheme)
  const audience = usePlaybookProgress((s) => s.audience)
  const setAudience = usePlaybookProgress((s) => s.setAudience)
  const byId = usePlaybookProgress((s) => s.byId)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PlaybookCategory | ''>('')
  const [risk, setRisk] = useState<RiskLevel | ''>('')
  const [showMore, setShowMore] = useState(false)

  const rows = useMemo(
    () =>
      filterPlaybooks({
        query,
        category,
        risk,
        audience: audience === 'customer' ? 'customer' : '',
      }),
    [query, category, risk, audience],
  )

  return (
    <div className="ops-playbook" data-ops-theme={theme}>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{t('ops.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{t('ops.subtitleSimple')}</p>
      </header>

      <div className="ops-who" role="group" aria-label={t('ops.chooseWho')}>
        <p className="ops-who-label">{t('ops.chooseWho')}</p>
        <div className="ops-who-row">
          <button
            type="button"
            className={`ops-who-btn${audience === 'customer' ? ' is-on' : ''}`}
            onClick={() => setAudience('customer')}
          >
            <span className="ops-who-n">1</span>
            <span>
              <strong>{t('ops.iAmGym')}</strong>
              <span className="ops-who-hint">{t('ops.iAmGymHint')}</span>
            </span>
          </button>
          <button
            type="button"
            className={`ops-who-btn${audience === 'support' ? ' is-on' : ''}`}
            onClick={() => setAudience('support')}
          >
            <span className="ops-who-n">2</span>
            <span>
              <strong>{t('ops.iAmTeam')}</strong>
              <span className="ops-who-hint">{t('ops.iAmTeamHint')}</span>
            </span>
          </button>
        </div>
      </div>

      <p className="ops-banner mb-4" role="note">
        {t(audience === 'customer' ? 'ops.noFakeRunGym' : 'ops.noFakeRun')}
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-xs font-semibold text-[var(--text-muted)]">
          {t('common.search')}
          <input
            className="cp-input mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ops.searchPhSimple')}
          />
        </label>
        {audience === 'support' ? (
          <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowMore((v) => !v)}>
            {showMore ? t('ops.hideFilters') : t('ops.moreFilters')}
          </button>
        ) : null}
        <button type="button" className="cp-btn cp-btn-ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? t('ops.themeDark') : t('ops.themeLight')}
        </button>
      </div>

      {audience === 'support' && showMore ? (
        <div className="mb-4 grid gap-2 md:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            {t('ops.filterCategory')}
            <select className="cp-input mt-1" value={category} onChange={(e) => setCategory(e.target.value as PlaybookCategory | '')}>
              <option value="">{t('ops.all')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`ops.cat.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            {t('ops.filterRisk')}
            <select className="cp-input mt-1" value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | '')}>
              <option value="">{t('ops.all')}</option>
              {RISKS.map((r) => (
                <option key={r} value={r}>
                  {t(`ops.risk.${r}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="cp-card p-8 text-center text-sm text-[var(--text-muted)]">{t('common.noResults')}</div>
      ) : (
        <div className="ops-guide-grid">
          {rows.map((p) => {
            const Icon = CATEGORY_ICONS[p.category]
            const visible = audience === 'customer' ? p.steps.filter((s) => s.audience !== 'support') : p.steps
            const done = visible.filter((s) => byId[p.id]?.steps[s.id] === 'completed').length
            return (
              <Link key={p.id} to={`/ops-playbooks/${p.id}`} className="ops-guide-card">
                <span className="ops-guide-ico" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </span>
                <div className="ops-guide-body">
                  {audience === 'support' ? (
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="ops-badge ops-badge-cat">{t(`ops.cat.${p.category}`)}</span>
                      <span className={riskClass(p.risk)}>{t(`ops.risk.${p.risk}`)}</span>
                    </div>
                  ) : null}
                  <h2>{tx(locale, p.title)}</h2>
                  <p>{tx(locale, p.whenToUse)}</p>
                  <div className="ops-guide-foot">
                    <span>
                      {done}/{visible.length} {t('ops.progressDone')}
                    </span>
                    <span className="ops-guide-open">{t('ops.openGuide')}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
