import { cx } from '../lib'

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span className="ds-logo-mark" style={{ width: size, height: size }} aria-hidden>
      <img
        src="/ds/hymotion-mark-transparent.png"
        alt=""
        width={size}
        height={size}
      />
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('ds-wordmark', className)} aria-label="HyMotion">
      <span>Hy</span>Motion
    </span>
  )
}

export function LogoLockup({ compact = false, productLabel }: { compact?: boolean; productLabel?: string }) {
  const subtitle = productLabel?.trim()
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <LogoMark size={compact ? 28 : 36} />
      {compact ? null : (
        <span className="min-w-0">
          <Wordmark className="block text-[15px]" />
          {subtitle ? (
            <span className="block text-[11px] font-medium text-[var(--ds-text-muted)] truncate">{subtitle}</span>
          ) : null}
        </span>
      )}
    </span>
  )
}
