import { describe, expect, it } from 'vitest'
import { sortStaffUsers, staffStatusLabel } from '@/features/tenants/StaffUsersPanel'
import type { TenantStaffDto } from '@/lib/api/types'

describe('StaffUsersPanel helpers', () => {
  const sample: TenantStaffDto[] = [
    { id: '3', fullName: 'Sara', email: 's@test.local', role: 'Trainer', isActive: true, createdAtUtc: '2026-01-01T00:00:00Z' },
    { id: '1', fullName: 'Ahmed', email: 'a@test.local', role: 'Owner', isActive: true, createdAtUtc: '2026-01-01T00:00:00Z' },
    { id: '2', fullName: 'Mohamed', email: 'm@test.local', role: 'Manager', isActive: false, createdAtUtc: '2026-01-01T00:00:00Z' },
    { id: '4', fullName: 'Zeinab', email: 'z@test.local', role: '', isActive: true, createdAtUtc: '2026-01-01T00:00:00Z' },
  ]

  it('orders Owner before Manager before Trainer, unknown roles last', () => {
    const sorted = sortStaffUsers(sample)
    expect(sorted.map((u) => u.fullName)).toEqual(['Ahmed', 'Mohamed', 'Sara', 'Zeinab'])
  })

  it('does not mutate the input array', () => {
    const copy = [...sample]
    sortStaffUsers(sample)
    expect(sample).toEqual(copy)
  })

  it('labels active/disabled plainly', () => {
    expect(staffStatusLabel(true)).toBe('Active')
    expect(staffStatusLabel(false)).toBe('Disabled')
  })
})
