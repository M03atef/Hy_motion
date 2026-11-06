import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSupportTickets, updateSupportTicket } from '@/lib/api'
import { isSupportOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { StatusChip } from './status'

export function SupportTicketsPage({ embedded = false }: { embedded?: boolean }) {
  const t = useUiStore((s) => s.t)
  const showToast = useUiStore((s) => s.showToast)
  const canPatch = isSupportOrAbove(useAuthStore((s) => s.user?.role))
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['support-tickets'], queryFn: () => fetchSupportTickets() })
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateSupportTicket(id, { status }),
    onSuccess: async () => {
      showToast(t('support.updated'), 'success')
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      {embedded ? null : (
        <header>
          <h1 className="cp-page-title">{t('support.title')}</h1>
          <p className="cp-page-subtitle">{t('support.subtitle')}</p>
        </header>
      )}
      {query.isLoading ? <div className="text-sm text-[var(--text-muted)]">{t('common.loading')}</div> : null}
      {query.isError ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t('errors.generic')}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white">
        <table className="cp-table min-w-[800px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t('support.number')}</th>
              <th className="px-3 py-2 font-medium">{t('customers.business')}</th>
              <th className="px-3 py-2 font-medium">{t('support.subject')}</th>
              <th className="px-3 py-2 font-medium">{t('support.priority')}</th>
              <th className="px-3 py-2 font-medium">{t('customers.status')}</th>
              <th className="px-3 py-2 font-medium">{t('customers.license')}</th>
              <th className="px-3 py-2 font-medium">{t('customers.installation')}</th>
              {canPatch ? <th className="px-3 py-2 font-medium">{t('common.actions')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {!query.isLoading && (query.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  {t('support.empty')}
                </td>
              </tr>
            ) : null}
            {(query.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-gray-200">
                <td className="px-3 py-2 font-[var(--mono)] text-xs">{row.ticketNumber}</td>
                <td className="px-3 py-2">
                  <Link to={`/oc/gyms/local/${row.customerId}`} className="text-blue-700 hover:underline">
                    {row.customerName || row.customerId}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.subject}</td>
                <td className="px-3 py-2">
                  <StatusChip value={row.priority} />
                </td>
                <td className="px-3 py-2">
                  <StatusChip value={row.status} />
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.localLicenseId ? t('gyms.linked') : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.localInstallationId ? t('gyms.linked') : '—'}</td>
                {canPatch ? (
                  <td className="px-3 py-2">
                    {row.status === 'open' ? (
                      <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => patch.mutate({ id: row.id, status: 'in_progress' })}>
                        {t('support.start')}
                      </button>
                    ) : row.status === 'in_progress' ? (
                      <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => patch.mutate({ id: row.id, status: 'resolved' })}>
                        {t('support.resolve')}
                      </button>
                    ) : row.status === 'waiting_customer' ? (
                      <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => patch.mutate({ id: row.id, status: 'in_progress' })}>
                        {t('support.resume')}
                      </button>
                    ) : row.status === 'resolved' ? (
                      <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => patch.mutate({ id: row.id, status: 'closed' })}>
                        {t('support.close')}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
