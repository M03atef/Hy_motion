import { useEffect, useState } from 'react'
import { usePreview } from './preview-context'
import { LogoMark, Wordmark } from './components/Logo'
import { ToastStack, type ToastItem } from './components/overlays'
import { FoundationsSection, ThemeSection, TypographySection } from './sections/FoundationsSection'
import { ButtonsSection } from './sections/ButtonsSection'
import { FormsSection } from './sections/FormsSection'
import { DataSection } from './sections/DataSection'
import { OverlaysSection } from './sections/OverlaysSection'
import { CompositionSection, NavigationSection } from './sections/NavigationSection'
import { UxReviewSection } from './sections/UxReviewSection'
import type { CopyKey } from './i18n'

const SECTIONS: { id: string; key: CopyKey }[] = [
  { id: 'foundations', key: 'navA' },
  { id: 'theme', key: 'navB' },
  { id: 'typography', key: 'navC' },
  { id: 'buttons', key: 'navD' },
  { id: 'forms', key: 'navE' },
  { id: 'data', key: 'navF' },
  { id: 'overlays', key: 'navG' },
  { id: 'navigation', key: 'navH' },
  { id: 'composition', key: 'navI' },
  { id: 'review', key: 'navJ' },
]

export function DesignSystemApp() {
  const { t, theme, setTheme, locale, setLocale, viewport, setViewport } = usePreview()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash.slice(1) : ''))

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function pushToast(message: string, tone: 'success' | 'danger' = 'success') {
    const id = Date.now()
    setToasts((list) => [...list, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((list) => list.filter((item) => item.id !== id))
    }, 3200)
  }

  return (
    <div className="ds-app">
      <a className="ds-skip" href="#ds-content">
        {t('skip')}
      </a>
      <div className="ds-banner" role="note">
        <span>{t('banner')}</span>
        <span className="ds-ltr-isolate">{t('phase')}</span>
      </div>
      <header className="ds-toolbar">
        <div className="ds-toolbar-brand">
          <LogoMark size={32} />
          <div className="min-w-0">
            <div className="ds-toolbar-title">
              <Wordmark className="text-[14px]" /> {t('preview')}
            </div>
            <div className="ds-toolbar-sub">{t('product')}</div>
          </div>
        </div>

        <div className="ds-segment" role="group" aria-label={t('theme')}>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            {t('dark')}
          </button>
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
            {t('light')}
          </button>
        </div>
        <div className="ds-segment" role="group" aria-label={t('language')}>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
            {t('english')}
          </button>
          <button type="button" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')}>
            {t('arabic')}
          </button>
        </div>
        <div className="ds-segment" role="group" aria-label={t('viewport')}>
          <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
            {t('desktop')}
          </button>
          <button type="button" aria-pressed={viewport === 'tablet'} onClick={() => setViewport('tablet')}>
            {t('tablet')}
          </button>
          <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
            {t('mobile')}
          </button>
        </div>
      </header>

      <div className="ds-shell">
        <nav className="ds-sidenav" aria-label={t('preview')}>
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} aria-current={hash === section.id || undefined}>
              {t(section.key)}
            </a>
          ))}
        </nav>
        <div className="ds-main">
          <div id="ds-content" className="ds-frame" data-viewport={viewport}>
            <FoundationsSection />
            <ThemeSection />
            <TypographySection />
            <ButtonsSection onToast={pushToast} />
            <FormsSection />
            <DataSection />
            <OverlaysSection onToast={pushToast} />
            <NavigationSection />
            <CompositionSection />
            <UxReviewSection />
          </div>
        </div>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  )
}
