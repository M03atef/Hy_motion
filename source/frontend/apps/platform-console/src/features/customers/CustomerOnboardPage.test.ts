import { describe, expect, it } from 'vitest'
import {
  appendLicenseSkipNote,
  findSimilarCustomers,
  normalizeCustomerMatch,
  onboardBackPath,
  onboardFinishPath,
} from './CustomerOnboardPage'

describe('customer onboard helpers', () => {
  it('appends a skip note without dropping existing customer notes', () => {
    expect(appendLicenseSkipNote(null, '  Ops will issue after cash clears  ')).toBe(
      'License skipped during onboard: Ops will issue after cash clears',
    )
    expect(appendLicenseSkipNote('Called owner', 'Ops will issue after cash clears')).toBe(
      'Called owner\nLicense skipped during onboard: Ops will issue after cash clears',
    )
  })

  it('hands operators to Operation Center Local gym 360 after onboard', () => {
    expect(onboardBackPath('/oc/sales/onboard')).toBe('/oc/sales')
    expect(onboardFinishPath('/oc/sales/onboard', 'c1')).toBe('/oc/gyms/local/c1')
    expect(onboardBackPath('/sales/onboard')).toBe('/oc/sales')
    expect(onboardFinishPath('/sales/onboard', 'c1')).toBe('/oc/gyms/local/c1')
  })

  it('flags soft duplicate customers by normalized name, phone, or email', () => {
    const rows = [
      {
        id: '1',
        businessName: 'Gold Fitness',
        ownerName: 'A',
        phone: '0100-111-2222',
        email: 'gold@example.com',
        status: 'prospect',
        openTicketCount: 0,
        createdAtUtc: '',
      },
    ]
    expect(normalizeCustomerMatch('  Gold   Fitness ')).toBe('gold fitness')
    expect(findSimilarCustomers(rows, { businessName: 'gold fitness' })).toHaveLength(1)
    expect(findSimilarCustomers(rows, { businessName: 'Other', phone: '01001112222' })).toHaveLength(1)
    expect(findSimilarCustomers(rows, { businessName: 'Other', email: 'GOLD@example.com' })).toHaveLength(1)
    expect(findSimilarCustomers(rows, { businessName: 'Other' })).toHaveLength(0)
  })
})
