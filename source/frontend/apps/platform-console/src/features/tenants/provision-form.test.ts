import { describe, expect, it } from 'vitest'
import { emptyProvisionForm, validateProvisionForm } from './provision-form'
import { isOpsOrAbove } from '@/lib/platform-roles'

describe('provision form validation', () => {
  it('requires core fields and password min 8', () => {
    const result = validateProvisionForm(emptyProvisionForm())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.name).toBeTruthy()
    expect(result.errors.city).toBeTruthy()
    expect(result.errors.ownerPassword).toBeTruthy()
  })

  it('rejects short password and bad emails', () => {
    const result = validateProvisionForm({
      ...emptyProvisionForm(),
      name: 'New Gym',
      city: 'Cairo',
      phoneNumber: '+201000000000',
      email: 'not-an-email',
      ownerFullName: 'Owner',
      ownerEmail: 'also-bad',
      ownerPassword: 'short',
      tier: 'growth',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.email).toMatch(/valid/i)
    expect(result.errors.ownerEmail).toMatch(/valid/i)
    expect(result.errors.ownerPassword).toMatch(/8/)
  })

  it('builds body omitting blank optionals (never invents password)', () => {
    const result = validateProvisionForm({
      ...emptyProvisionForm(),
      name: 'New Gym',
      city: 'Cairo',
      phoneNumber: '+201000000000',
      email: 'gym@example.com',
      ownerFullName: 'Owner One',
      ownerEmail: 'owner@example.com',
      ownerPassword: 'SecurePass1',
      gymCode: '',
      tier: 'pro',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.gymCode).toBeUndefined()
    expect(result.body.tier).toBe('pro')
    expect(result.body.ownerPassword).toBe('SecurePass1')
    expect(JSON.stringify(result.body)).not.toMatch(/localStorage/i)
  })
})

describe('provision role gate', () => {
  it('Support cannot provision; Ops and Admin can', () => {
    expect(isOpsOrAbove('platform_support')).toBe(false)
    expect(isOpsOrAbove('platform_ops')).toBe(true)
    expect(isOpsOrAbove('platform_admin')).toBe(true)
  })
})
