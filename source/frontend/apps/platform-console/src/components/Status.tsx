import { statusLabel, type Locale } from '@gymflowpro/i18n'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

const SUCCESS = new Set([
  'active',
  'paid',
  'resolved',
  'completed',
  'healthy',
  'issued',
])

const WARNING = new Set([
  'pending_activation',
  'pending',
  'past_due',
  'trialing',
  'unpaid',
  'partial',
  'waiting_customer',
  'watch',
  'at_risk',
  'high',
  'created',
  'in_progress',
  'prospect',
  'open',
  'approaching',
])

const DANGER = new Set([
  'suspended',
  'revoked',
  'critical',
  'churned',
  'failed',
  'overdue',
  'exceeded',
])

export function statusTone(code?: string | null): StatusTone {
  const key = (code ?? '').toLowerCase()
  if (SUCCESS.has(key)) return 'success'
  if (WARNING.has(key)) return 'warning'
  if (DANGER.has(key)) return 'danger'
  return 'neutral'
}

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'cp-status cp-status-success',
  warning: 'cp-status cp-status-warning',
  danger: 'cp-status cp-status-danger',
  neutral: 'cp-status cp-status-neutral',
}

function currentLocale(): Locale {
  if (typeof document === 'undefined') return 'en'
  return document.documentElement.getAttribute('data-locale') === 'ar' || document.documentElement.lang === 'ar'
    ? 'ar'
    : 'en'
}

export function StatusChip({ value }: { value?: string | null }) {
  if (!value) return <span className="text-[var(--text-faint)]">—</span>
  const labeled = statusLabel(value, currentLocale())
  const text = labeled && labeled !== value ? labeled : value.replace(/_/g, ' ')
  return (
    <span className={TONE_CLASS[statusTone(value)]}>
      <span className="cp-status-dot" aria-hidden />
      {text}
    </span>
  )
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <StatusChip value={status} />
}

export function RiskBandBadge({ band }: { band?: string | null }) {
  return <StatusChip value={band} />
}

export function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <span className="text-[var(--text-faint)]">—</span>
  return (
    <span className="cp-status cp-status-neutral">
      {tier}
    </span>
  )
}
