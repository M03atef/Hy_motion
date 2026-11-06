import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  applyDsDocument,
  DsButton,
  LogoLockup,
  ToastStack,
  type DsLocale,
} from '@/design-system'
import { ImpersonationSessionBanner } from '@/components/ImpersonationSessionBanner'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { ocNavActive, visibleOcNav } from './nav'
import './oc.css'
import { useOcThemeStore } from './theme-store'
import { useOcCopy } from './useOcCopy'

export function OcShell() {
  const rootRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const locale = useUiStore((s) => s.locale) as DsLocale
  const toggleLocale = useUiStore((s) => s.toggleLocale)
  const theme = useOcThemeStore((s) => s.theme)
  const setTheme = useOcThemeStore((s) => s.setTheme)
  const t = useOcCopy()
  const items = visibleOcNav(user?.role)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useLayoutEffect(() => {
    if (rootRef.current) applyDsDocument(theme, locale, rootRef.current)
  }, [theme, locale])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const crumb =
    items.find((item) => ocNavActive(location.pathname, item.path))?.labelKey ?? 'nav.overview'

  return (
    <div ref={rootRef} data-oc data-theme={theme} className="oc-root">
      <ImpersonationSessionBanner />
      <div className={`ds-oc${collapsed ? ' is-collapsed' : ''}`}>
        {mobileOpen ? (
          <button type="button" className="oc-backdrop" aria-label={t('nav.close')} onClick={() => setMobileOpen(false)} />
        ) : null}
        <aside className={`ds-oc-sidebar${mobileOpen ? ' is-open' : ''}`}>
          <div className="ds-oc-brand">
            <LogoLockup compact={collapsed} />
          </div>
          <nav className="ds-oc-nav" aria-label={t('shell.product')}>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/oc'}
                  aria-current={ocNavActive(location.pathname, item.path) ? 'page' : undefined}
                >
                  <Icon size={16} aria-hidden />
                  <span className="oc-nav-label">{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="oc-session">
            <div className="oc-session-name">{user?.fullName ?? '—'}</div>
            <div className="oc-session-role oc-mono">{user?.role ?? ''}</div>
            <DsButton variant="ghost" size="sm" onClick={logout}>
              {t('shell.logout')}
            </DsButton>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="ds-oc-top">
            <DsButton
              variant="ghost"
              size="sm"
              className="oc-mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.menu')}
            >
              {t('nav.menu')}
            </DsButton>
            <DsButton
              variant="ghost"
              size="sm"
              className="oc-desktop-only"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
            >
              {collapsed ? t('shell.expand') : t('shell.collapse')}
            </DsButton>
            <div className="oc-top-grow">
              <div className="ds-crumbs">
                <span>{t('shell.product')}</span>
                <span aria-hidden>/</span>
                <strong>{t(crumb)}</strong>
              </div>
            </div>
            <div className="ds-segment" role="group" aria-label={t('shell.theme')}>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                {t('shell.dark')}
              </button>
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                {t('shell.light')}
              </button>
            </div>
            <div className="ds-segment" role="group" aria-label={t('shell.locale')}>
              <button type="button" aria-pressed={locale === 'en'} onClick={() => locale === 'ar' && toggleLocale()}>
                EN
              </button>
              <button type="button" aria-pressed={locale === 'ar'} onClick={() => locale === 'en' && toggleLocale()}>
                AR
              </button>
            </div>
          </div>
          <main className="oc-main">
            <Outlet />
          </main>
          <OcToast />
        </div>
      </div>
    </div>
  )
}

function OcToast() {
  const toast = useUiStore((s) => s.toast)
  const clearToast = useUiStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => clearToast(), toast.durationMs ?? 4000)
    return () => window.clearTimeout(id)
  }, [toast, clearToast])

  if (!toast) return null
  return (
    <ToastStack
      toasts={[{ id: 1, tone: toast.tone === 'error' ? 'danger' : 'success', message: toast.message }]}
    />
  )
}
