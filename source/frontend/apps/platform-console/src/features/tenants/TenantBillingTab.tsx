import type { PlatformInvoiceDto, SubscriptionStatusDto } from '@/lib/api/types'
import { StatusBadge } from '@/components/Badges'
import { computeOutstandingEgp, findLastInvoice } from './billing-helpers'
import { formatCairoDate, formatCairoDateTime, formatEgp } from '@/lib/format'

interface TenantBillingTabProps {
  subscription: SubscriptionStatusDto | null | undefined
  invoicesQuery: {
    isLoading: boolean
    isError: boolean
    data: PlatformInvoiceDto[] | undefined
  }
}

export function TenantBillingTab({ subscription, invoicesQuery }: TenantBillingTabProps) {
  const invoices = invoicesQuery.data ?? []
  const outstanding = computeOutstandingEgp(invoices)
  const lastInvoice = findLastInvoice(invoices)

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
            Outstanding
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              Derived
            </span>
          </div>
          <div className={`mt-1 text-xl font-semibold tabular-nums ${outstanding > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
            {invoicesQuery.isLoading ? '—' : formatEgp(outstanding)}
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Last Invoice</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
            {lastInvoice ? formatEgp(lastInvoice.total) : '—'}
          </div>
          {lastInvoice ? (
            <div className="mt-0.5 text-xs text-gray-500">{formatCairoDate(lastInvoice.periodEnd)}</div>
          ) : null}
        </div>
        <div className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
            Next Invoice
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              Estimated
            </span>
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
            {subscription ? formatEgp(subscription.priceEgp) : '—'}
          </div>
          {subscription ? (
            <div className="mt-0.5 text-xs text-gray-500">{formatCairoDate(subscription.currentPeriodEnd)}</div>
          ) : null}
        </div>
      </section>
      <p className="text-xs text-gray-500">
        Outstanding and Next Invoice are computed here from the real invoice list and subscription
        record — there is no dedicated billing-aggregate endpoint. Next Invoice assumes the current
        price and period continue unchanged; it is not a generated invoice.
      </p>

      <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium">Invoice History</h2>
        {invoicesQuery.isLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded bg-gray-200" />
        ) : invoicesQuery.isError ? (
          <p className="mt-2 text-sm text-red-600">Failed to load invoices.</p>
        ) : !invoices.length ? (
          <p className="mt-2 text-sm text-gray-500">No platform invoices yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="px-2 py-1">Invoice</th>
                  <th className="px-2 py-1">Period</th>
                  <th className="px-2 py-1">Total</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Due</th>
                  <th className="px-2 py-1">Paid</th>
                  <th className="px-2 py-1">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-200">
                    <td className="px-2 py-2 font-[var(--mono)]">{inv.invoiceNumber}</td>
                    <td className="px-2 py-2">
                      {formatCairoDate(inv.periodStart)} – {formatCairoDate(inv.periodEnd)}
                    </td>
                    <td className="px-2 py-2">{formatEgp(inv.total)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-2 py-2">{formatCairoDate(inv.dueDate)}</td>
                    <td className="px-2 py-2">{inv.paidAtUtc ? formatCairoDateTime(inv.paidAtUtc) : '—'}</td>
                    <td className="px-2 py-2">
                      {inv.pdfUrl ? (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                          View PDF
                        </a>
                      ) : (
                        <span className="text-gray-500">Not ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
