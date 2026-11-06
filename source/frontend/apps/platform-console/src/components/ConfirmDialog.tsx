import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: 'danger' | 'default'
  busy?: boolean
  error?: string | null
  /** Disable confirm (e.g. validation failed). */
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}

/**
 * Modal dialog for Stage 2 write confirmations.
 * Native &lt;dialog&gt; — inherits OcShell DS tokens via CP→DS bridge under [data-oc].
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'default',
  busy = false,
  error = null,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="w-[min(100%,28rem)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-[var(--shadow-sm)] backdrop:bg-black/40 open:flex open:flex-col"
      onCancel={(e) => {
        if (busy) {
          e.preventDefault()
          return
        }
        onClose()
      }}
      onClick={(e) => {
        if (busy) return
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="flex flex-col gap-3 p-5" aria-busy={busy}>
        <h2 id={titleId} className="text-lg font-semibold text-[var(--text)]">
          {title}
        </h2>
        <div className="text-sm text-[var(--text-muted)]">{description}</div>
        {children}
        {error ? (
          <p
            role="alert"
            className="rounded border border-[var(--danger)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="cp-btn cp-btn-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
            className={`cp-btn disabled:opacity-50 ${
              confirmTone === 'danger' ? 'cp-btn-danger' : 'cp-btn-primary'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
