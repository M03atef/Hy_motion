import type { StepStatus } from './types'

/** First step that is not completed. If all done, stay on the last step. */
export function firstIncompleteIndex(statuses: Array<StepStatus | undefined>): number {
  if (statuses.length === 0) return 0
  const i = statuses.findIndex((s) => s !== 'completed')
  return i === -1 ? statuses.length - 1 : i
}

export function clampStep(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}
