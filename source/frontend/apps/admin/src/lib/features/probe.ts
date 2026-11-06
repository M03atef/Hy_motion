import { api } from '@/lib/api/client'
import { parseApiErrorBody } from '@/lib/api/errors'

/** Modules gated by backend `[FeatureFlag(...)]`. Call Sheet is intentionally absent. */
export type FeatureModuleKey = 'sales' | 'shifts' | 'trials' | 'refunds' | 'debtors' | 'imports'

export const FEATURE_MODULES: FeatureModuleKey[] = [
  'sales',
  'shifts',
  'trials',
  'refunds',
  'debtors',
  'imports',
]

/**
 * Cheapest probe per module. Any non-FEATURE_DISABLED response means the module exists
 * (including 400/403 — flag is on, caller lacks data/permission).
 */
const PROBES: Record<
  FeatureModuleKey,
  { method: 'GET' | 'POST'; path: string; data?: unknown }
> = {
  sales: { method: 'GET', path: '/api/promo-codes?page=1&pageSize=1' },
  shifts: { method: 'GET', path: '/api/shifts/current' },
  trials: {
    method: 'POST',
    path: '/api/trials/confirm',
    data: { phoneNumber: '0000000000', otp: '000000' },
  },
  refunds: { method: 'GET', path: '/api/refunds' },
  debtors: { method: 'GET', path: '/api/debtors?page=1&pageSize=1' },
  imports: { method: 'GET', path: '/api/imports/template.xlsx' },
}

export async function probeModuleAvailable(module: FeatureModuleKey): Promise<boolean> {
  const probe = PROBES[module]
  try {
    const res = await api.request({
      method: probe.method,
      url: probe.path,
      data: probe.data,
      // Never throw — we need the body/status for FEATURE_DISABLED detection.
      validateStatus: () => true,
      // Avoid downloading full xlsx into memory as a parsed JSON failure.
      responseType: module === 'imports' ? 'blob' : 'json',
      timeout: 15_000,
    })

    if (res.status === 404) {
      // Blob probes won't have ProblemDetails JSON — treat plain 404 on imports carefully.
      if (module === 'imports') {
        // If feature disabled, API returns JSON ProblemDetails (not xlsx). Detect via content-type.
        const ct = String(res.headers?.['content-type'] ?? '')
        if (ct.includes('application/json')) {
          try {
            const text = await (res.data as Blob).text()
            const parsed = parseApiErrorBody(JSON.parse(text))
            if (parsed.code === 'FEATURE_DISABLED') return false
          } catch {
            /* ignore */
          }
        }
        // 404 without FEATURE_DISABLED (e.g. missing file) still means module route exists.
        return true
      }

      const parsed = parseApiErrorBody(res.data)
      if (parsed.code === 'FEATURE_DISABLED') return false
    }

    // Enabled: 200/400/401/403/409/etc. all mean the controller ran.
    return true
  } catch {
    // Network blip — do not hide the module; assume available until a definitive FEATURE_DISABLED.
    return true
  }
}

export async function probeAllModules(): Promise<Record<FeatureModuleKey, boolean>> {
  const entries = await Promise.all(
    FEATURE_MODULES.map(async (key) => [key, await probeModuleAvailable(key)] as const),
  )
  return Object.fromEntries(entries) as Record<FeatureModuleKey, boolean>
}
