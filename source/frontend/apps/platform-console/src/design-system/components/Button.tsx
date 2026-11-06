import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface DsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  iconOnly?: boolean
  children: ReactNode
}

export function DsButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: DsButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'ds-btn',
        `ds-btn--${variant}`,
        `ds-btn--${size}`,
        iconOnly && 'ds-btn--icon',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ds-spinner" aria-hidden /> : null}
      {children}
    </button>
  )
}

export function DsBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: ReactNode
}) {
  return (
    <span className={cx('ds-badge', `ds-badge--${tone}`)}>
      <span className="ds-badge-dot" aria-hidden />
      {children}
    </span>
  )
}

export function DsAlert({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}) {
  return (
    <div className={cx('ds-alert', `ds-alert--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="ds-badge-dot" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
