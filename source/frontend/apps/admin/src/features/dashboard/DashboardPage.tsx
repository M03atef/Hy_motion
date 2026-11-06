import { getPermClaims } from '@/lib/permissions'
import { displayBilingualText, tLabel } from '@/lib/i18n/bilingual'
import { useAuthStore } from '@/stores/auth-store'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'
import { useUiStore } from '@/stores/ui-store'
import { FEATURE_MODULES } from '@/lib/features/probe'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const perms = getPermClaims(session?.accessToken)
  const locale = useUiStore((s) => s.locale)
  const modules = useFeatureFlagsStore((s) => s.modules)
  const status = useFeatureFlagsStore((s) => s.status)
  const lastProbedAt = useFeatureFlagsStore((s) => s.lastProbedAt)

  const sampleDetail = 'Open a shift first / افتح وردية أولاً'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--fd)] text-2xl font-bold">
          {tLabel('Dashboard', 'لوحة التحكم', locale)}
        </h1>
        <p className="text-sm text-[var(--ltt)]">
          {tLabel(
            `Signed in as ${user?.fullName ?? '—'} (${user?.role ?? '—'})`,
            `مسجّل كـ ${user?.fullName ?? '—'} (${user?.role ?? '—'})`,
            locale,
          )}
        </p>
      </div>

      <section className="rounded-[16px] border border-[var(--lbd)] bg-white p-6">
        <h2 className="mb-3 font-[family-name:var(--fd)] text-sm font-bold uppercase tracking-wide text-[var(--ltt)]">
          {tLabel('Permissions (perm claims)', 'الصلاحيات (perm)', locale)}
        </h2>
        <div className="flex flex-wrap gap-2">
          {perms.length === 0 ? (
            <span className="text-sm text-[var(--ltt)]">—</span>
          ) : (
            perms.map((p) => (
              <span
                key={p}
                className="rounded-[var(--rpl)] border border-[rgba(160,224,64,0.3)] bg-[rgba(160,224,64,0.08)] px-3 py-1 text-xs font-semibold text-[var(--l600)]"
              >
                {p}
              </span>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--ltt)]">
          {tLabel(
            'Plans / Settings require plans.manage or Owner — a Receptionist token hides them from nav.',
            'الباقات / الإعدادات تتطلب plans.manage أو Owner — توكن Receptionist يخفيها من القائمة.',
            locale,
          )}
        </p>
      </section>

      <section className="rounded-[16px] border border-[var(--lbd)] bg-white p-6">
        <h2 className="mb-3 font-[family-name:var(--fd)] text-sm font-bold uppercase tracking-wide text-[var(--ltt)]">
          {tLabel('Feature modules', 'وحدات الميزات', locale)}{' '}
          <span className="font-normal normal-case">({status})</span>
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURE_MODULES.map((key) => (
            <li
              key={key}
              className={`rounded-[var(--rmd)] border px-3 py-2 text-sm font-semibold ${
                modules[key]
                  ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] text-[var(--suc600,#16A34A)]'
                  : 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[var(--dng600)]'
              }`}
            >
              {key}: {modules[key] ? 'available' : 'FEATURE_DISABLED'}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--ltt)]">
          {tLabel(
            `Call Sheet is never flag-gated. Last probe: ${lastProbedAt ?? '—'}`,
            `ورقة المتابعة غير خاضعة لعلم الميزة. آخر فحص: ${lastProbedAt ?? '—'}`,
            locale,
          )}
        </p>
      </section>

      <section className="rounded-[16px] border border-[var(--lbd)] bg-white p-6">
        <h2 className="mb-2 font-[family-name:var(--fd)] text-sm font-bold uppercase tracking-wide text-[var(--ltt)]">
          {tLabel('Bilingual message convention', 'اتفاقية الرسائل ثنائية اللغة', locale)}
        </h2>
        <p className="text-sm text-[var(--ltp)]">
          {displayBilingualText(sampleDetail, locale)}
        </p>
        <p className="mt-1 text-xs text-[var(--ltt)]">
          raw: <code>{sampleDetail}</code>
        </p>
      </section>
    </div>
  )
}
