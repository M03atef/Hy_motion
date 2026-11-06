import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="cp-page-header">
      <div>
        <h1 className="cp-page-title">{title}</h1>
        {subtitle ? <p className="cp-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="cp-page-actions">{actions}</div> : null}
    </header>
  )
}
