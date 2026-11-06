import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Phase 5 legacy redirects', () => {
  const app = readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8')

  it('redirects legacy customer detail to Operation Center Local Gym360', () => {
    expect(app).toContain('path="/customers/:id"')
    expect(app).toContain('RedirectToLocalGym')
    expect(app).toContain('`/oc/gyms/local/${id}`')
  })

  it('redirects Control Plane support and playbooks into Operation Center', () => {
    expect(app).toContain('path="/support" element={<Navigate to="/oc/support" replace />}')
    expect(app).toContain('path="/ops-playbooks" element={<Navigate to="/oc/support/playbooks" replace />}')
    expect(app).toContain('RedirectToOcPlaybook')
    expect(app).toContain('`/oc/support/playbooks/${id}`')
  })

  it('sends legacy sales and cloud list aliases to Operation Center', () => {
    expect(app).toContain('path="/sales" element={<Navigate to="/oc/sales" replace />}')
    expect(app).toContain('path="/tenants" element={<Navigate to="/oc/gyms?mode=cloud" replace />}')
    expect(app).toContain('path="/risk-queue" element={<Navigate to="/oc/support/risk" replace />}')
  })

  it('redirects Control Plane gyms and settings into Operation Center', () => {
    expect(app).toContain('path="/gyms" element={<Navigate to="/oc/gyms" replace />}')
    expect(app).toContain('path="/settings/plans" element={<Navigate to="/oc/settings/plans" replace />}')
    expect(app).toContain('path="/settings/users" element={<Navigate to="/oc/settings/users" replace />}')
  })

  it('mounts Cloud Gym360 via TenantDetailPage under Support+ and redirects /tenants/:id', () => {
    expect(app).toContain('path="/tenants/:id"')
    expect(app).toContain('RedirectToCloudGym')
    expect(app).toContain('`/oc/gyms/cloud/${id}')
    expect(app).toMatch(/path="gyms\/cloud\/:id"[\s\S]*TenantDetailPage/)
    expect(app).toMatch(/path="gyms\/cloud\/:id"[\s\S]*OcRequireRole allow=\{isSupportOrAbove\}/)
    expect(app).not.toContain('CloudGymDetailPage')
  })

  it('mounts legacy GymsPage under /oc/gyms for Phase 4 cutover', () => {
    expect(app).toMatch(/path="gyms"\s+element=\{<GymsPage \/>\}/)
    expect(app).toContain("from '@/features/gyms/GymsPage'")
    expect(app).not.toContain('OcGymsPage')
  })

  it('uses LocalLicenseRedirect for legacy license detail URLs', () => {
    expect(app).toContain('path="/local-licenses/:id"')
    expect(app).toContain('LocalLicenseRedirect')
  })
})
