import { describe, expect, it } from 'vitest'
import { isOpsOrAbove, isAdmin, validateReason, MIN_REASON_LENGTH } from '@/lib/platform-roles'

describe('platform role gating', () => {
  it('treats ops and admin as Ops+', () => {
    expect(isOpsOrAbove('platform_support')).toBe(false)
    expect(isOpsOrAbove('platform_ops')).toBe(true)
    expect(isOpsOrAbove('platform_admin')).toBe(true)
  })

  it('detects admin', () => {
    expect(isAdmin('platform_admin')).toBe(true)
    expect(isAdmin('platform_ops')).toBe(false)
  })

  it('requires audit reasons of sufficient length', () => {
    expect(validateReason('short')).toMatch(/at least/)
    expect(validateReason('x'.repeat(MIN_REASON_LENGTH))).toBeNull()
    expect(validateReason('   padded enough reason   ')).toBeNull()
  })
})
