import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DsButton } from '../components/Button'
import { usePreview } from '../preview-context'

export function ButtonsSection({ onToast }: { onToast: (message: string) => void }) {
  const { t } = usePreview()
  const [loading, setLoading] = useState(false)

  function demo(message: string) {
    onToast(message)
  }

  return (
    <section id="buttons" className="ds-section">
      <p className="ds-section-kicker">D</p>
      <h2 className="ds-section-title">{t('buttonsTitle')}</h2>
      <p className="ds-section-lead">{t('buttonsLead')}</p>

      <div className="ds-card mb-4">
        <h3>{t('states')}</h3>
        <div className="flex flex-wrap gap-2">
          <DsButton onClick={() => demo(t('clicked'))}>{t('primary')}</DsButton>
          <DsButton variant="secondary" onClick={() => demo(t('clicked'))}>
            {t('secondary')}
          </DsButton>
          <DsButton variant="ghost" onClick={() => demo(t('clicked'))}>
            {t('ghost')}
          </DsButton>
          <DsButton variant="danger" onClick={() => demo(t('clicked'))}>
            {t('destructive')}
          </DsButton>
          <DsButton
            iconOnly
            variant="secondary"
            aria-label={t('iconOnly')}
            onClick={() => demo(t('clicked'))}
          >
            <MoreHorizontal size={16} />
          </DsButton>
          <DsButton
            loading={loading}
            onClick={() => {
              setLoading(true)
              window.setTimeout(() => setLoading(false), 1200)
              demo(t('clicked'))
            }}
          >
            {t('loading')}
          </DsButton>
          <DsButton disabled>{t('disabled')}</DsButton>
        </div>
      </div>

      <div className="ds-card">
        <h3>{t('sizes')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DsButton size="sm" onClick={() => demo(t('clicked'))}>
            Small
          </DsButton>
          <DsButton size="md" onClick={() => demo(t('clicked'))}>
            Medium
          </DsButton>
          <DsButton size="lg" onClick={() => demo(t('clicked'))}>
            Large
          </DsButton>
        </div>
        <p className="mt-3 mb-0 text-[12px] text-[var(--ds-text-muted)]">
          Hover, :active, :focus-visible, and :disabled are CSS states — tab to a button to inspect the focus ring.
        </p>
      </div>
    </section>
  )
}
