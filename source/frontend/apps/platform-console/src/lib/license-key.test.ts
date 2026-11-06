import { describe, expect, it } from 'vitest'
import { displayLicenseKey } from './license-key'

describe('displayLicenseKey', () => {
  it('reveals the full key for Ops+', () => {
    expect(displayLicenseKey('HY-LCL-AAAAA-BBBBB', { revealFull: true })).toBe('HY-LCL-AAAAA-BBBBB')
  })

  it('masks the middle for Sales', () => {
    expect(displayLicenseKey('HY-LCL-AAAAA-BBBBB', { revealFull: false })).toBe('HY-LCL…BBBB')
  })
})
