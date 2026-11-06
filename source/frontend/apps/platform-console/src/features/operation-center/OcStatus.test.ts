import { describe, expect, it } from 'vitest'
import { licenseStatusExplanation } from './OcStatus'
import { statusTone } from '@/components/Status'

describe('OcLicenseStatus', () => {
  it('keeps backend codes and explains them without inventing a second lifecycle', () => {
    expect(licenseStatusExplanation('created', 'en')).toBe('Issued — waiting for first device')
    expect(licenseStatusExplanation('pending_activation', 'en')).toBe('Issued — waiting for first device')
    expect(licenseStatusExplanation('active', 'en')).toBe('Active')
    expect(licenseStatusExplanation('suspended', 'en')).toBe('Suspended')
    expect(licenseStatusExplanation('revoked', 'en')).toBe('Revoked')
    expect(licenseStatusExplanation('created', 'ar')).toBe('صدرت — في انتظار أول جهاز')
  })

  it('uses Design System status tones and never lime', () => {
    expect(statusTone('created')).toBe('warning')
    expect(statusTone('pending_activation')).toBe('warning')
    expect(statusTone('active')).toBe('success')
    expect(statusTone('suspended')).toBe('danger')
    expect(statusTone('revoked')).toBe('danger')
  })
})
