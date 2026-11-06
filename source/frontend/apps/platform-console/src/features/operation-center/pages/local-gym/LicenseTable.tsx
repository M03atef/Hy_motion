import type { LocalLicenseListItemDto } from '@/lib/api/types'
import { displayLicenseKey } from '@/lib/license-key'
import { OcId } from '../../ui'
import { OcLicenseStatus } from '../../OcStatus'
import { useOcCopy } from '../../useOcCopy'

export function LicenseTable({
  licenses,
  selectedLicenseId,
  onSelect,
  requireSelection,
  revealLicenseKeys,
}: {
  licenses: LocalLicenseListItemDto[]
  selectedLicenseId: string
  onSelect: (id: string) => void
  requireSelection: boolean
  revealLicenseKeys: boolean
}) {
  const t = useOcCopy()
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>{requireSelection ? t('gyms.actionTarget') : t('gyms.license')}</th>
            <th>{t('gyms.licenseKey')}</th>
            <th>{t('gyms.gymIdentity')}</th>
            <th>{t('gyms.edition')}</th>
            <th>{t('support.status')}</th>
            <th>{t('gyms.devices')}</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((row) => (
            <tr key={row.id}>
              <td>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="oc-license-target"
                    checked={selectedLicenseId === row.id}
                    onChange={() => onSelect(row.id)}
                  />
                  <span>{t('gyms.actionTarget')}</span>
                </label>
              </td>
              <td>
                <OcId value={displayLicenseKey(row.licenseKey, { revealFull: revealLicenseKeys })} />
              </td>
              <td>
                <div>{row.gymName || t('common.none')}</div>
                {row.gymCode ? <OcId value={row.gymCode} /> : null}
              </td>
              <td>{row.edition}</td>
              <td>
                <OcLicenseStatus value={row.status} />
              </td>
              <td className="ds-ltr-isolate">
                {row.activeInstallationCount} / {row.deviceLimit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
