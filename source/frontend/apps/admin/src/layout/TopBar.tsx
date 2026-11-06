import { staffLogout } from '@/lib/api'
import { t } from '@/lib/i18n/bilingual'
import { useAuthStore } from '@/stores/auth-store'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'
import { useUiStore } from '@/stores/ui-store'

export function TopBar() {
  const user = useAuthStore((s) => s.user)
  const locale = useUiStore((s) => s.locale)
  const toggleLocale = useUiStore((s) => s.toggleLocale)
  const resetFlags = useFeatureFlagsStore((s) => s.reset)

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--lbd)] bg-white px-6">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[var(--ltp)]">{user?.fullName}</div>
        <div className="truncate text-xs text-[var(--ltt)]">
          {user?.role} · {user?.gymCode}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleLocale()}
          className="rounded-[var(--rpl)] border border-[var(--lbd)] px-3 py-1.5 text-xs font-semibold text-[var(--lts)] transition hover:border-[var(--l500)] hover:text-[var(--l600)]"
          aria-label={t('common.language', undefined, locale)}
        >
          {locale === 'ar' ? t('common.switchToEn', undefined, locale) : t('common.switchToAr', undefined, locale)}
        </button>
        <button
          type="button"
          onClick={() => {
            resetFlags()
            void staffLogout()
            window.location.href = '/login'
          }}
          className="rounded-[var(--rpl)] border-2 border-[var(--l500)] bg-[var(--l500)] px-4 py-1.5 text-xs font-semibold text-[var(--c900)] transition hover:border-[var(--l400)] hover:bg-[var(--l400)]"
        >
          {t('auth.logout', undefined, locale)}
        </button>
      </div>
    </header>
  )
}
