import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogoLockup, LogoMark } from './Logo'

describe('Logo lockup', () => {
  it('uses the transparent mark without a charcoal tile', () => {
    const { container } = render(<LogoLockup />)
    expect(container.querySelector('.ds-logo-tile')).toBeNull()
    expect(container.querySelector('.ds-logo-mark img')?.getAttribute('src')).toBe(
      '/ds/hymotion-mark-transparent.png',
    )
    expect(screen.getByLabelText('HyMotion')).toBeInTheDocument()
  })

  it('keeps the mark asset when compact', () => {
    render(<LogoMark size={28} />)
    expect(document.querySelector('.ds-logo-mark')).toBeTruthy()
  })
})
