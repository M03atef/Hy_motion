import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskBandBadge, StatusBadge, TierBadge } from './Badges'

// This is a real DOM-rendering test (not a pure-function unit test like the rest of this repo's
// suite) — it proves @testing-library/react's render() correctly mounts and reconciles this
// app's own production components against this app's own react/react-dom. That combination
// previously crashed (a duplicate, mismatched react-dom copy had been installed under this
// workspace package — see vite.config.ts history / the P1 report for the root cause and fix).

describe('Badges (real render)', () => {
  it('renders a known tier label', () => {
    render(<TierBadge tier="growth" />)
    expect(screen.getByText('growth')).toBeInTheDocument()
  })

  it('renders a known status label with underscores replaced', () => {
    render(<StatusBadge status="past_due" />)
    expect(screen.getByText('Past due')).toBeInTheDocument()
  })

  it('renders a risk band label uppercased via CSS, text content unchanged', () => {
    render(<RiskBandBadge band="at_risk" />)
    expect(screen.getByText('At risk')).toBeInTheDocument()
  })

  it('renders a placeholder for a missing value instead of crashing', () => {
    render(<TierBadge tier={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
