import { usePreview } from '../preview-context'
import type { CopyKey } from '../i18n'

const ITEMS: { title: CopyKey; body: CopyKey }[] = [
  { title: 'r1t', body: 'r1' },
  { title: 'r2t', body: 'r2' },
  { title: 'r3t', body: 'r3' },
  { title: 'r4t', body: 'r4' },
  { title: 'r5t', body: 'r5' },
  { title: 'r6t', body: 'r6' },
  { title: 'r7t', body: 'r7' },
  { title: 'r8t', body: 'r8' },
]

export function UxReviewSection() {
  const { t } = usePreview()
  return (
    <section id="review" className="ds-section">
      <p className="ds-section-kicker">J</p>
      <h2 className="ds-section-title">{t('reviewTitle')}</h2>
      <p className="ds-section-lead">{t('reviewLead')}</p>
      <div className="ds-review">
        {ITEMS.map((item) => (
          <article key={item.title}>
            <h3>{t(item.title)}</h3>
            <p>{t(item.body)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
