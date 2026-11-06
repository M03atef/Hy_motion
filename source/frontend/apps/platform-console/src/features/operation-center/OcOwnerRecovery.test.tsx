import { describe, expect, it } from 'vitest'
import { recoveryCopyKey } from './OcOwnerRecovery'

describe('OcOwnerRecovery status copy', () => {
  it('maps pending and terminal states without cryptographic terms', () => {
    expect(recoveryCopyKey('pending')).toBe('gyms.recoveryPending')
    expect(recoveryCopyKey('approved')).toBe('gyms.recoveryApproved')
    expect(recoveryCopyKey('completed')).toBe('gyms.recoveryCompleted')
    expect(recoveryCopyKey('rejected')).toBe('gyms.recoveryRejected')
    expect(recoveryCopyKey('expired')).toBe('gyms.recoveryExpired')
  })
})
