import { describe, expect, it } from 'vitest'
import { feedbackListPreview } from './SupportPage'

describe('feedbackListPreview', () => {
  it('always returns the message preview even when a subject is set', () => {
    const preview = feedbackListPreview('Short title', 'Please add clearer batch preview options for PVC cards.')
    expect(preview.subject).toBe('Short title')
    expect(preview.messagePreview).toContain('Please add clearer batch preview')
  })

  it('omits subject when empty and truncates long messages', () => {
    const long = 'x'.repeat(100)
    const preview = feedbackListPreview('  ', long)
    expect(preview.subject).toBeNull()
    expect(preview.messagePreview.endsWith('…')).toBe(true)
    expect(preview.messagePreview.length).toBe(81)
  })
})
