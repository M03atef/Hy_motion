import { DsEmptyState } from '@/design-system'
import { formatCairoDateTime } from '@/lib/format'
import { displayLicenseKey } from '@/lib/license-key'
import { OcId, OcLoadError, OcSkeletons } from '../../ui'
import { OcStatus } from '../../OcStatus'
import { useOcCopy } from '../../useOcCopy'

export function ActivityPanel({
  loading,
  error,
  onRetry,
  changes,
  source,
  revealLicenseKeys,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  changes: Array<{
    changeType: string
    fromStatus?: string | null
    toStatus?: string | null
    initiatedBy: string
    createdAtUtc: string
    licenseKey?: string
  }>
  source: string
  revealLicenseKeys: boolean
}) {
  const t = useOcCopy()
  if (loading) return <OcSkeletons />
  if (error) return <OcLoadError error={error} source={source} onRetry={onRetry} />
  if (changes.length === 0) return <DsEmptyState title={t('gyms.noActivity')} hint={source} />
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>{t('settings.action')}</th>
            <th>{t('gyms.license')}</th>
            <th>{t('settings.actor')}</th>
            <th>{t('settings.when')}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((row, i) => (
            <tr key={`${row.createdAtUtc}-${i}`}>
              <td>{row.changeType}</td>
              <td>
                {row.licenseKey ? (
                  <OcId value={displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })} />
                ) : null}
                <OcStatus value={row.toStatus ?? row.fromStatus} />
              </td>
              <td className="ds-ltr-isolate">{row.initiatedBy}</td>
              <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
