import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CommandBlock } from './CommandBlock'
import { getPlaybook } from './catalog'
import { tx } from './i18n'
import { CATEGORY_ICONS, riskClass, statusClass, STEP_STATUSES, whoTone } from './labels'
import { EMPTY_PROGRESS, usePlaybookProgress } from './progress-store'
import { clampStep, firstIncompleteIndex } from './step-nav'
import type { PlaybookStep, StepStatus } from './types'
import { useUiStore } from '@/stores/ui-store'

export function OpsPlaybookDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const playbook = getPlaybook(id)
  const t = useUiStore((s) => s.t)
  const locale = useUiStore((s) => s.locale)
  const theme = usePlaybookProgress((s) => s.theme)
  const setTheme = usePlaybookProgress((s) => s.setTheme)
  const audience = usePlaybookProgress((s) => s.audience)
  const setAudience = usePlaybookProgress((s) => s.setAudience)
  const progress = usePlaybookProgress((s) => s.byId[id] ?? EMPTY_PROGRESS)
  const setStepStatus = usePlaybookProgress((s) => s.setStepStatus)
  const setCaseStatus = usePlaybookProgress((s) => s.setCaseStatus)
  const toggleClosure = usePlaybookProgress((s) => s.toggleClosure)
  const reset = usePlaybookProgress((s) => s.reset)
  const gymView = audience === 'customer'
  const showCommands = !gymView

  const failFocus = params.get('failure')
  const [cursor, setCursor] = useState(0)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!failFocus) return
    const el = document.getElementById(`failure-${failFocus}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [failFocus, playbook])

  const visibleSteps = useMemo(() => {
    if (!playbook) return [] as { step: PlaybookStep; n: number }[]
    let n = 0
    const out: { step: PlaybookStep; n: number }[] = []
    for (const step of playbook.steps) {
      if (gymView && step.audience === 'support') continue
      n += 1
      out.push({ step, n })
    }
    return out
  }, [playbook, gymView])

  const visibleFailures = useMemo(() => {
    if (!playbook) return []
    if (!gymView) return playbook.failures
    return playbook.failures.filter((f) => f.audience !== 'support')
  }, [playbook, gymView])

  useEffect(() => {
    const statuses = visibleSteps.map(({ step }) => progress.steps[step.id])
    setCursor(firstIncompleteIndex(statuses))
    setShowAll(false)
    // Only jump when the playbook or who-you-are changes — not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbook?.id, gymView, visibleSteps.length])

  const commandOffset = useMemo(() => {
    const map = new Map<string, number>()
    let seq = 0
    for (const { step } of visibleSteps) {
      if (!showCommands || !step.commands?.length) continue
      map.set(step.id, seq)
      seq += step.commands.length
    }
    return map
  }, [visibleSteps, showCommands])

  const current = visibleSteps[clampStep(cursor, visibleSteps.length)]
  const Icon = playbook ? CATEGORY_ICONS[playbook.category] : null

  function go(next: number) {
    setCursor(clampStep(next, visibleSteps.length))
    setShowAll(false)
    window.requestAnimationFrame(() => document.getElementById('ops-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function markDone() {
    if (!playbook || !current) return
    setStepStatus(playbook.id, current.step.id, 'completed')
    if (cursor < visibleSteps.length - 1) go(cursor + 1)
  }

  function markHelp() {
    if (!playbook || !current) return
    setStepStatus(playbook.id, current.step.id, gymView ? 'needs_support' : 'needs_customer')
  }

  if (!playbook) {
    return (
      <div className="cp-card p-6">
        <p>{t('errors.notFound')}</p>
        <Link to="/ops-playbooks" className="mt-3 inline-block text-sm">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const closureItems = playbook.closure
  const doneCount = visibleSteps.filter(({ step }) => progress.steps[step.id] === 'completed').length
  const pct = visibleSteps.length ? Math.round((doneCount / visibleSteps.length) * 100) : 0

  return (
    <div className="ops-playbook" data-ops-theme={theme}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="cp-btn cp-btn-ghost" onClick={() => navigate('/ops-playbooks')}>
          {t('common.back')}
        </button>
        <button type="button" className={`cp-btn ${gymView ? 'cp-btn-secondary' : 'cp-btn-ghost'}`} onClick={() => setAudience('customer')}>
          {t('ops.iAmGym')}
        </button>
        <button type="button" className={`cp-btn ${!gymView ? 'cp-btn-secondary' : 'cp-btn-ghost'}`} onClick={() => setAudience('support')}>
          {t('ops.iAmTeam')}
        </button>
        <button type="button" className="cp-btn cp-btn-ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? t('ops.themeDark') : t('ops.themeLight')}
        </button>
        {!gymView ? (
          <button type="button" className="cp-btn cp-btn-ghost" onClick={() => reset(playbook.id)}>
            {t('ops.resetProgress')}
          </button>
        ) : null}
      </div>

      <header className="ops-hero">
        {Icon ? (
          <span className="ops-guide-ico" aria-hidden>
            <Icon size={26} strokeWidth={2} />
          </span>
        ) : null}
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {!gymView ? <span className="ops-badge ops-badge-cat">{t(`ops.cat.${playbook.category}`)}</span> : null}
            {!gymView ? <span className={riskClass(playbook.risk)}>{t(`ops.risk.${playbook.risk}`)}</span> : null}
          </div>
          <h1>{tx(locale, playbook.title)}</h1>
          <p className="ops-hero-sum">{tx(locale, playbook.customerSummary)}</p>
        </div>
      </header>

      {visibleSteps.length ? (
        <div className="ops-progress" aria-label={t('ops.steps')}>
          <div className="ops-progress-meta">
            <strong>
              {t('ops.simpleStep')} {current ? current.n : 0} {t('ops.simpleOf')} {visibleSteps.length}
            </strong>
            <span>
              {doneCount}/{visibleSteps.length} {t('ops.progressDone')} · {pct}%
            </span>
          </div>
          <div className="ops-progress-bar" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="ops-dots">
            {visibleSteps.map(({ step, n }, i) => {
              const st = progress.steps[step.id] ?? 'not_started'
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`ops-dot${i === cursor ? ' is-now' : ''}${st === 'completed' ? ' is-done' : ''}`}
                  onClick={() => go(i)}
                  aria-current={i === cursor ? 'step' : undefined}
                  aria-label={`${t('ops.simpleStep')} ${n}`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {playbook.lifecycle?.length && !gymView ? (
        <ol className="ops-flow mb-4">
          {playbook.lifecycle.map((item, i) => (
            <li key={i}>
              <span className="ops-flow-n">{i + 1}</span>
              <span>{tx(locale, item)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {gymView && visibleSteps.length === 0 ? (
        <div className="cp-card p-6">
          <p className="text-sm font-semibold">{t('ops.teamOnlyGuide')}</p>
          <button type="button" className="cp-btn mt-3" onClick={() => setAudience('support')}>
            {t('ops.iAmTeam')}
          </button>
        </div>
      ) : null}

      {current ? (
        <section id="ops-focus" className={`ops-focus cp-card${progress.steps[current.step.id] === 'completed' ? ' is-done' : ''}`}>
          <StepCard
            n={current.n}
            step={current.step}
            status={progress.steps[current.step.id] ?? 'not_started'}
            gymView={gymView}
            showCommands={showCommands}
            cmdBase={commandOffset.get(current.step.id) ?? 0}
          />
          <div className="ops-focus-actions">
            <button type="button" className="cp-btn cp-btn-secondary" onClick={markHelp}>
              {t('ops.simpleHelp')}
            </button>
            <button type="button" className="cp-btn" onClick={markDone}>
              {t('ops.simpleDone')}
            </button>
          </div>
          <div className="ops-focus-nav">
            <button type="button" className="cp-btn cp-btn-ghost" disabled={cursor === 0} onClick={() => go(cursor - 1)}>
              {t('ops.simplePrev')}
            </button>
            <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('ops.hideAllSteps') : t('ops.showAllSteps')}
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-ghost"
              disabled={cursor >= visibleSteps.length - 1}
              onClick={() => go(cursor + 1)}
            >
              {t('ops.simpleNext')}
            </button>
          </div>
        </section>
      ) : null}

      {showAll ? (
        <ol className="ops-steps mt-4">
          {visibleSteps.map(({ step, n }, i) => (
            <li key={step.id} id={`step-${step.id}`} className={`ops-step cp-card${progress.steps[step.id] === 'completed' ? ' is-done' : ''}`}>
              <div className="ops-step-rail" aria-hidden />
              <div className="p-4">
                <button type="button" className="ops-jump mb-2" onClick={() => go(i)}>
                  {t('ops.simpleStep')} {n}
                </button>
                <StepCard
                  n={n}
                  step={step}
                  status={progress.steps[step.id] ?? 'not_started'}
                  gymView={gymView}
                  showCommands={showCommands}
                  cmdBase={commandOffset.get(step.id) ?? 0}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {playbook.kit?.length && showCommands ? (
        <details className="ops-fold cp-card mb-4">
          <summary>{t('ops.kit')}</summary>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t('ops.kitIntro')}</p>
          <div className="ops-kit mt-3">
            {playbook.kit.map((item) => (
              <article key={item.id} className={`ops-kit-card${item.required ? ' is-req' : ''}${item.hqOnly ? ' is-hq' : ''}`}>
                <div className="ops-kit-top">
                  <span className="ops-path ops-kit-folder" dir="ltr">
                    {item.folder}
                  </span>
                  {item.hqOnly ? (
                    <span className="ops-badge ops-badge-support">{t('ops.kitHq')}</span>
                  ) : item.required ? (
                    <span className="ops-badge ops-badge-admin">{t('ops.kitRequired')}</span>
                  ) : (
                    <span className="ops-badge">{t('ops.kitOptional')}</span>
                  )}
                </div>
                <h3 className="font-semibold">{tx(locale, item.title)}</h3>
                <p className="ops-kit-why">{tx(locale, item.why)}</p>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {!gymView && playbook.preconditions.length ? (
      <details className="ops-fold cp-card mb-4">
        <summary>{t('ops.beforeStart')}</summary>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {t('ops.when')}: {tx(locale, playbook.whenToUse)}
        </p>
        <ol className="ops-plain-list">
          {playbook.preconditions.map((p, i) => (
            <li key={i}>
              <span className="ops-flow-n">{i + 1}</span>
              <span>{tx(locale, p)}</span>
            </li>
          ))}
        </ol>
        {playbook.securityWarnings.length ? (
          <div className="ops-warn mt-3">
            <strong>{t('ops.security')}</strong>
            <ul className="mt-1 list-disc ps-5 text-sm">
              {playbook.securityWarnings.map((w, i) => (
                <li key={i}>{tx(locale, w)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </details>
      ) : null}

      {visibleFailures.length ? (
        <details className="ops-fold cp-card mb-4" open={Boolean(failFocus)}>
          <summary>{t('ops.wrong')}</summary>
          <div className="ops-fail-grid mt-3">
            {visibleFailures.map((f) => (
              <article key={f.id} id={`failure-${f.id}`} className="ops-fail-card">
                <h3>{tx(locale, f.title)}</h3>
                <div className="ops-fail-lanes">
                  <div className="is-stop">
                    <div className="ops-triad-h">{t('ops.stopDont')}</div>
                    <p>{tx(locale, f.doNot)}</p>
                  </div>
                  <div className="is-go">
                    <div className="ops-triad-h">{t('ops.doInstead')}</div>
                    <p>{tx(locale, f.immediate)}</p>
                  </div>
                  <div className="is-say">
                    <div className="ops-triad-h">{t('ops.tellGym')}</div>
                    <p>{tx(locale, f.customerMessage)}</p>
                  </div>
                </div>
                {showCommands ? (
                  <details className="ops-more">
                    <summary>{t('ops.techDetails')}</summary>
                    <p className="mt-2 text-sm">{tx(locale, f.whatHappened)}</p>
                    <p className="mt-1 text-sm">{tx(locale, f.recovery)}</p>
                    {f.tech ? <p className="ops-path mt-2">{tx(locale, f.tech)}</p> : null}
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {!gymView ? (
      <details className="ops-fold cp-card mb-4">
        <summary>{t('ops.closure')}</summary>
        <p className="mb-2 mt-2 text-xs text-[var(--text-muted)]">{t('ops.closureHint')}</p>
        {closureItems.map((item, i) => {
          const cid = `c${i}`
          return (
            <label key={cid} className="flex items-start gap-2 py-1 text-sm">
              <input type="checkbox" checked={!!progress.closure[cid]} onChange={() => toggleClosure(playbook.id, cid)} />
              <span>{tx(locale, item)}</span>
            </label>
          )
        })}
        {!gymView ? (
          <label className="mt-3 block text-xs font-semibold text-[var(--text-muted)]">
            {t('ops.caseStatus')}
            <select
              className="cp-input mt-1 max-w-xs"
              value={progress.caseStatus}
              onChange={(e) => setCaseStatus(playbook.id, e.target.value as StepStatus)}
            >
              {STEP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`ops.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </details>
      ) : null}
    </div>
  )
}

function StepCard({
  n,
  step,
  status,
  gymView,
  showCommands,
  cmdBase,
}: {
  n: number
  step: PlaybookStep
  status: StepStatus
  gymView: boolean
  showCommands: boolean
  cmdBase: number
}) {
  const t = useUiStore((s) => s.t)
  const locale = useUiStore((s) => s.locale)
  const gymDoes = whoTone(step.who) === 'gym'

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="ops-num-lg">{String(n).padStart(2, '0')}</span>
        {!gymView ? (
          <span className={`ops-who-chip${gymDoes ? ' is-gym' : ' is-team'}`}>
            {gymDoes ? t('ops.whoYouGym') : t('ops.whoYouTeam')}
            <span className="ops-who-sub"> · {t(`ops.who.${step.who}`)}</span>
          </span>
        ) : null}
        {!gymView ? <span className={riskClass(step.risk)}>{t(`ops.risk.${step.risk}`)}</span> : null}
        {!gymView && status === 'completed' ? <span className={statusClass(status)}>{t(`ops.status.${status}`)}</span> : null}
      </div>
      <div className="ops-triad">
        <div className="is-do">
          <div className="ops-triad-h">
            <span className="ops-lane-n">1</span> {t('ops.stepDo')}
          </div>
          <p>{tx(locale, step.action)}</p>
        </div>
        <div className="is-see">
          <div className="ops-triad-h">
            <span className="ops-lane-n">2</span> {t('ops.stepSee')}
          </div>
          <p>{tx(locale, step.expected)}</p>
        </div>
        <div className="is-check">
          <div className="ops-triad-h">
            <span className="ops-lane-n">3</span> {t('ops.stepCheck')}
          </div>
          <p>{tx(locale, step.verification)}</p>
        </div>
      </div>
      {step.failurePath && !gymView ? (
        <p className="ops-fail-inline">
          <strong>{t('ops.failurePath')}:</strong> {tx(locale, step.failurePath)}
        </p>
      ) : null}
      {step.tech && showCommands ? (
        <details className="ops-tech">
          <summary className="ops-tech-h">{t('ops.techDetails')}</summary>
          <p className="mt-2">{tx(locale, step.tech)}</p>
        </details>
      ) : null}
      {showCommands && step.commands?.length ? (
        <div className="ops-cmd-list">
          <div className="ops-cmd-list-h">{t('ops.commandsOrdered')}</div>
          {step.commands.map((c, i) => (
            <CommandBlock key={c.id} n={cmdBase + i + 1} label={tx(locale, c.label)} text={c.text} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
