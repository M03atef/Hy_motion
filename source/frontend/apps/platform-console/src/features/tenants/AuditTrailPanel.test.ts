import { describe, expect, it } from 'vitest'
import {
  diffJson,
  extractReasonFromAudit,
  labelAuditAction,
} from '@/features/tenants/AuditTrailPanel'
import type { PlatformAuditLogDto } from '@/lib/api/types'
import { buildImpersonationAdminUrl, minutesUntil } from '@/stores/impersonation-session-store'

describe('audit trail helpers', () => {
  it('maps known action keys to readable labels', () => {
    expect(labelAuditAction('platform.tenant.impersonate')).toMatch(/impersonation/i)
    expect(labelAuditAction('platform.tenant.force_suspend')).toMatch(/Force-suspended/i)
  })

  it('extracts Reason from afterJson', () => {
    const row: PlatformAuditLogDto = {
      id: '1',
      actorPlatformUserId: 'a',
      action: 'platform.tenant.impersonate',
      createdAtUtc: '2026-08-04T00:00:00Z',
      afterJson: JSON.stringify({ Reason: 'Investigating invoice mismatch for owner', ExpiresAtUtc: 'x' }),
    }
    expect(extractReasonFromAudit(row)).toContain('invoice')
  })

  it('produces key-by-key diff ops', () => {
    const rows = diffJson(
      JSON.stringify({ Status: 'active', Price: 100 }),
      JSON.stringify({ Status: 'suspended', Price: 100, Reason: 'fraud' }),
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.op]))
    expect(byKey.Status).toBe('changed')
    expect(byKey.Price).toBe('same')
    expect(byKey.Reason).toBe('added')
  })
})

describe('impersonation handoff URL', () => {
  it('puts token in query string for new-tab open', () => {
    const url = buildImpersonationAdminUrl('tok.en.value')
    expect(url).toContain('impersonation_token=tok.en.value')
    expect(url).toContain('/app')
  })

  it('computes minutes remaining', () => {
    const expires = new Date(Date.now() + 14 * 60_000).toISOString()
    expect(minutesUntil(expires)).toBeGreaterThanOrEqual(13)
    expect(minutesUntil(expires)).toBeLessThanOrEqual(15)
  })
})
