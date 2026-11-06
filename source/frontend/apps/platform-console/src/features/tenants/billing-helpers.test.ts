import { describe, expect, it } from 'vitest'
import { computeOutstandingEgp, findLastInvoice } from './billing-helpers'
import type { PlatformInvoiceDto } from '@/lib/api/types'

function invoice(overrides: Partial<PlatformInvoiceDto> = {}): PlatformInvoiceDto {
  return {
    id: '1',
    tenantId: 't1',
    subscriptionId: 's1',
    invoiceNumber: 'INV-1',
    periodStart: '2026-07-12',
    periodEnd: '2026-08-12',
    subtotal: 1999,
    vatAmount: 0,
    total: 1999,
    currency: 'EGP',
    status: 'paid',
    dueDate: '2026-08-12',
    createdAtUtc: '2026-07-12T00:00:00Z',
    ...overrides,
  }
}

describe('computeOutstandingEgp', () => {
  it('is 0 when there are no invoices', () => {
    expect(computeOutstandingEgp([])).toBe(0)
  })

  it('excludes paid and voided invoices', () => {
    const invoices = [invoice({ status: 'paid', total: 100 }), invoice({ status: 'voided', total: 50 })]
    expect(computeOutstandingEgp(invoices)).toBe(0)
  })

  it('sums issued and overdue invoices', () => {
    const invoices = [
      invoice({ status: 'issued', total: 200 }),
      invoice({ status: 'overdue', total: 300 }),
      invoice({ status: 'paid', total: 999 }),
    ]
    expect(computeOutstandingEgp(invoices)).toBe(500)
  })
})

describe('findLastInvoice', () => {
  it('returns null for an empty list', () => {
    expect(findLastInvoice([])).toBeNull()
  })

  it('returns the invoice with the latest period end', () => {
    const older = invoice({ id: 'a', periodEnd: '2026-07-12' })
    const newer = invoice({ id: 'b', periodEnd: '2026-08-12' })
    expect(findLastInvoice([older, newer])?.id).toBe('b')
  })
})
