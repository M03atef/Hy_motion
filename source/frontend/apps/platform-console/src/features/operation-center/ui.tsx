import type { ReactNode } from 'react'
import { DsAlert, DsButton, DsEmptyState, DsSkeleton } from '@/design-system'
import { ApiClientError } from '@/lib/api/errors'
import { useOcCopy } from './useOcCopy'

export function OcId({ value }: { value?: string | null }) {
  if (!value) return <span className="text-[var(--ds-text-faint)]">—</span>
  return <span className="oc-mono">{value}</span>
}

export function OcUnavailable({ title, source, detail }: { title: string; source: string; detail?: string }) {
  const t = useOcCopy()
  return (
    <DsEmptyState
      title={title}
      hint={[detail, `${t('errors.source')}: ${source}`].filter(Boolean).join(' ')}
    />
  )
}

export function OcLoadError({
  error,
  source,
  onRetry,
}: {
  error: unknown
  source: string
  onRetry: () => void
}) {
  const t = useOcCopy()
  const forbidden = error instanceof ApiClientError && error.status === 403
  const message = error instanceof ApiClientError ? error.message : t('errors.generic')
  return (
    <DsAlert tone="danger">
      <div>{forbidden ? t('errors.forbidden') : message}</div>
      <div className="oc-source">
        {t('errors.source')}: {source}
      </div>
      <div className="mt-2">
        <DsButton variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </DsButton>
      </div>
    </DsAlert>
  )
}

export function OcSkeletons({ rows = 4 }: { rows?: number }) {
  return (
    <div className="oc-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <DsSkeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function OcTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div className="oc-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function OcSection({ children }: { children: ReactNode }) {
  return <div className="oc-stack">{children}</div>
}
