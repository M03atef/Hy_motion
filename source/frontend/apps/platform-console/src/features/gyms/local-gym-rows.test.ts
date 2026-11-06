import { describe, expect, it } from 'vitest'
import { applyLocalGymFilter, filterLocalGymRows, joinLocalGymRows } from './local-gym-rows'
import type { LocalLicenseListItemDto, PlatformCustomerListItemDto } from '@/lib/api/types'

function customer(partial: Partial<PlatformCustomerListItemDto> & { id: string; businessName: string }): PlatformCustomerListItemDto {
  return {
    ownerName: 'Owner',
    status: 'active',
    openTicketCount: 0,
    createdAtUtc: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

function license(partial: Partial<LocalLicenseListItemDto> & { id: string; licenseKey: string }): LocalLicenseListItemDto {
  return {
    customerName: 'Gym',
    edition: 'Lifetime',
    status: 'active',
    deviceLimit: 1,
    activeInstallationCount: 1,
    createdAtUtc: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('joinLocalGymRows', () => {
  it('joins a customer to its preferred license and keeps unlinked licenses', () => {
    const rows = joinLocalGymRows(
      [customer({ id: 'c1', businessName: 'Pulse', ownerName: 'Amira', openTicketCount: 2, tenantId: 't1' })],
      [
        license({ id: 'l-old', licenseKey: 'OLD', customerId: 'c1', status: 'created' }),
        license({ id: 'l-live', licenseKey: 'LIVE', customerId: 'c1', status: 'active', activeInstallationCount: 1, deviceLimit: 2, gymCode: 'GYM-PULSE', gymName: 'Pulse Downtown' }),
        license({ id: 'l-orphan', licenseKey: 'ORPH', customerName: 'Walk-in' }),
      ],
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      kind: 'customer',
      name: 'Pulse',
      licenseKey: 'LIVE',
      licenseCount: 2,
      tenantId: 't1',
      installations: '1 / 2',
      gymCode: 'GYM-PULSE',
      gymName: 'Pulse Downtown',
      openTickets: 2,
      href: '/oc/gyms/local/c1',
    })
    expect(rows[1]).toMatchObject({
      kind: 'license-only',
      name: 'Walk-in',
      href: '/oc/gyms/licenses/l-orphan',
    })
  })

  it('hides unlinked licenses unless that filter is selected', () => {
    const rows = joinLocalGymRows(
      [customer({ id: 'c1', businessName: 'Pulse' })],
      [license({ id: 'l-orphan', licenseKey: 'ORPH', customerName: 'Walk-in' })],
    )
    expect(applyLocalGymFilter(rows, 'all')).toHaveLength(1)
    expect(applyLocalGymFilter(rows, 'unlinked')).toHaveLength(1)
    expect(applyLocalGymFilter(rows, 'unlinked')[0]?.kind).toBe('license-only')
  })

  it('treats created as waiting-for-PC and filters not-live / prospects', () => {
    const rows = joinLocalGymRows(
      [
        customer({ id: 'c1', businessName: 'Waiting', status: 'active' }),
        customer({ id: 'c2', businessName: 'Prospect', status: 'prospect' }),
      ],
      [license({ id: 'l1', licenseKey: 'WAIT', customerId: 'c1', status: 'created', activeInstallationCount: 0 })],
    )
    expect(rows[0]?.licenseStatus).toBe('pending_activation')
    expect(rows[0]?.apiLicenseStatus).toBe('created')
    expect(applyLocalGymFilter(rows, 'pending').map((r) => r.id)).toEqual(['c1'])
    expect(applyLocalGymFilter(rows, 'prospect').map((r) => r.id)).toEqual(['c2'])
    expect(applyLocalGymFilter(rows, 'not_live').map((r) => r.id).sort()).toEqual(['c1', 'c2'])
  })

  it('pending includes customers with no license and is not first-device-only', () => {
    const rows = joinLocalGymRows(
      [
        customer({ id: 'c-none', businessName: 'NoLicense', status: 'active' }),
        customer({ id: 'c-pro', businessName: 'Prospect', status: 'prospect' }),
        customer({ id: 'c-wait', businessName: 'Waiting', status: 'active' }),
      ],
      [
        license({
          id: 'l1',
          licenseKey: 'WAIT',
          customerId: 'c-wait',
          status: 'pending_activation',
          activeInstallationCount: 0,
        }),
      ],
    )
    expect(applyLocalGymFilter(rows, 'pending').map((r) => r.id).sort()).toEqual(['c-none', 'c-wait'])
  })

  it('filters by gym, owner, or license key', () => {
    const rows = joinLocalGymRows(
      [customer({ id: 'c1', businessName: 'Pulse Fitness', ownerName: 'Amira' })],
      [license({ id: 'l1', licenseKey: 'HM-1', customerId: 'c1' })],
    )
    expect(filterLocalGymRows(rows, 'amira')).toHaveLength(1)
    expect(filterLocalGymRows(rows, 'HM-1')).toHaveLength(1)
    expect(filterLocalGymRows(rows, 'zzz')).toHaveLength(0)
  })
})
