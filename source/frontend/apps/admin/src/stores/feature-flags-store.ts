import { create } from 'zustand'
import {
  FEATURE_MODULES,
  probeAllModules,
  type FeatureModuleKey,
} from '@/lib/features/probe'

type ModuleMap = Record<FeatureModuleKey, boolean>

function defaultAvailable(): ModuleMap {
  return {
    sales: true,
    shifts: true,
    trials: true,
    refunds: true,
    debtors: true,
    imports: true,
  }
}

interface FeatureFlagsState {
  status: 'idle' | 'probing' | 'ready'
  modules: ModuleMap
  lastProbedAt: string | null
  /** Probe once per session (no-op if already ready/probing unless `force`). */
  ensureProbed: (force?: boolean) => Promise<void>
  isModuleAvailable: (key: FeatureModuleKey) => boolean
  reset: () => void
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  status: 'idle',
  modules: defaultAvailable(),
  lastProbedAt: null,

  ensureProbed: async (force = false) => {
    const { status } = get()
    if (!force && (status === 'ready' || status === 'probing')) return

    set({ status: 'probing' })
    try {
      const modules = await probeAllModules()
      set({
        modules,
        status: 'ready',
        lastProbedAt: new Date().toISOString(),
      })
    } catch {
      // Fail open — keep defaults (all true) so nav isn't wiped by a probe crash.
      set({ status: 'ready', lastProbedAt: new Date().toISOString() })
    }
  },

  isModuleAvailable: (key) => get().modules[key] !== false,

  reset: () =>
    set({
      status: 'idle',
      modules: defaultAvailable(),
      lastProbedAt: null,
    }),
}))

export function isFeatureModule(key: string): key is FeatureModuleKey {
  return (FEATURE_MODULES as string[]).includes(key)
}
