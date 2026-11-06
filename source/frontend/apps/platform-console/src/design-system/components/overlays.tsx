import { useEffect, useId, useRef, type ReactNode } from 'react'
import { DsButton } from './Button'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="ds-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="ds-dialog-body">
        <h2 id={titleId}>{title}</h2>
        <p className="m-0 text-[13.5px] text-[var(--ds-text-muted)]">{body}</p>
        <div className="mt-2 flex justify-end gap-2">
          <DsButton variant="secondary" onClick={onClose}>
            {cancelLabel}
          </DsButton>
          <DsButton variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </DsButton>
        </div>
      </div>
    </dialog>
  )
}

export function Drawer({
  open,
  title,
  children,
  onClose,
  closeLabel = 'Close',
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeLabel?: string
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className="ds-drawer-root" hidden={!open}>
      <button type="button" className="ds-drawer-backdrop" aria-label={closeLabel} onClick={onClose} />
      <aside className="ds-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="m-0 text-lg font-bold">
            {title}
          </h2>
          <DsButton variant="ghost" size="sm" onClick={onClose}>
            {closeLabel}
          </DsButton>
        </div>
        {children}
      </aside>
    </div>
  )
}

export function ActionMenu({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={ref} className="ds-menu" role="menu">
      {children}
    </div>
  )
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="ds-tooltip group">
      <span aria-describedby={id}>{children}</span>
      <span id={id} role="tooltip" className="ds-tooltip-bubble hidden group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  )
}

export interface ToastItem {
  id: number
  tone: 'success' | 'danger'
  message: string
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="ds-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="ds-toast"
          style={{
            borderColor: toast.tone === 'success' ? 'var(--ds-status-success-border)' : 'var(--ds-status-danger-border)',
            color: toast.tone === 'success' ? 'var(--ds-status-success)' : 'var(--ds-status-danger)',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
