import { describe, expect, it } from 'vitest'
import { renewalModeFromValue } from './RenewalFilter'
import { cairoDatePlusDays } from '@/lib/format'

describe('renewalModeFromValue', () => {
  it('is "all" for an empty value', () => {
    expect(renewalModeFromValue('')).toBe('all')
  })

  it('recognizes the exact 7-day and 30-day thresholds', () => {
    expect(renewalModeFromValue(cairoDatePlusDays(7))).toBe('7')
    expect(renewalModeFromValue(cairoDatePlusDays(30))).toBe('30')
  })

  it('falls back to "custom" for any other date', () => {
    expect(renewalModeFromValue('2026-12-25')).toBe('custom')
  })
})
