const CAIRO_TZ = 'Africa/Cairo'

/** Cairo calendar today as yyyy-MM-dd (en-CA). */
export function cairoTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** First day of the current Cairo calendar month as yyyy-MM-dd. */
export function cairoMonthStartYmd(): string {
  const today = cairoTodayYmd()
  return `${today.slice(0, 8)}01`
}

/** Cairo-today + N calendar days, as yyyy-MM-dd — for renewingBefore-style date filters. */
export function cairoDatePlusDays(days: number): string {
  const [y, m, d] = cairoTodayYmd().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function formatPercent(rate: number | null | undefined, digits = 1): string {
  if (rate == null || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

export function formatEgp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `${new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} EGP`
}

export function formatCairoDate(value: string | null | undefined): string {
  if (!value) return '—'
  // DateOnly yyyy-MM-dd — treat as calendar date in Cairo
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: CAIRO_TZ,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(utc)
  }
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(dt)
}

export function formatCairoDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(dt)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt)
  return `${date} as of ${time}`
}
