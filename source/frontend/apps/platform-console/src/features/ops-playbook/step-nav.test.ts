import { describe, expect, it } from 'vitest'
import { clampStep, firstIncompleteIndex } from './step-nav'

describe('playbook step nav', () => {
  it('opens the first step that is not done', () => {
    expect(firstIncompleteIndex([undefined, undefined])).toBe(0)
    expect(firstIncompleteIndex(['completed', undefined, 'completed'])).toBe(1)
    expect(firstIncompleteIndex(['completed', 'completed'])).toBe(1)
  })

  it('stays inside the step list', () => {
    expect(clampStep(-1, 4)).toBe(0)
    expect(clampStep(9, 4)).toBe(3)
    expect(clampStep(2, 0)).toBe(0)
  })
})
