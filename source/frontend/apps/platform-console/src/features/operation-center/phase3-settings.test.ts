import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Phase 3 settings migration', () => {
  const app = readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8')
  const hub = readFileSync(path.resolve(__dirname, './pages/SettingsPage.tsx'), 'utf8')

  it('mounts full editors under /oc/settings (not read-only OC wrappers)', () => {
    expect(app).toMatch(/path="settings\/users"[\s\S]*PlatformUsersPage/)
    expect(app).toMatch(/path="settings\/plans"[\s\S]*PlansPage/)
    expect(app).toMatch(/path="settings\/catalog"[\s\S]*CatalogProductsPage/)
    expect(app).toMatch(/path="settings\/metrics"[\s\S]*MetricsPage/)
    expect(app).toMatch(/path="settings\/audit"[\s\S]*AuditLogPage/)
    expect(app).toMatch(/path="settings\/licenses"[\s\S]*IssueLicensePage/)
    expect(app).toMatch(/path="settings\/licenses\/manage"[\s\S]*LocalLicensesPage/)
    expect(app).toContain('SalesContractTermsPage')
    expect(app).not.toContain('AdministratorsPage')
    expect(app).not.toContain('PlansSettingsPage')
    expect(app).not.toContain('CatalogSettingsPage')
    expect(app).not.toContain('MetricsSettingsPage')
    expect(app).not.toContain('AuditSettingsPage')
  })

  it('gates Admin / Support+ / Ops+ settings editors on the OC routes', () => {
    expect(app).toMatch(/path="settings\/users"[\s\S]*OcRequireRole allow=\{isAdmin\}/)
    expect(app).toMatch(/path="settings\/audit"[\s\S]*OcRequireRole allow=\{isSupportOrAbove\}/)
    expect(app).toMatch(/path="settings\/licenses\/manage"[\s\S]*OcRequireRole allow=\{isOpsOrAbove\}/)
  })

  it('redirects legacy AppShell /settings/* into /oc/settings/*', () => {
    expect(app).toContain('path="/settings" element={<Navigate to="/oc/settings" replace />}')
    expect(app).toContain('path="/settings/users" element={<Navigate to="/oc/settings/users" replace />}')
    expect(app).toContain('path="/settings/plans" element={<Navigate to="/oc/settings/plans" replace />}')
    expect(app).toContain('path="/settings/catalog" element={<Navigate to="/oc/settings/catalog" replace />}')
    expect(app).toContain('path="/settings/metrics" element={<Navigate to="/oc/settings/metrics" replace />}')
    expect(app).toContain('path="/settings/audit" element={<Navigate to="/oc/settings/audit" replace />}')
    expect(app).toContain(
      'path="/settings/licenses" element={<Navigate to="/oc/settings/licenses/manage" replace />}',
    )
    expect(app).not.toContain('path="/settings" element={<SettingsHubPage />}')
    expect(app).not.toContain('path="/settings/plans" element={<PlansPage />}')
  })

  it('Settings hub exposes issue + manage license cards', () => {
    expect(hub).toContain("to: '/oc/settings/licenses'")
    expect(hub).toContain("to: '/oc/settings/licenses/manage'")
    expect(hub).toContain("t('settings.manageLicenses')")
  })
})
