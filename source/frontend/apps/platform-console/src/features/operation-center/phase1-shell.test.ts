import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Phase 1 shell + brand unification', () => {
  const shell = readFileSync(path.resolve(__dirname, './OcShell.tsx'), 'utf8')
  const login = readFileSync(path.resolve(__dirname, '../auth/LoginPage.tsx'), 'utf8')
  const i18n = readFileSync(path.resolve(__dirname, './i18n.ts'), 'utf8')
  const banner = readFileSync(path.resolve(__dirname, '../../components/ImpersonationSessionBanner.tsx'), 'utf8')

  it('mounts impersonation banner on the canonical HyMotion shell', () => {
    expect(shell).toContain('ImpersonationSessionBanner')
  })

  it('uses HyMotion as the shell product label', () => {
    expect(i18n).toMatch(/'shell\.product':\s*\{\s*en:\s*'HyMotion'/)
  })

  it('Login uses AuthChrome / design-system identity', () => {
    expect(login).toContain('AuthChrome')
    expect(login).toContain("from '@/design-system'")
    expect(login).not.toContain('InternalStrip')
    expect(login).not.toContain('cp-btn')
  })

  it('impersonation banner ends session and has no dismiss affordance', () => {
    expect(banner).toContain('End session')
    expect(banner).toContain('endSession')
    expect(banner).not.toContain('Dismiss indicator')
  })
})
