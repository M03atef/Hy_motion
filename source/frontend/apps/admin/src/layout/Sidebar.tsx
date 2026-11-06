import { NavLink } from 'react-router-dom'
import { useVisibleNav } from '@/hooks/useVisibleNav'
import { tLabel } from '@/lib/i18n/bilingual'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'
import { useUiStore } from '@/stores/ui-store'

export function Sidebar() {
  const categories = useVisibleNav()
  const locale = useUiStore((s) => s.locale)
  const probeStatus = useFeatureFlagsStore((s) => s.status)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-[var(--c700)] bg-[var(--c900)] text-[var(--dtp)] max-lg:w-56 border-e">
      <div className="flex items-center gap-3 border-b border-[var(--c700)] px-5 py-5">
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 shrink-0" aria-hidden>
          <rect width="48" height="48" rx="12" fill="#7ACC00" />
          <path
            d="M15 33L24 14L33 33"
            stroke="#0D0D0D"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18 28H30" stroke="#0D0D0D" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div>
          <div className="font-[family-name:var(--fd)] text-lg font-bold text-[var(--l400)]">
            HyMotion
          </div>
          <div className="text-[11px] text-[var(--c400)]">
            {probeStatus === 'probing'
              ? tLabel('Checking modules…', 'جارٍ فحص الوحدات…', locale)
              : tLabel('Staff console', 'لوحة الموظفين', locale)}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat.key}>
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c500)]">
                {tLabel(cat.label, cat.labelAr, locale)}
              </div>
              <ul className="flex flex-col gap-1">
                {cat.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/app'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-[var(--rmd)] px-3 py-2.5 text-sm font-semibold transition-colors ${
                            isActive
                              ? 'bg-[rgba(160,224,64,0.12)] text-[var(--l400)]'
                              : 'text-[var(--c200)] hover:bg-[var(--c800)] hover:text-white'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        {tLabel(item.label, item.labelAr, locale)}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  )
}
