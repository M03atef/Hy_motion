import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, DsPageHeader } from '@/design-system'
import {
  fetchCustomerPayments,
  fetchCustomerProfile,
  fetchLocalLicenseDetail,
  fetchSupportTickets,
  fetchTenantDetail,
} from '@/lib/api'
import type { LocalLicenseDetailDto } from '@/lib/api/types'
import { isCustomerAccess, isOpsOrAbove, isSales } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OcId, OcLoadError, OcSkeletons, OcTabs } from '../ui'
import { OcLicenseStatus, OcStatus } from '../OcStatus'
import { OcLicenseActions } from '../OcLicenseActions'
import { OcOwnerRecoveryCard } from '../OcOwnerRecovery'
import { OcSalesContractPanel } from '../OcSalesContractPanel'
import { useOcCopy } from '../useOcCopy'
import type { OcCopyKey } from '../i18n'
import { ActivityPanel } from './local-gym/ActivityPanel'
import { CreateTicketForm } from './local-gym/CreateTicketForm'
import { CustomerOpsCard } from './local-gym/CustomerOpsCard'
import {
  customerLicenses,
  deriveLiveLicenseStatus,
  formatOwnerAccount,
  labelOwnerAccountStatus,
  ownerAccountLogin,
  resolveLocalGymIdentity,
} from './local-gym/helpers'
import { InstallationsPanel } from './local-gym/InstallationsPanel'
import { LicenseTable } from './local-gym/LicenseTable'
import { OperationsPanel } from './local-gym/OperationsPanel'
import { TicketsPanel } from './local-gym/TicketsPanel'

const TABS = ['summary', 'sales', 'support', 'activity'] as const
type Tab = (typeof TABS)[number]

const OWNER_STATUS_KEYS: Record<string, OcCopyKey> = {
  reset_requested: 'gyms.ownerAccountStatus.reset_requested',
  active: 'gyms.ownerAccountStatus.active',
  inactive: 'gyms.ownerAccountStatus.inactive',
}

export function LocalGymDetailPage() {
  const { id = '' } = useParams()
  const t = useOcCopy()
  const locale = useUiStore((s) => s.locale)
  const role = useAuthStore((s) => s.user?.role)
  const [tab, setTab] = useState<Tab>('summary')
  const [selectedLicenseId, setSelectedLicenseId] = useState('')

  const profileQuery = useQuery({
    queryKey: ['customer-profile', id],
    queryFn: () => fetchCustomerProfile(id),
    enabled: Boolean(id),
  })
  const paymentsQuery = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => fetchCustomerPayments(id),
    enabled: Boolean(id) && tab === 'sales',
  })
  const ticketsQuery = useQuery({
    queryKey: ['customer-tickets', id],
    queryFn: () => fetchSupportTickets(id),
    enabled: Boolean(id) && tab === 'support',
  })

  const licenses = useMemo(
    () => (profileQuery.data ? customerLicenses(profileQuery.data) : []),
    [profileQuery.data],
  )
  const detailQueries = useQueries({
    queries: licenses.map((license) => ({
      queryKey: ['local-license', license.id],
      queryFn: () => fetchLocalLicenseDetail(license.id),
      enabled: Boolean(license.id),
    })),
  })
  const cloudTenantId = profileQuery.data?.customer.tenantId ?? ''
  const cloudQuery = useQuery({
    queryKey: ['tenant', cloudTenantId],
    queryFn: () => fetchTenantDetail(cloudTenantId),
    enabled: Boolean(cloudTenantId) && !isSales(role),
  })

  useEffect(() => {
    setSelectedLicenseId('')
  }, [id])

  useEffect(() => {
    if (licenses.length === 1 && licenses[0]) setSelectedLicenseId(licenses[0].id)
  }, [licenses])

  if (profileQuery.isLoading) return <OcSkeletons rows={6} />
  if (profileQuery.isError) {
    return (
      <OcLoadError
        error={profileQuery.error}
        source={`GET /platform-api/customers/${id}/profile`}
        onRetry={() => void profileQuery.refetch()}
      />
    )
  }

  const profile = profileQuery.data
  if (!profile) {
    return <DsEmptyState title={t('gyms.notFound')} hint={`GET /platform-api/customers/${id}/profile`} />
  }

  const customer = profile.customer
  const details = detailQueries.map((query) => query.data).filter((row): row is LocalLicenseDetailDto => Boolean(row))
  const detailsLoading = detailQueries.some((query) => query.isLoading)
  const detailsError = detailQueries.find((query) => query.isError)?.error ?? null
  const selectedLicense = licenses.find((row) => row.id === selectedLicenseId) ?? null
  const selectedDetail = details.find((row) => row.id === selectedLicenseId) ?? null
  const installations = details.flatMap((license) =>
    license.installations.map((row) => ({ ...row, licenseKey: license.licenseKey, licenseId: license.id })),
  )
  const operations = details.flatMap((license) =>
    (license.recentOperations ?? []).map((row) => ({ ...row, licenseKey: license.licenseKey })),
  )
  const changes = details.flatMap((license) =>
    license.recentChanges.map((row) => ({ ...row, licenseKey: license.licenseKey })),
  )
  const identity = resolveLocalGymIdentity({ selectedDetail, details, licenses })
  const multiLicense = licenses.length > 1
  const actionReady = Boolean(selectedLicense)
  const liveStatus = deriveLiveLicenseStatus(licenses, selectedLicenseId)
  const revealLicenseKeys = isOpsOrAbove(role)
  const ownerLogin = ownerAccountLogin(customer)
  const ownerStatusKey = customer.ownerAccountStatus?.trim() || ''
  const ownerStatusLabel = ownerStatusKey
    ? OWNER_STATUS_KEYS[ownerStatusKey]
      ? t(OWNER_STATUS_KEYS[ownerStatusKey])
      : labelOwnerAccountStatus(ownerStatusKey, locale === 'ar' ? 'ar' : 'en')
    : ''

  return (
    <div className="oc-stack">
      <Link to="/oc/gyms">{t('common.back')}</Link>
      <DsPageHeader
        title={identity.gymName || customer.businessName}
        subtitle={`${customer.ownerName} · ${customer.phone || customer.email || '—'}`}
        actions={
          <DsButton type="button" onClick={() => setTab('sales')}>
            {t('gyms.openSalesForContract')}
          </DsButton>
        }
      />
      <div className="oc-header-meta">
        <OcStatus value={customer.status} />
        {liveStatus ? <OcLicenseStatus value={liveStatus} showCode={false} /> : null}
        {identity.gymCode ? <OcId value={identity.gymCode} /> : null}
      </div>
      {multiLicense && !selectedLicenseId ? <DsAlert tone="warning">{t('gyms.selectLicense')}</DsAlert> : null}
      <OcTabs
        label={t('gyms.title')}
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        tabs={TABS.map((tabId) => ({ id: tabId, label: t(`gyms.tab.${tabId}` as const) }))}
      />

      {tab === 'summary' ? (
        <div className="oc-stack">
          <DsCard>
            <div className="oc-profile">
              <div className="oc-profile-block">
                <h3 className="oc-section-title">{t('gyms.section.identity')}</h3>
                <dl className="oc-facts">
                  <div>
                    <dt>{t('gyms.gymName')}</dt>
                    <dd>{identity.gymName || customer.businessName}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.code')}</dt>
                    <dd>{identity.gymCode ? <OcId value={identity.gymCode} /> : t('common.none')}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.version')}</dt>
                    <dd className="ds-ltr-isolate">{identity.appVersion || t('common.none')}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.cloudTenant')}</dt>
                    <dd>
                      {customer.tenantId ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {cloudQuery.data ? (
                            <>
                              <OcId value={cloudQuery.data.gymCode} />
                              <span>{cloudQuery.data.name}</span>
                            </>
                          ) : !isSales(role) ? (
                            <span className="ds-ltr-isolate">{customer.tenantId}</span>
                          ) : (
                            t('gyms.alsoCloud')
                          )}
                          {!isSales(role) ? (
                            <Link to={`/oc/gyms/cloud/${customer.tenantId}`} className="text-sm font-semibold text-[var(--ds-teal-500)]">
                              {t('gyms.alsoCloud')}
                            </Link>
                          ) : null}
                        </span>
                      ) : (
                        t('gyms.noCloudTenant')
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="oc-profile-block">
                <h3 className="oc-section-title">{t('gyms.section.people')}</h3>
                <dl className="oc-facts">
                  <div>
                    <dt>{t('gyms.owner')}</dt>
                    <dd>{customer.ownerName}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.contact')}</dt>
                    <dd>{customer.phone || customer.email || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.ownerAccountLogin')}</dt>
                    <dd className="ds-ltr-isolate">{ownerLogin || t('common.none')}</dd>
                  </div>
                  <div>
                    <dt>{t('gyms.ownerAccountStatus')}</dt>
                    <dd>{ownerStatusLabel || t('common.none')}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </DsCard>

          <DsCard>
            <h3 className="oc-section-title">{t('gyms.section.snapshot')}</h3>
            <dl className="oc-metrics">
              <div>
                <dt>{t('gyms.customerStatus')}</dt>
                <dd>
                  <OcStatus value={customer.status} />
                </dd>
              </div>
              <div>
                <dt>{t('gyms.liveStatus')}</dt>
                <dd>{liveStatus ? <OcLicenseStatus value={liveStatus} showCode={false} /> : t('common.none')}</dd>
              </div>
              <div>
                <dt>{t('gyms.licensesCount')}</dt>
                <dd className="ds-ltr-isolate">{licenses.length}</dd>
              </div>
              <div>
                <dt>{t('gyms.tickets')}</dt>
                <dd className="ds-ltr-isolate">{profile.openSupportTicketCount}</dd>
              </div>
            </dl>
          </DsCard>

          <DsCard>
            <h3 className="oc-section-title">{t('gyms.section.licensePc')}</h3>
            <div className="oc-stack mt-1">
              <DsAlert tone="info">{t('gyms.cannotActivate')}</DsAlert>
              {licenses.length === 0 ? (
                <DsEmptyState title={t('gyms.noLicense')} hint="GET /platform-api/customers/{id}/profile" />
              ) : (
                <LicenseTable
                  licenses={licenses}
                  selectedLicenseId={selectedLicenseId}
                  onSelect={setSelectedLicenseId}
                  requireSelection={multiLicense}
                  revealLicenseKeys={revealLicenseKeys}
                />
              )}
              {actionReady && selectedLicense ? (
                <div className="oc-section-actions">
                  <OcLicenseActions
                    licenseId={selectedLicense.id}
                    licenseKey={selectedLicense.licenseKey}
                    status={selectedLicense.status}
                    installations={selectedDetail?.installations ?? (profile.installation ? [profile.installation] : [])}
                  />
                </div>
              ) : null}
            </div>
          </DsCard>

          <DsCard>
            <h3 className="oc-section-title">{t('gyms.section.installsOps')}</h3>
            <div className="oc-stack mt-1">
              <InstallationsPanel
                loading={detailsLoading}
                error={detailsError}
                onRetry={() => detailQueries.forEach((query) => void query.refetch())}
                installations={installations}
                lastValidation={profile.lastValidation}
              />
              <OperationsPanel
                loading={detailsLoading}
                error={detailsError}
                onRetry={() => detailQueries.forEach((query) => void query.refetch())}
                operations={operations}
                source="GET /platform-api/local-licenses/{id}"
                revealLicenseKeys={revealLicenseKeys}
              />
            </div>
          </DsCard>

          <CustomerOpsCard customer={customer} />
          {!customer.tenantId ? <OcOwnerRecoveryCard customerId={id} /> : null}
        </div>
      ) : null}

      {tab === 'sales' ? (
        <OcSalesContractPanel
          customerId={id}
          customerRollup={{
            contractTotal: profile.contractTotal,
            paid: profile.paidAmount,
            outstanding: profile.outstandingAmount,
            paymentStatus: profile.paymentStatus,
          }}
          payments={paymentsQuery.data ?? []}
          paymentsLoading={paymentsQuery.isLoading}
          paymentsError={paymentsQuery.isError ? paymentsQuery.error : null}
          onRetryPayments={() => void paymentsQuery.refetch()}
        />
      ) : null}

      {tab === 'support' ? (
        <div className="oc-stack">
          {isCustomerAccess(role) ? (
            <CreateTicketForm
              customerId={id}
              customerName={customer.businessName}
              licenses={licenses}
              details={details}
              selectedLicenseId={selectedLicenseId}
              onSelectLicense={setSelectedLicenseId}
            />
          ) : null}
          <TicketsPanel
            loading={ticketsQuery.isLoading}
            error={ticketsQuery.isError ? ticketsQuery.error : null}
            onRetry={() => void ticketsQuery.refetch()}
            tickets={ticketsQuery.data ?? []}
          />
        </div>
      ) : null}

      {tab === 'activity' ? (
        <ActivityPanel
          loading={detailsLoading}
          error={detailsError}
          onRetry={() => detailQueries.forEach((query) => void query.refetch())}
          changes={changes}
          source="GET /platform-api/local-licenses/{id}"
          revealLicenseKeys={revealLicenseKeys}
        />
      ) : null}
    </div>
  )
}
