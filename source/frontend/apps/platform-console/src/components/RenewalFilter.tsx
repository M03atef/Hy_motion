import { cairoDatePlusDays } from '@/lib/format'

export type RenewalMode = 'all' | '7' | '30' | 'custom'

/** Derives the segmented-control mode from a raw renewingBefore value, for re-hydrating from the URL. */
export function renewalModeFromValue(value: string): RenewalMode {
  if (!value) return 'all'
  if (value === cairoDatePlusDays(7)) return '7'
  if (value === cairoDatePlusDays(30)) return '30'
  return 'custom'
}

interface RenewalFilterProps {
  /** The real renewingBefore value currently applied (yyyy-MM-dd), or '' for no filter. */
  value: string
  /** Called with the new renewingBefore value to send to the server ('' clears the filter). */
  onChange: (value: string) => void
}

/**
 * Renewal filter UI backed entirely by the real server-side `renewingBefore` query parameter —
 * never filters an already-fetched list client-side. "7 days" / "30 days" compute a concrete
 * date and send it straight through; "Custom" lets the operator pick any date.
 */
export function RenewalFilter({ value, onChange }: RenewalFilterProps) {
  const mode = renewalModeFromValue(value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-[var(--radius)] border border-gray-200 bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`rounded px-2.5 py-1 ${mode === 'all' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onChange(cairoDatePlusDays(7))}
          className={`rounded px-2.5 py-1 ${mode === '7' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Next 7 days
        </button>
        <button
          type="button"
          onClick={() => onChange(cairoDatePlusDays(30))}
          className={`rounded px-2.5 py-1 ${mode === '30' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Next 30 days
        </button>
        <button
          type="button"
          onClick={() => onChange(value || cairoDatePlusDays(30))}
          className={`rounded px-2.5 py-1 ${mode === 'custom' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Custom
        </button>
      </div>
      {mode === 'custom' ? (
        <label className="flex items-center gap-1.5 text-sm text-gray-500">
          Renewing before
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-[var(--radius)] border border-gray-300 bg-white px-2 py-1 text-gray-900"
          />
        </label>
      ) : null}
    </div>
  )
}
