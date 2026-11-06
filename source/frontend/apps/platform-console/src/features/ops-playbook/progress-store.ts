import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CaseStatus, StepStatus } from './types'

export interface PlaybookProgress {
  caseStatus: CaseStatus
  steps: Record<string, StepStatus>
  closure: Record<string, boolean>
}

interface ProgressState {
  byId: Record<string, PlaybookProgress>
  theme: 'light' | 'dark'
  audience: 'customer' | 'support'
  get: (playbookId: string) => PlaybookProgress
  setCaseStatus: (playbookId: string, status: CaseStatus) => void
  setStepStatus: (playbookId: string, stepId: string, status: StepStatus) => void
  toggleClosure: (playbookId: string, itemId: string) => void
  reset: (playbookId: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  setAudience: (audience: 'customer' | 'support') => void
}

export const EMPTY_PROGRESS: PlaybookProgress = {
  caseStatus: 'not_started',
  steps: {},
  closure: {},
}

export function emptyProgress(): PlaybookProgress {
  return { caseStatus: 'not_started', steps: {}, closure: {} }
}

export function selectProgress(byId: Record<string, PlaybookProgress>, playbookId: string): PlaybookProgress {
  return byId[playbookId] ?? EMPTY_PROGRESS
}

export const usePlaybookProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      byId: {},
      theme: 'light',
      audience: 'customer',
      get: (playbookId) => get().byId[playbookId] ?? EMPTY_PROGRESS,
      setCaseStatus: (playbookId, status) =>
        set((s) => ({
          byId: {
            ...s.byId,
            [playbookId]: { ...emptyProgress(), ...s.byId[playbookId], caseStatus: status },
          },
        })),
      setStepStatus: (playbookId, stepId, status) =>
        set((s) => {
          const cur = s.byId[playbookId] ?? emptyProgress()
          return {
            byId: {
              ...s.byId,
              [playbookId]: { ...cur, steps: { ...cur.steps, [stepId]: status } },
            },
          }
        }),
      toggleClosure: (playbookId, itemId) =>
        set((s) => {
          const cur = s.byId[playbookId] ?? emptyProgress()
          return {
            byId: {
              ...s.byId,
              [playbookId]: {
                ...cur,
                closure: { ...cur.closure, [itemId]: !cur.closure[itemId] },
              },
            },
          }
        }),
      reset: (playbookId) =>
        set((s) => {
          const next = { ...s.byId }
          delete next[playbookId]
          return { byId: next }
        }),
      setTheme: (theme) => set({ theme }),
      setAudience: (audience) => set({ audience }),
    }),
    { name: 'gymflowpro.platform.ops-playbook', partialize: (s) => ({ byId: s.byId, theme: s.theme, audience: s.audience }) },
  ),
)
