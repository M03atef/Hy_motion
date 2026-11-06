import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Local Gym360 Summary cleanup guardrails', () => {
  const page = readFileSync(path.resolve(__dirname, './LocalGymDetailPage.tsx'), 'utf8')

  it('header has one Open Sales CTA and does not mount OcLicenseActions in header actions', () => {
    expect(page).toContain("t('gyms.openSalesForContract')")
    expect(page).not.toContain("t('gyms.printContract')")
    // License actions live under License & PC, not beside DsPageHeader actions
    const headerBlock = page.slice(page.indexOf('<DsPageHeader'), page.indexOf('<OcTabs'))
    expect(headerBlock).not.toContain('OcLicenseActions')
    expect(page).toContain("t('gyms.section.licensePc')")
    expect(page).toContain('<OcLicenseActions')
  })

  it('Summary keeps agreed section order keys', () => {
    const identity = page.indexOf("t('gyms.section.identity')")
    const people = page.indexOf("t('gyms.section.people')")
    const snapshot = page.indexOf("t('gyms.section.snapshot')")
    const license = page.indexOf("t('gyms.section.licensePc')")
    const installs = page.indexOf("t('gyms.section.installsOps')")
    expect(identity).toBeGreaterThan(0)
    expect(people).toBeGreaterThan(identity)
    expect(snapshot).toBeGreaterThan(people)
    expect(license).toBeGreaterThan(snapshot)
    expect(installs).toBeGreaterThan(license)
    expect(page).toContain('oc-facts')
    expect(page).toContain('oc-metrics')
    expect(page).not.toContain('oc-summary-hint')
  })

  it('does not dump raw ownerAccountStatus into People card', () => {
    expect(page).toContain('ownerAccountLogin')
    expect(page).toContain('ownerAccountStatus')
    expect(page).toContain('OWNER_STATUS_KEYS')
    expect(page).not.toMatch(/formatOwnerAccount\(customer/)
  })
})
