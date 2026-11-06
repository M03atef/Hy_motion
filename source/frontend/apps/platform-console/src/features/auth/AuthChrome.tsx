import { useLayoutEffect, type ReactNode } from 'react'
import { applyDsDocument, LogoLockup, type DsLocale } from '@/design-system'
import { useUiStore } from '@/stores/ui-store'
import './auth-chrome.css'

/** Shared HyMotion identity for Login / MFA — same tokens as OcShell, no dual-product strip. */
export function AuthChrome({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const locale = useUiStore((s) => s.locale) as DsLocale

  useLayoutEffect(() => {
    applyDsDocument('dark', locale)
    return () => {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.removeAttribute('data-locale')
    }
  }, [locale])

  return (
    <div className="hm-auth" data-theme="dark" data-auth>
      <main className="hm-auth__main">
        <div className="hm-auth__brand">
          <LogoLockup />
        </div>
        <div className="hm-auth__header">
          <h1 className="hm-auth__title">{title}</h1>
          {subtitle ? <p className="hm-auth__subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  )
}
