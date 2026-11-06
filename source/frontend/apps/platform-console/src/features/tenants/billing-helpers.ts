import type { PlatformInvoiceDto } from '@/lib/api/types'

const TERMINAL_STATUSES = new Set(['paid', 'voided'])

/**
 * Sum of invoice totals not yet resolved (not paid, not voided) — derived client-side from the
 * real invoice list. There is no dedicated "outstanding balance" endpoint; this is the honest
 * way to compute it from data that already exists.
 */
export function computeOutstandingEgp(invoices: PlatformInvoiceDto[]): number {
  return invoices
    .filter((inv) => !TERMINAL_STATUSES.has(inv.status))
    .reduce((sum, inv) => sum + inv.total, 0)
}

/** Most recent invoice by period end — null when there are none yet. */
export function findLastInvoice(invoices: PlatformInvoiceDto[]): PlatformInvoiceDto | null {
  if (!invoices.length) return null
  return [...invoices].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null
}
