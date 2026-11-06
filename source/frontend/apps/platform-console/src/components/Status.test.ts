import { describe, expect, it } from 'vitest'
import { statusTone } from './Status'

describe('statusTone', () => {
  it('maps operational statuses to four tones', () => {
    expect(statusTone('active')).toBe('success')
    expect(statusTone('pending_activation')).toBe('warning')
    expect(statusTone('created')).toBe('warning')
    expect(statusTone('suspended')).toBe('danger')
    expect(statusTone('cancelled')).toBe('neutral')
  })
})
