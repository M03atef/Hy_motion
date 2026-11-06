import { DsEmptyState } from '@/design-system'
import { formatCairoDateTime } from '@/lib/format'
import { displayLicenseKey } from '@/lib/license-key'
import { OcId, OcLoadError, OcSkeletons } from '../../ui'
import { useOcCopy } from '../../useOcCopy'

export function OperationsPanel({
  loading,
  error,
  onRetry,
  operations,
  source,
  revealLicenseKeys,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  operations: Array<{
    operationId: string
    eventType: string
    installationId?: string | null
    gymCode?: string | null
    gymName?: string | null
    message?: string | null
    createdAtUtc: string
    licenseKey?: string
  }>
  source: string
  revealLicenseKeys: boolean
}) {
  const t = useOcCopy()
  if (loading) return <OcSkeletons />
  if (error) return <OcLoadError error={error} source={source} onRetry={onRetry} />
  if (operations.length === 0) return <DsEmptyState title={t('gyms.noOperations')} hint={source} />
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>{t('gyms.operation')}</th>
            <th>{t('gyms.event')}</th>
            <th>{t('gyms.gymIdentity')}</th>
            <th>{t('gyms.license')}</th>
            <th>{t('settings.when')}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((row, i) => (
            <tr key={`${row.operationId}-${row.eventType}-${i}`}>
              <td>
                <OcId value={row.operationId} />
              </td>
              <td>
                <div>{row.eventType}</div>
                {row.message ? <div className="text-sm text-[var(--ds-text-muted)]">{row.message}</div> : null}
              </td>
              <td>
                <div>{row.gymName || t('common.none')}</div>
                {row.gymCode ? <OcId value={row.gymCode} /> : null}
                {row.installationId ? <OcId value={row.installationId} /> : null}
              </td>
              <td>
                {row.licenseKey ? (
                  <OcId value={displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })} />
                ) : (
                  t('common.none')
                )}
              </td>
              <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
