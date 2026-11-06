import { describe, expect, it } from 'vitest'
import { formatCairoDate, formatEgp, formatPercent } from '@/lib/format'

describe('format helpers', () => {
  it('formats money with thousands separators and EGP suffix', () => {
    expect(formatEgp(2199)).toBe('2,199.00 EGP')
    expect(formatEgp(0)).toBe('0.00 EGP')
  })

  it('formats DateOnly values', () => {
    expect(formatCairoDate('2026-08-28')).toMatch(/2026/)
  })

  it('formats percent rates (0–1 → %)', () => {
    expect(formatPercent(0.4)).toBe('40.0%')
    expect(formatPercent(0.033)).toBe('3.3%')
  })
})
