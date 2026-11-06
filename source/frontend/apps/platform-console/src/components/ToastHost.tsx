import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui-store'

export function ToastHost() {
  const toast = useUiStore((s) => s.toast)
  const clearToast = useUiStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => clearToast(), toast.durationMs ?? 4000)
    return () => window.clearTimeout(id)
  }, [toast, clearToast])

  if (!toast) return null

  const tone =
    toast.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : toast.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-900'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 z-50 max-w-sm rounded-[var(--radius)] border px-4 py-3 text-sm shadow-[var(--shadow-sm)] [inset-inline-end:1rem] ${tone}`}
    >
      {toast.message}
    </div>
  )
}
