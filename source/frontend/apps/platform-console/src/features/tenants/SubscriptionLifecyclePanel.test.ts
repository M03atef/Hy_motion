import { describe, expect, it } from 'vitest'

/** Action availability mirrors ActionsPanel guards — lifecycle-specific matrix. */
function actionAvailability(status: string | undefined, cancelAtPeriodEnd: boolean) {
  const s = status ?? ''
  return {
    canConvertTrial: s === 'trialing',
    canRestartPaid: s === 'cancelled',
    canStartTrial: !s || s === 'cancelled',
    canUndoCancel:
      (s === 'active' || s === 'past_due' || s === 'trialing') && cancelAtPeriodEnd,
    canReactivate: s === 'suspended',
  }
}

describe('subscription lifecycle action availability', () => {
  it('trialing allows convert, not restart', () => {
    const a = actionAvailability('trialing', false)
    expect(a.canConvertTrial).toBe(true)
    expect(a.canRestartPaid).toBe(false)
    expect(a.canStartTrial).toBe(false)
  })

  it('cancelled allows restart and new trial', () => {
    const a = actionAvailability('cancelled', false)
    expect(a.canRestartPaid).toBe(true)
    expect(a.canStartTrial).toBe(true)
    expect(a.canConvertTrial).toBe(false)
  })

  it('active with scheduled cancel allows undo', () => {
    const a = actionAvailability('active', true)
    expect(a.canUndoCancel).toBe(true)
  })

  it('suspended only reactivates', () => {
    const a = actionAvailability('suspended', false)
    expect(a.canReactivate).toBe(true)
    expect(a.canConvertTrial).toBe(false)
  })
})
