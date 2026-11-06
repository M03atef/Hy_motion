import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { isAdmin } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

export function SettingsHubPage() {
  const t = useUiStore((s) => s.t)
  const role = useAuthStore((s) => s.user?.role)
  const admin = isAdmin(role)

  const cards = [
    admin
      ? { to: '/settings/users', title: t('settings.admins'), hint: t('settings.adminsHint') }
      : null,
    { to: '/settings/plans', title: t('nav.plansPricing'), hint: t('settings.plansHint') },
    { to: '/settings/catalog', title: t('nav.catalogProducts'), hint: t('settings.catalogHint') },
    { to: '/settings/metrics', title: t('nav.metrics'), hint: t('settings.metricsHint') },
    { to: '/settings/audit', title: t('nav.auditLog'), hint: t('settings.auditHint') },
  ].filter(Boolean) as { to: string; title: string; hint: string }[]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('settings.hubTitle')} subtitle={t('settings.hubSubtitle')} />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 hover:border-[var(--accent-border)]"
          >
            <div className="text-[15px] font-semibold text-[var(--text)]">{card.title}</div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{card.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
