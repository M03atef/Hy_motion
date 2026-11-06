import type { ReactNode } from 'react'

export function DsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ds-card ${className}`.trim()}>{children}</div>
}

export function DsEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ds-empty">
      <strong>{title}</strong>
      {hint}
    </div>
  )
}

export function DsSkeleton({ className = '' }: { className?: string }) {
  return <span className={`ds-skeleton ${className}`.trim()} aria-hidden />
}

export function DsPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="ds-page-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
