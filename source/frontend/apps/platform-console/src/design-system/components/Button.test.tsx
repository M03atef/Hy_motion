import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DsBadge, DsButton } from './Button'
import { TextInput } from './forms'

describe('promoted ds components', () => {
  it('renders button states without preview context', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <>
        <DsButton onClick={onClick}>Save</DsButton>
        <DsButton disabled>Unavailable</DsButton>
        <DsButton loading>Saving</DsButton>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true')
  })

  it('renders status badges without using lime as the status color class', () => {
    const { container } = render(<DsBadge tone="success">Active</DsBadge>)
    expect(container.querySelector('.ds-badge--success')).toBeTruthy()
    expect(container.querySelector('.ds-badge--success')?.className).not.toMatch(/lime|action/)
  })

  it('exposes invalid state on inputs', () => {
    render(<TextInput label="Operator email" error="Enter a valid email address." />)
    expect(screen.getByRole('textbox', { name: 'Operator email' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })
})
