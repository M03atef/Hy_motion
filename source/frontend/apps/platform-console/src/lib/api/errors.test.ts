import { describe, expect, it } from 'vitest'
import { parsePlatformError } from '@/lib/api/errors'

describe('parsePlatformError', () => {
  it('appends detail when message is a generic provision failure', () => {
    const err = parsePlatformError(
      {
        errorCode: 'PROVISION_FAILED',
        message: 'Provisioning failed / فشل إنشاء الصالة',
        detail: "Invalid column name 'ImpersonatedByPlatformUserId'.",
      },
      400,
    )
    expect(err.errorCode).toBe('PROVISION_FAILED')
    expect(err.message).toContain('Provisioning failed')
    expect(err.message).toContain('ImpersonatedByPlatformUserId')
    expect(err.detail).toContain('ImpersonatedByPlatformUserId')
  })
})
