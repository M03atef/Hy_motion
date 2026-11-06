import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Control Plane isolation', () => {
  it('does not import the design system from main.tsx', () => {
    const main = readFileSync(path.resolve(__dirname, '../../main.tsx'), 'utf8')
    expect(main).not.toMatch(/design-system/)
  })

  it('cuts the live default route over to Operation Center', () => {
    const app = readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8')
    expect(app).toMatch(/path="\/" element=\{<Navigate to="\/oc" replace \/>\}/)
    expect(app).toMatch(/path="\/oc"/)
    expect(app).toMatch(/path="\/gyms"/)
  })

  it('exposes Local operations on the gym detail summary view', () => {
    const page = readFileSync(path.resolve(__dirname, './pages/LocalGymDetailPage.tsx'), 'utf8')
    expect(page).toMatch(/OperationsPanel/)
    expect(page).toMatch(/recentOperations/)
    expect(page).toMatch(/selectedLicenseId/)
    expect(page).not.toMatch(/licenses\?\.\[0\]/)
    expect(page).not.toMatch(/profile\.license\?\.id \?\? /)
  })

  it('routes overview ticket rows to the existing ticket detail', () => {
    const page = readFileSync(path.resolve(__dirname, './pages/OverviewPage.tsx'), 'utf8')
    expect(page).toMatch(/\/oc\/support\/tickets\/\$\{row\.id\}/)
  })

  it('keeps unlinked license lifecycle operations visible', () => {
    const page = readFileSync(path.resolve(__dirname, './pages/UnlinkedLicensePage.tsx'), 'utf8')
    expect(page).toMatch(/recentOperations/)
    expect(page).toMatch(/'operations'/)
  })
})
