/** Mask transferable license secrets for Sales; Ops+ keep the full key for mutations. */
export function displayLicenseKey(
  key: string | null | undefined,
  opts: { revealFull: boolean },
): string {
  const value = (key ?? '').trim()
  if (!value) return '—'
  if (opts.revealFull) return value
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
