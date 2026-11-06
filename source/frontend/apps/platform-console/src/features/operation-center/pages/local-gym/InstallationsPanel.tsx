import { DsEmptyState } from '@/design-system'
import type { LocalInstallationDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { displayLicenseKey } from '@/lib/license-key'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { OcId, OcLoadError, OcSkeletons } from '../../ui'
import { OcStatus } from '../../OcStatus'
import { useOcCopy } from '../../useOcCopy'

export function InstallationsPanel({
  loading,
  error,
  onRetry,
  installations,
  lastValidation,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  installations: Array<
    LocalInstallationDto & {
      licenseKey?: string
      licenseId?: string
    }
  >
  lastValidation?: string | null
}) {
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const revealLicenseKeys = isOpsOrAbove(role)
  if (loading) return <OcSkeletons />
  if (error) return <OcLoadError error={error} source="GET /platform-api/local-licenses/{id}" onRetry={onRetry} />
  if (installations.length === 0) {
    return (
      <DsEmptyState
        title={t('gyms.noInstall')}
        hint={lastValidation ? undefined : t('gyms.lastSeenHint')}
      />
    )
  }
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('gyms.license')}</th>
            <th>{t('gyms.gymIdentity')}</th>
            <th>{t('gyms.version')}</th>
            <th>{t('support.status')}</th>
            <th>{t('gyms.firstSeen')}</th>
            <th>{t('gyms.lastValidation')}</th>
          </tr>
        </thead>
        <tbody>
          {installations.map((row) => (
            <tr key={`${row.licenseId ?? ''}-${row.installationId}`}>
              <td>
                <OcId value={row.installationId} />
              </td>
              <td>
                {row.licenseKey ? (
                  <OcId value={displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })} />
                ) : (
                  t('common.none')
                )}
              </td>
              <td>
                <div>{row.gymName || t('common.none')}</div>
                {row.gymCode ? <OcId value={row.gymCode} /> : null}
              </td>
              <td className="ds-ltr-isolate">{row.appVersion || t('common.none')}</td>
              <td>
                <OcStatus value={row.status} />
              </td>
              <td className="ds-ltr-isolate">{formatCairoDateTime(row.firstActivatedAtUtc)}</td>
              <td className="ds-ltr-isolate">
                {row.lastValidatedAtUtc ? formatCairoDateTime(row.lastValidatedAtUtc) : t('gyms.neverChecked')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
