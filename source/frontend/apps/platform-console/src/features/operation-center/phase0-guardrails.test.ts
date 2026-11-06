import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('Phase 0 consolidation guardrails', () => {
  const app = readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8')
  const login = readFileSync(path.resolve(__dirname, '../../features/auth/LoginPage.tsx'), 'utf8')
  const support = readFileSync(
    path.resolve(__dirname, './pages/SupportPage.tsx'),
    'utf8',
  )

  it('gates Feedback inbox behind Support+ on the route', () => {
    expect(app).toMatch(/path="support\/feedback"[\s\S]*OcRequireRole allow=\{isSupportOrAbove\}/)
  })

  it('sends /metrics into OC settings (not AppShell /settings/metrics)', () => {
    expect(app).toContain('path="/metrics" element={<Navigate to="/oc/settings/metrics" replace />}')
    expect(app).not.toContain('path="/metrics" element={<Navigate to="/settings/metrics" replace />}')
  })

  it('removes dual-product InternalStrip from Login', () => {
    expect(login).not.toContain('InternalStrip')
    expect(login).toContain('AuthChrome')
  })

  it('retires AppShell and InternalStrip with zero live imports', () => {
    expect(app).not.toContain('AppShell')
    expect(app).not.toContain('InternalStrip')
    expect(existsSync(path.resolve(__dirname, '../../layout/AppShell.tsx'))).toBe(false)
    expect(existsSync(path.resolve(__dirname, '../../components/InternalStrip.tsx'))).toBe(false)
    expect(existsSync(path.resolve(__dirname, '../../config/nav.ts'))).toBe(false)
  })

  it('hides Feedback nav chip for roles below Support+', () => {
    expect(support).toContain('canFeedback')
    expect(support).toContain('isSupportOrAbove(role)')
  })
})
