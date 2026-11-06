import { Activity, Building2, LifeBuoy } from 'lucide-react'
import { usePreview } from '../preview-context'
import { LogoMark, Wordmark } from '../components/Logo'

function Swatch({ token, label }: { token: string; label: string }) {
  const { theme } = usePreview()
  const value =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return (
    <div className="ds-swatch">
      <div className="ds-swatch-chip" style={{ background: `var(${token})` }} />
      <div>
        <span className="ds-token-name">{label}</span>
        <code className="ds-token ds-ltr-isolate" key={theme}>
          {token} · {value || '—'}
        </code>
      </div>
    </div>
  )
}

function SpaceChip({ token, px }: { token: string; px: string }) {
  return (
    <div className="text-center">
      <div className="bg-[var(--ds-accent)] rounded-[2px]" style={{ width: px, height: px }} />
      <div className="ds-token-name mt-2">{token}</div>
      <code className="ds-token">{px}</code>
    </div>
  )
}

export function FoundationsSection() {
  const { t, theme } = usePreview()
  return (
    <section id="foundations" className="ds-section">
      <p className="ds-section-kicker">A</p>
      <h2 className="ds-section-title">{t('foundationsTitle')}</h2>
      <p className="ds-section-lead">{t('foundationsLead')}</p>

      <div className="ds-card mb-4">
        <h3>{t('logoTitle')}</h3>
        <p className="ds-section-lead mb-4">{t('logoLead')}</p>
        <div className="grid gap-4 md:grid-cols-4">
          <figure className="m-0 rounded-[var(--ds-radius-lg)] bg-[var(--ds-brand-charcoal)] p-4">
            <img src="/ds/hymotion-logo.png" alt="HyMotion" className="mx-auto max-h-28 object-contain" />
            <figcaption className="mt-3 text-center text-[11px] text-[#b0b0b0]">{t('logoFull')}</figcaption>
          </figure>
          <figure className="m-0 rounded-[var(--ds-radius-lg)] bg-[var(--ds-brand-charcoal)] p-4 grid place-items-center">
            <img src="/ds/hymotion-mark.png" alt="" className="h-16 w-16 object-contain" />
            <figcaption className="mt-3 text-center text-[11px] text-[#b0b0b0]">{t('logoMark')}</figcaption>
          </figure>
          <figure className="m-0 flex flex-col items-center justify-center gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
            <LogoMark size={48} />
            <figcaption className="text-center text-[11px] text-[var(--ds-text-muted)]">{t('logoTile')}</figcaption>
          </figure>
          <figure className="m-0 flex flex-col items-center justify-center gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
            <Wordmark className="text-2xl" />
            <figcaption className="text-center text-[11px] text-[var(--ds-text-muted)]">{t('logoWordmark')}</figcaption>
          </figure>
        </div>
      </div>

      <div className="ds-card mb-4">
        <h3>{t('brandColors')}</h3>
        <p className="text-[12px] text-[var(--ds-text-muted)] mb-3">{t('brandNote')}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Swatch token="--ds-charcoal-900" label="Charcoal 900" />
          <Swatch token="--ds-lime-500" label="Lime 500 · primary" />
          <Swatch token="--ds-lime-600" label="Lime 600 · hover / text" />
          <Swatch token="--ds-teal-500" label="Teal 500 · secondary" />
        </div>
      </div>

      <div className="ds-card mb-4">
        <h3>
          {t('neutrals')} · {theme}
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Swatch token="--ds-bg-canvas" label="Page background" />
          <Swatch token="--ds-bg-sidebar" label="Sidebar" />
          <Swatch token="--ds-surface" label="Surface / card" />
          <Swatch token="--ds-surface-2" label="Surface 2" />
          <Swatch token="--ds-border" label="Border" />
          <Swatch token="--ds-text" label="Text" />
          <Swatch token="--ds-text-muted" label="Muted text" />
          <Swatch token="--ds-bg-input" label="Input fill" />
        </div>
      </div>

      <div className="ds-card mb-4">
        <h3>{t('semantic')}</h3>
        <p className="text-[12px] text-[var(--ds-text-muted)] mb-3">{t('semanticNote')}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Swatch token="--ds-status-success" label="Success" />
          <Swatch token="--ds-status-warning" label="Warning" />
          <Swatch token="--ds-status-danger" label="Danger" />
          <Swatch token="--ds-status-info" label="Info · teal" />
        </div>
      </div>

      <div className="ds-card mb-4">
        <h3>{t('textColors')}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] p-4">
            <div className="text-[var(--ds-text)] font-semibold">{t('onSurface')}</div>
            <code className="ds-token">--ds-text on --ds-surface</code>
          </div>
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] p-4">
            <div className="text-[var(--ds-text-muted)]">{t('mutedOnSurface')}</div>
            <code className="ds-token">--ds-text-muted</code>
          </div>
          <div className="rounded-[var(--ds-radius-md)] p-4" style={{ background: 'var(--ds-action)', color: 'var(--ds-action-fg)' }}>
            <div className="font-semibold">{t('onAccent')}</div>
            <code className="ds-token" style={{ color: 'var(--ds-action-fg)' }}>
              --ds-action-fg on --ds-action
            </code>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="ds-card">
          <h3>{t('spacing')}</h3>
          <div className="ds-space-demo">
            <SpaceChip token="--ds-space-1" px="4px" />
            <SpaceChip token="--ds-space-2" px="8px" />
            <SpaceChip token="--ds-space-3" px="12px" />
            <SpaceChip token="--ds-space-4" px="16px" />
            <SpaceChip token="--ds-space-6" px="24px" />
            <SpaceChip token="--ds-space-8" px="32px" />
          </div>
        </div>
        <div className="ds-card">
          <h3>{t('radius')}</h3>
          <div className="ds-radius-demo">
            {[
              ['--ds-radius-sm', '4px'],
              ['--ds-radius-md', '6px'],
              ['--ds-radius-lg', '8px'],
              ['--ds-radius-xl', '12px'],
            ].map(([token, px]) => (
              <div key={token} className="text-center">
                <div className="h-12 w-16 bg-[var(--ds-surface-3)] border border-[var(--ds-border-strong)]" style={{ borderRadius: px }} />
                <div className="ds-token-name mt-2">{token}</div>
                <code className="ds-token">{px}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="ds-card">
          <h3>{t('elevation')}</h3>
          <p className="text-[12px] text-[var(--ds-text-muted)] mb-3">{t('elevationNote')}</p>
          <div className="flex flex-wrap gap-3">
            <div className="h-16 w-28 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] grid place-items-center text-[11px]">
              border
            </div>
            <div className="h-16 w-28 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface)] grid place-items-center text-[11px]" style={{ boxShadow: 'var(--ds-shadow-sm)' }}>
              shadow-sm
            </div>
            <div className="h-16 w-28 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface)] grid place-items-center text-[11px]" style={{ boxShadow: 'var(--ds-shadow-md)' }}>
              shadow-md
            </div>
          </div>
        </div>
        <div className="ds-card">
          <h3>{t('icons')}</h3>
          <div className="ds-icon-row">
            <span className="flex flex-col items-center gap-1 text-[11px] text-[var(--ds-text-muted)]">
              <Building2 size={14} /> 14 · sm
            </span>
            <span className="flex flex-col items-center gap-1 text-[11px] text-[var(--ds-text-muted)]">
              <Building2 size={16} /> 16 · md
            </span>
            <span className="flex flex-col items-center gap-1 text-[11px] text-[var(--ds-text-muted)]">
              <LifeBuoy size={20} /> 20 · lg
            </span>
            <span className="flex flex-col items-center gap-1 text-[11px] text-[var(--ds-text-muted)]">
              <Activity size={24} /> 24 · xl
            </span>
          </div>
        </div>
      </div>

      <div className="ds-card">
        <h3>{t('responsive')}</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-strong)] p-3 text-[12px]">
            Desktop · 1280+ · sidebar + main
          </div>
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-strong)] p-3 text-[12px]">
            Tablet · 768 · stacked chrome, tables scroll
          </div>
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-strong)] p-3 text-[12px]">
            Mobile · 390 · overlay nav, 44px controls
          </div>
        </div>
      </div>
    </section>
  )
}

export function ThemeSection() {
  const { t, theme } = usePreview()
  return (
    <section id="theme" className="ds-section">
      <p className="ds-section-kicker">B</p>
      <h2 className="ds-section-title">{t('themeTitle')}</h2>
      <p className="ds-section-lead">{t('themeLead')}</p>
      <div className="ds-card mb-4">
        <p className="m-0 text-[13px] text-[var(--ds-text-muted)]">
          Active theme: <strong className="text-[var(--ds-text)]">{theme}</strong>. Switch in the toolbar. Surfaces below are live tokens, not an invert filter.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--ds-radius-lg)] p-3" style={{ background: 'var(--ds-bg)', border: '1px solid var(--ds-border)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ds-text-muted)] mb-2">Page background</div>
          <code className="ds-token">--ds-bg</code>
        </div>
        <div className="rounded-[var(--ds-radius-lg)] p-3" style={{ background: 'var(--ds-bg-sidebar)', border: '1px solid var(--ds-border)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ds-sidebar-text)] mb-2">Sidebar</div>
          <code className="ds-token">--ds-bg-sidebar / --ds-sidebar-text</code>
        </div>
        <div className="rounded-[var(--ds-radius-lg)] p-3 ds-card">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ds-text-muted)] mb-2">Surface / card</div>
          <p className="m-0 text-[13px]">{t('bodySample').slice(0, 88)}…</p>
        </div>
        <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ds-text-muted)] mb-2">Input / table / badge / dialog</div>
          <input className="ds-input mb-2" readOnly value="ops@sample.invalid" />
          <div className="ds-table-wrap mb-2">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('tableGym')}</th>
                  <th>{t('tableStatus')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('sampleGymArName')}</td>
                  <td>
                    <span className="ds-badge ds-badge--success">
                      <span className="ds-badge-dot" />
                      {t('statusActive')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3 text-[13px] shadow-[var(--ds-shadow-md)]">
            {t('confirmTitle')}
          </div>
        </div>
      </div>
    </section>
  )
}

export function TypographySection() {
  const { t } = usePreview()
  return (
    <section id="typography" className="ds-section">
      <p className="ds-section-kicker">C</p>
      <h2 className="ds-section-title">{t('typeTitle')}</h2>
      <p className="ds-section-lead">{t('typeLead')}</p>
      <div className="ds-card">
        {[
          ['display', t('displaySample'), '32 / 700 / 1.2 · --ds-fs-display'],
          ['pageTitle', t('pageTitleSample'), '22 / 700 · --ds-fs-title'],
          ['sectionHead', t('sectionSample'), '16 / 600 · --ds-fs-section'],
          ['body', t('bodySample'), '14 / 400 / 1.5 · --ds-fs-body'],
          ['secondaryType', t('secondarySample'), '13 / 400 · --ds-text-muted'],
          ['labels', t('labelSample'), '13 / 600 · --ds-fs-label'],
          ['captions', t('captionSample'), '12 / 400 · --ds-fs-caption'],
          ['numeric', t('metricSample'), '28 / 700 tabular · --ds-fs-metric'],
        ].map(([key, sample, meta]) => (
          <div className="ds-type-row" key={key}>
            <div>
              <div className="text-[12px] font-semibold">{t(key as 'display')}</div>
              <div className="ds-type-meta">{meta}</div>
            </div>
            <div
              style={
                key === 'display'
                  ? { fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em' }
                  : key === 'pageTitle'
                    ? { fontSize: 22, fontWeight: 700 }
                    : key === 'sectionHead'
                      ? { fontSize: 16, fontWeight: 600 }
                      : key === 'secondaryType'
                        ? { color: 'var(--ds-text-muted)', fontSize: 13 }
                        : key === 'labels'
                          ? { fontWeight: 600, fontSize: 13 }
                          : key === 'captions'
                            ? { fontSize: 12, color: 'var(--ds-text-muted)' }
                            : key === 'numeric'
                              ? { fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }
                              : undefined
              }
            >
              {key === 'numeric' ? <span className="ds-ltr-isolate">{sample}</span> : sample}
            </div>
          </div>
        ))}
        <div className="ds-type-row">
          <div>
            <div className="text-[12px] font-semibold">{t('tableType')}</div>
            <div className="ds-type-meta">13 / 400 · thead 11 / 700 uppercase</div>
          </div>
          <div className="text-[13px]">
            Nile Athletics <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ds-text-muted)]"> · {t('tableLicense')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
