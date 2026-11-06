import type { LocalLicenseListItemDto, PlatformCustomerListItemDto } from '@/lib/api/types'

export type LocalGymRow = {
  id: string
  kind: 'customer' | 'license-only'
  name: string
  owner: string
  contact: string
  customerStatus: string | null
  /** Control Plane display alias. created is remapped to pending_activation. */
  licenseStatus: string | null
  /** Backend license status with no UI alias. Use this in Operation Center. */
  apiLicenseStatus: string | null
  licenseId: string | null
  licenseKey: string | null
  licenseCount: number
  tenantId: string | null
  hasActiveInstall: boolean
  installations: string | null
  lastValidatedAtUtc: string | null
  installationStatus: string | null
  gymCode: string | null
  gymName: string | null
  appVersion: string | null
  openTickets: number
  href: string
}

export type LocalGymFilter = 'all' | 'not_live' | 'blocked' | 'prospect' | 'unlinked' | 'pending' | 'suspended'

const LICENSE_RANK: Record<string, number> = {
  active: 4,
  pending_activation: 3,
  created: 2,
  suspended: 1,
  revoked: 0,
}

function pickLicense(licenses: LocalLicenseListItemDto[]): LocalLicenseListItemDto | null {
  if (licenses.length === 0) return null
  return [...licenses].sort((a, b) => (LICENSE_RANK[b.status] ?? -1) - (LICENSE_RANK[a.status] ?? -1))[0] ?? null
}

function operatorLicenseStatus(status: string | null | undefined): string | null {
  if (!status) return null
  if (status === 'created') return 'pending_activation'
  return status
}

function waitingForFirstDevice(status: string | null): boolean {
  return !status || status === 'pending_activation' || status === 'created'
}

function toRow(
  base: Omit<LocalGymRow, 'licenseStatus' | 'apiLicenseStatus' | 'lastValidatedAtUtc' | 'installationStatus' | 'gymCode' | 'gymName' | 'appVersion'>,
  license: LocalLicenseListItemDto | null,
): LocalGymRow {
  const apiStatus = license?.status ?? null
  return {
    ...base,
    apiLicenseStatus: apiStatus,
    licenseStatus: operatorLicenseStatus(apiStatus),
    lastValidatedAtUtc: license?.lastValidatedAtUtc ?? null,
    installationStatus: license?.installationStatus ?? null,
    gymCode: license?.gymCode ?? null,
    gymName: license?.gymName ?? null,
    appVersion: license?.appVersion ?? null,
  }
}

export function joinLocalGymRows(
  customers: PlatformCustomerListItemDto[],
  licenses: LocalLicenseListItemDto[],
): LocalGymRow[] {
  const byCustomer = new Map<string, LocalLicenseListItemDto[]>()
  const unmatched: LocalLicenseListItemDto[] = []

  for (const license of licenses) {
    if (license.customerId) {
      const list = byCustomer.get(license.customerId) ?? []
      list.push(license)
      byCustomer.set(license.customerId, list)
    } else {
      unmatched.push(license)
    }
  }

  const rows: LocalGymRow[] = customers.map((customer) => {
    const customerLicenses = byCustomer.get(customer.id) ?? []
    const license = pickLicense(customerLicenses)
    return toRow(
      {
        id: customer.id,
        kind: 'customer',
        name: customer.businessName,
        owner: customer.ownerName,
        contact: customer.phone || customer.email || '',
        customerStatus: customer.status,
        licenseId: license?.id ?? null,
        licenseKey: license?.licenseKey ?? null,
        licenseCount: customerLicenses.length,
        tenantId: customer.tenantId ?? null,
        hasActiveInstall: (license?.activeInstallationCount ?? 0) > 0,
        installations: license ? `${license.activeInstallationCount} / ${license.deviceLimit}` : null,
        openTickets: customer.openTicketCount,
        href: `/oc/gyms/local/${customer.id}`,
      },
      license,
    )
  })

  for (const license of unmatched) {
    rows.push(
      toRow(
        {
          id: license.id,
          kind: 'license-only',
          name: license.customerName,
          owner: '',
          contact: '',
          customerStatus: null,
          licenseId: license.id,
          licenseKey: license.licenseKey,
          licenseCount: 1,
          tenantId: null,
          hasActiveInstall: license.activeInstallationCount > 0,
          installations: `${license.activeInstallationCount} / ${license.deviceLimit}`,
          openTickets: 0,
          href: `/oc/gyms/licenses/${license.id}`,
        },
        license,
      ),
    )
  }

  return rows
}

export function applyLocalGymFilter(rows: LocalGymRow[], filter: LocalGymFilter): LocalGymRow[] {
  if (filter === 'unlinked') return rows.filter((row) => row.kind === 'license-only')
  const customers = rows.filter((row) => row.kind === 'customer')
  if (filter === 'all') return customers
  if (filter === 'prospect') return customers.filter((row) => row.customerStatus === 'prospect')
  if (filter === 'pending') {
    return customers.filter((row) => {
      const raw = row.apiLicenseStatus ?? row.licenseStatus
      return raw === 'pending_activation' || raw === 'created' || (!raw && row.customerStatus !== 'prospect')
    })
  }
  if (filter === 'suspended') {
    return customers.filter((row) => row.licenseStatus === 'suspended' || row.licenseStatus === 'revoked')
  }
  if (filter === 'blocked') {
    return customers.filter(
      (row) =>
        row.licenseStatus === 'suspended' ||
        row.licenseStatus === 'revoked' ||
        row.customerStatus === 'inactive' ||
        row.customerStatus === 'churned',
    )
  }
  if (filter === 'not_live') {
    return customers.filter((row) => {
      const raw = row.apiLicenseStatus ?? row.licenseStatus
      return row.customerStatus === 'prospect' || waitingForFirstDevice(raw) || !row.hasActiveInstall
    })
  }
  return customers
}

export function filterLocalGymRows(rows: LocalGymRow[], query: string): LocalGymRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) =>
    [row.name, row.owner, row.contact, row.licenseKey, row.gymCode, row.gymName].some((value) => (value ?? '').toLowerCase().includes(q)),
  )
}
