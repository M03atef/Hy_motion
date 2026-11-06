import { useState } from 'react'
import {
  Building2,
  ChevronRight,
  ClipboardList,
  HardDrive,
  LifeBuoy,
  PanelLeft,
  Shield,
  Users,
} from 'lucide-react'
import { DsBadge, DsButton } from '../components/Button'
import { ActionMenu } from '../components/overlays'
import { LogoLockup } from '../components/Logo'
import { SAMPLE_INSTALLS, SAMPLE_TICKETS } from '../sample-data'
import { usePreview } from '../preview-context'
import type { CopyKey } from '../i18n'

const NAV: { key: CopyKey; icon: typeof Building2 }[] = [
  { key: 'gyms', icon: Building2 },
  { key: 'licenses', icon: ClipboardList },
  { key: 'installs', icon: HardDrive },
  { key: 'support', icon: LifeBuoy },
  { key: 'backups', icon: HardDrive },
  { key: 'admins', icon: Users },
  { key: 'audit', icon: Shield },
]

export function NavigationSection() {
  const { t } = usePreview()
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState<CopyKey>('gyms')
  const [userOpen, setUserOpen] = useState(false)

  return (
    <section id="navigation" className="ds-section">
      <p className="ds-section-kicker">H</p>
      <h2 className="ds-section-title">{t('navTitle')}</h2>
      <p className="ds-section-lead">{t('navLead')}</p>

      <div className={`ds-oc ${collapsed ? 'is-collapsed' : ''}`}>
        <aside className="ds-oc-sidebar">
          <div className="ds-oc-brand">
            <LogoLockup compact={collapsed} />
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm ms-auto"
              aria-label={collapsed ? t('expand') : t('collapse')}
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeft size={16} />
            </button>
          </div>
          <nav className="ds-oc-nav" aria-label={t('navTitle')}>
            {NAV.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active === item.key ? 'page' : undefined}
                  title={t(item.key)}
                  onClick={() => setActive(item.key)}
                >
                  <Icon size={16} aria-hidden />
                  {collapsed ? null : <span className="truncate">{t(item.key)}</span>}
                </button>
              )
            })}
          </nav>
        </aside>
        <div className="min-w-0 bg-[var(--ds-bg)]">
          <div className="ds-oc-top">
            <nav className="ds-crumbs" aria-label="Breadcrumb">
              <span>{t('crumbsHome')}</span>
              <ChevronRight size={12} className="ds-directional" aria-hidden />
              <strong>{t(active)}</strong>
            </nav>
            <div className="ms-auto relative">
              <DsButton
                variant="ghost"
                size="sm"
                aria-expanded={userOpen}
                onClick={() => setUserOpen((v) => !v)}
              >
                {t('userMenu')}
              </DsButton>
              <ActionMenu open={userOpen} onClose={() => setUserOpen(false)}>
                <button type="button" role="menuitem" onClick={() => setUserOpen(false)}>
                  {t('signOut')}
                </button>
              </ActionMenu>
            </div>
          </div>
          <div className="p-4">
            <div className="ds-page-head">
              <div>
                <h2>{t(active)}</h2>
                <p>{t('navLead')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DsButton size="sm" variant="secondary">
                  {t('secondary')}
                </DsButton>
                <DsButton size="sm">{t('primary')}</DsButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function CompositionSection() {
  const { t, locale } = usePreview()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <section id="composition" className="ds-section">
      <p className="ds-section-kicker">I</p>
      <h2 className="ds-section-title">{t('compositionTitle')}</h2>
      <p className="ds-section-lead">{t('compositionLead')}</p>

      <div className={`ds-oc ${collapsed ? 'is-collapsed' : ''}`}>
        <aside className="ds-oc-sidebar">
          <div className="ds-oc-brand">
            <LogoLockup compact={collapsed} />
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm ms-auto"
              aria-label={collapsed ? t('expand') : t('collapse')}
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeft size={16} />
            </button>
          </div>
          <nav className="ds-oc-nav" aria-label={t('compositionTitle')}>
            {NAV.map((item) => {
              const Icon = item.icon
              const current = item.key === 'gyms'
              return (
                <button key={item.key} type="button" aria-current={current ? 'page' : undefined} title={t(item.key)}>
                  <Icon size={16} aria-hidden />
                  {collapsed ? null : <span className="truncate">{t(item.key)}</span>}
                </button>
              )
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <div className="ds-oc-top">
            <nav className="ds-crumbs" aria-label="Breadcrumb">
              <span>{t('crumbsHome')}</span>
              <ChevronRight size={12} className="ds-directional" aria-hidden />
              <span>{t('gyms')}</span>
              <ChevronRight size={12} className="ds-directional" aria-hidden />
              <strong>{t('sampleGym')}</strong>
            </nav>
          </div>
          <div className="p-4">
            <div className="ds-page-head">
              <div>
                <h2>{t('sampleGym')}</h2>
                <p>
                  {t('sampleGymArName')} · {t('workspaceSub')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DsButton size="sm" variant="secondary">
                  {t('openTicket')}
                </DsButton>
                <DsButton size="sm">{t('issueLicense')}</DsButton>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div className="ds-card ds-metric">
                <span className="ds-metric-label">{t('metricLicenses')}</span>
                <span className="ds-metric-value ds-ltr-isolate">1</span>
                <DsBadge tone="success">{t('statusActive')}</DsBadge>
              </div>
              <div className="ds-card ds-metric">
                <span className="ds-metric-label">{t('metricOpen')}</span>
                <span className="ds-metric-value ds-ltr-isolate">2</span>
                <DsBadge tone="warning">{t('statusPending')}</DsBadge>
              </div>
              <div className="ds-card ds-metric">
                <span className="ds-metric-label">{t('mixed')}</span>
                <span className="ds-metric-hint ds-ltr-isolate">HM-2041</span>
              </div>
            </div>

            <div className="ds-table-wrap mb-4">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>{t('tableGym')}</th>
                    <th>{t('tableLicense')}</th>
                    <th>{t('tableStatus')}</th>
                    <th>{t('tableInstall')}</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_INSTALLS.slice(0, 3).map((row) => (
                    <tr key={row.id}>
                      <td>{locale === 'ar' ? row.gymAr : row.gymEn}</td>
                      <td className="ds-ltr-isolate">{row.id}</td>
                      <td>
                        <DsBadge tone={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'danger' : 'warning'}>
                          {row.status === 'active' ? t('statusActive') : row.status === 'suspended' ? t('statusSuspended') : t('statusExpiring')}
                        </DsBadge>
                      </td>
                      <td>{locale === 'ar' ? row.installAr : row.installEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ds-card">
              <h3>{t('support')}</h3>
              <ul className="m-0 flex flex-col gap-2 p-0 list-none">
                {SAMPLE_TICKETS.map((ticket) => (
                  <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span>
                      <span className="ds-ltr-isolate font-semibold">{ticket.id}</span>
                      {' · '}
                      {locale === 'ar' ? ticket.topicAr : ticket.topicEn}
                    </span>
                    <DsBadge tone={ticket.tone}>{locale === 'ar' ? ticket.gymAr : ticket.gymEn}</DsBadge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
