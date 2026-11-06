import { describe, expect, it } from 'vitest'
import { localLicenseRedirectPath } from './LocalLicenseRedirect'

describe('localLicenseRedirectPath', () => {
  it('sends linked licenses to Local Gym360', () => {
    expect(localLicenseRedirectPath({ id: 'lic-1', customerId: 'cust-1' })).toBe('/oc/gyms/local/cust-1')
  })

  it('sends unlinked licenses to the OC unlinked page', () => {
    expect(localLicenseRedirectPath({ id: 'lic-orphan', customerId: null })).toBe('/oc/gyms/licenses/lic-orphan')
    expect(localLicenseRedirectPath({ id: 'lic-orphan', customerId: undefined })).toBe('/oc/gyms/licenses/lic-orphan')
  })
})
