import { Link } from 'react-router-dom'
import { DsEmptyState } from '@/design-system'
import { OcId, OcLoadError, OcSkeletons } from '../../ui'
import { OcStatus } from '../../OcStatus'
import { useOcCopy } from '../../useOcCopy'

export function TicketsPanel({
  loading,
  error,
  onRetry,
  tickets,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  tickets: Array<{ id: string; ticketNumber: string; subject: string; priority: string; status: string }>
}) {
  const t = useOcCopy()
  if (loading) return <OcSkeletons />
  if (error) return <OcLoadError error={error} source="GET /platform-api/support-tickets" onRetry={onRetry} />
  if (tickets.length === 0) return <DsEmptyState title={t('gyms.noTickets')} />
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('support.subject')}</th>
            <th>{t('support.priority')}</th>
            <th>{t('support.status')}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((row) => (
            <tr key={row.id}>
              <td>
                <OcId value={row.ticketNumber} />
              </td>
              <td>
                <Link to={`/oc/support/tickets/${row.id}`}>{row.subject}</Link>
              </td>
              <td>
                <OcStatus value={row.priority} />
              </td>
              <td>
                <OcStatus value={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
