import { useState } from 'react'
import { useUiStore } from '@/stores/ui-store'

export function CommandBlock({
  label,
  text,
  n,
}: {
  label: string
  text: string
  n?: number
}) {
  const t = useUiStore((s) => s.t)
  const showToastKey = useUiStore((s) => s.showToastKey)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToastKey('ops.copied', 'success')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToastKey('ops.copyFailed', 'error')
    }
  }

  return (
    <div className="ops-cmd">
      <div className="ops-cmd-h">
        <span>
          {n != null ? <span className="ops-cmd-n">{n}</span> : null}
          {label}
        </span>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={() => void copy()}>
          {copied ? t('ops.copied') : t('ops.copyCommand')}
        </button>
      </div>
      <pre className="ops-path" dir="ltr">
        {text}
      </pre>
    </div>
  )
}
