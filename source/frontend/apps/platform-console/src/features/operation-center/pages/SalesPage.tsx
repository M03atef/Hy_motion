import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsAlert, DsEmptyState, DsPageHeader } from '@/design-system'
import { fetchCustomers, fetchLocalLicenses } from '@/lib/api'
import { applyLocalGymFilter, joinLocalGymRows } from '@/features/gyms/local-gym-rows'
import { OcLoadError, OcSkeletons, OcTabs } from '../ui'
import { OcLicenseStatus, OcStatus } from '../OcStatus'
import { useOcCopy } from '../useOcCopy'

export function SalesPage() {
  const t = useOcCopy()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'onboarding' ? 'onboarding' : 'prospects'

  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })
  const licensesQuery = useQuery({ queryKey: ['local-licenses'], queryFn: fetchLocalLicenses })
  const joined = joinLocalGymRows(customersQuery.data ?? [], licensesQuery.data ?? [])
  const prospects = applyLocalGymFilter(joined, 'prospect')
  const onboarding = applyLocalGymFilter(joined, 'pending')
  const rows = tab === 'onboarding' ? onboarding : prospects

  return (
    <div className="oc-stack">
      <DsPageHeader
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        actions={
          <Link to="/oc/sales/onboard" className="ds-btn ds-btn--primary ds-btn--md">
            {t('sales.onboard')}
          </Link>
        }
      />
      <DsAlert tone="info">{t('sales.lifecycle')}</DsAlert>
      <OcTabs
        label={t('sales.title')}
        value={tab}
        onChange={(next) => {
          const copy = new URLSearchParams(params)
          if (next === 'prospects') copy.delete('tab')
          else copy.set('tab', next)
          setParams(copy, { replace: true })
        }}
        tabs={[
          { id: 'prospects', label: t('sales.prospects') },
          { id: 'onboarding', label: t('sales.onboarding') },
        ]}
      />
      {customersQuery.isError || licensesQuery.isError ? (
        <OcLoadError
          error={customersQuery.error ?? licensesQuery.error}
          source="GET /platform-api/customers · GET /platform-api/local-licenses"
          onRetry={() => {
            void customersQuery.refetch()
            void licensesQuery.refetch()
          }}
        />
      ) : null}
      {customersQuery.isLoading ? (
        <OcSkeletons />
      ) : rows.length === 0 ? (
        <DsEmptyState title={tab === 'onboarding' ? t('sales.emptyOnboarding') : t('sales.emptyProspects')} />
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>{t('gyms.gym')}</th>
                <th>{t('gyms.owner')}</th>
                <th>{t('gyms.customerStatus')}</th>
                <th>{t('gyms.license')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.owner || '—'}</td>
                  <td>
                    <OcStatus value={row.customerStatus} />
                  </td>
                  <td>
                    <OcLicenseStatus value={row.apiLicenseStatus} />
                  </td>
                  <td>
                    <Link to={`/oc/gyms/local/${row.id}`}>{t('common.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

