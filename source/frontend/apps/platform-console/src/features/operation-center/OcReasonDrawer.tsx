import type { ReactNode } from 'react'
import { Drawer, DsButton, TextAreaField } from '@/design-system'
import { MIN_REASON_LENGTH } from '@/lib/platform-roles'
import { useOcCopy } from './useOcCopy'

export function OcReasonDrawer({
  open,
  title,
  body,
  confirmLabel,
  tone = 'default',
  reason,
  onReasonChange,
  extra,
  confirmDisabled,
  error,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  reason: string
  onReasonChange: (value: string) => void
  extra?: ReactNode
  confirmDisabled?: boolean
  error?: string | null
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const t = useOcCopy()
  const ready = reason.trim().length >= MIN_REASON_LENGTH && !confirmDisabled
  return (
    <Drawer open={open} title={title} onClose={() => !loading && onClose()} closeLabel={t('common.close')}>
      <p className="m-0 text-[13.5px] text-[var(--ds-text-muted)]">{body}</p>
      {extra}
      <div className="mt-4">
        <TextAreaField
          label={t('gyms.reason')}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          disabled={loading}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--ds-status-danger)]">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <DsButton variant="secondary" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </DsButton>
        <DsButton variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={!ready} loading={loading}>
          {confirmLabel}
        </DsButton>
      </div>
    </Drawer>
  )
}
