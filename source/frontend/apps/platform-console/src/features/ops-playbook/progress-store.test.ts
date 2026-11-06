import { beforeEach, describe, expect, it } from 'vitest'
import { usePlaybookProgress } from './progress-store'

describe('playbook progress store', () => {
  beforeEach(() => {
    usePlaybookProgress.setState({ byId: {}, theme: 'light', audience: 'support' })
  })

  it('does not mark steps complete by default', () => {
    const p = usePlaybookProgress.getState().get('restore-local')
    expect(p.caseStatus).toBe('not_started')
    expect(p.steps).toEqual({})
  })

  it('returns a stable empty snapshot for unknown playbooks', () => {
    const a = usePlaybookProgress.getState().get('missing-a')
    const b = usePlaybookProgress.getState().get('missing-b')
    expect(a).toBe(b)
    expect(a.caseStatus).toBe('not_started')
  })

  it('records operator-verified status only', () => {
    usePlaybookProgress.getState().setStepStatus('restore-local', 'run-latest', 'completed')
    expect(usePlaybookProgress.getState().get('restore-local').steps['run-latest']).toBe('completed')
    usePlaybookProgress.getState().reset('restore-local')
    expect(usePlaybookProgress.getState().get('restore-local').steps).toEqual({})
  })
})
