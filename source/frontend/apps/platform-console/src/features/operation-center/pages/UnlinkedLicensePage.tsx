import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DsAlert, DsCard, DsEmptyState, DsPageHeader } from '@/design-system'
import { fetchLocalLicenseDetail } from '@/lib/api'
import { formatCairoDateTime } from '@/lib/format'
import { displayLicenseKey } from '@/lib/license-key'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { OcId, OcLoadError, OcSkeletons, OcTabs } from '../ui'
import { OcLicenseStatus, OcStatus } from '../OcStatus'
import { OcLicenseActions } from '../OcLicenseActions'
import { useOcCopy } from '../useOcCopy'

const TABS = ['summary', 'installations', 'operations', 'activity'] as const
type Tab = (typeof TABS)[number]

export function UnlinkedLicensePage() {
  const { id = '' } = useParams()
  const t = useOcCopy()
  const role = useAuthStore((s) => s.user?.role)
  const revealLicenseKeys = isOpsOrAbove(role)
  const [tab, setTab] = useState<Tab>('summary')
  const query = useQuery({
    queryKey: ['local-license', id],
    queryFn: () => fetchLocalLicenseDetail(id),
    enabled: Boolean(id),
  })

  if (query.isLoading) return <OcSkeletons rows={5} />
  if (query.isError) {
    return (
      <OcLoadError
        error={query.error}
        source={`GET /platform-api/local-licenses/${id}`}
        onRetry={() => void query.refetch()}
      />
    )
  }
  const license = query.data
  if (!license) return <DsEmptyState title={t('gyms.notFound')} />

  return (
    <div className="oc-stack">
      <Link to="/oc/gyms?filter=unlinked">{t('common.back')}</Link>
      <DsPageHeader
        title={license.gymName || license.customerName || t('gyms.unlinkedLicense')}
        subtitle={t('gyms.unlinkedHint')}
        actions={
          <OcLicenseActions
            licenseId={license.id}
            licenseKey={license.licenseKey}
            status={license.status}
            installations={license.installations}
          />
        }
      />
      <DsAlert tone="warning">{t('gyms.unlinkedLicense')}</DsAlert>
      <OcTabs
        label={t('gyms.license')}
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        tabs={TABS.map((tabId) => ({
          id: tabId,
          label: tabId === 'summary' ? t('gyms.tab.license') : t(`gyms.tab.${tabId}` as const),
        }))}
      />
      {tab === 'summary' ? (
        <div className="oc-stack">
          <DsAlert tone="info">{t('gyms.cannotActivate')}</DsAlert>
          <DsCard>
            <dl className="oc-dl">
              <div>
                <dt>{t('gyms.gymName')}</dt>
                <dd>{license.gymName || t('common.none')}</dd>
              </div>
              <div>
                <dt>{t('gyms.code')}</dt>
                <dd>{license.gymCode ? <OcId value={license.gymCode} /> : t('common.none')}</dd>
              </div>
              <div>
                <dt>{t('gyms.licenseKey')}</dt>
                <dd>
                  <OcId value={displayLicenseKey(license.licenseKey, { revealFull: revealLicenseKeys })} />
                </dd>
              </div>
              <div>
                <dt>{t('gyms.edition')}</dt>
                <dd>{license.edition}</dd>
              </div>
              <div>
                <dt>{t('gyms.license')}</dt>
                <dd>
                  <OcLicenseStatus value={license.status} />
                </dd>
              </div>
              <div>
                <dt>{t('gyms.devices')}</dt>
                <dd className="ds-ltr-isolate">
                  {license.activeInstallationCount} / {license.deviceLimit}
                </dd>
              </div>
            </dl>
          </DsCard>
        </div>
      ) : null}
      {tab === 'installations' ? (
        license.installations.length === 0 ? (
          <DsEmptyState title={t('gyms.noInstall')} />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('gyms.gymIdentity')}</th>
                  <th>{t('gyms.version')}</th>
                  <th>{t('support.status')}</th>
                  <th>{t('gyms.lastValidation')}</th>
                </tr>
              </thead>
              <tbody>
                {license.installations.map((row) => (
                  <tr key={row.installationId}>
                    <td>
                      <OcId value={row.installationId} />
                    </td>
                    <td>
                      <div>{row.gymName || t('common.none')}</div>
                      {row.gymCode ? <OcId value={row.gymCode} /> : null}
                    </td>
                    <td className="ds-ltr-isolate">{row.appVersion || t('common.none')}</td>
                    <td>
                      <OcStatus value={row.status} />
                    </td>
                    <td className="ds-ltr-isolate">
                      {row.lastValidatedAtUtc ? formatCairoDateTime(row.lastValidatedAtUtc) : t('gyms.neverChecked')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      {tab === 'operations' ? (
        (license.recentOperations ?? []).length === 0 ? (
          <DsEmptyState title={t('gyms.noOperations')} hint={`GET /platform-api/local-licenses/${id}`} />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('gyms.operation')}</th>
                  <th>{t('gyms.event')}</th>
                  <th>{t('gyms.gymIdentity')}</th>
                  <th>{t('settings.when')}</th>
                </tr>
              </thead>
              <tbody>
                {(license.recentOperations ?? []).map((row, i) => (
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
                    <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      {tab === 'activity' ? (
        license.recentChanges.length === 0 ? (
          <DsEmptyState title={t('gyms.noActivity')} hint={`GET /platform-api/local-licenses/${id}`} />
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t('settings.action')}</th>
                  <th>{t('settings.when')}</th>
                </tr>
              </thead>
              <tbody>
                {license.recentChanges.map((row, i) => (
                  <tr key={`${row.createdAtUtc}-${i}`}>
                    <td>{row.changeType}</td>
                    <td className="ds-ltr-isolate">{formatCairoDateTime(row.createdAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  )
}
