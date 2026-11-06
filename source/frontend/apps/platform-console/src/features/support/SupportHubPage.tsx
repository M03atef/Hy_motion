import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { SupportTicketsPage } from '@/features/customers/SupportTicketsPage'
import { useUiStore } from '@/stores/ui-store'

export function SupportHubPage() {
  const t = useUiStore((s) => s.t)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('support.hubTitle')}
        subtitle={t('support.hubSubtitle')}
        actions={
          <Link to="/oc/support/playbooks" className="cp-btn cp-btn-ghost">
            {t('gyms.help')}
          </Link>
        }
      />
      <SupportTicketsPage embedded />
    </div>
  )
}
