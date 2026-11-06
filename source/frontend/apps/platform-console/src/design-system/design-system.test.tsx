import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { DesignSystemApp } from './DesignSystemApp'
import { PreviewProvider } from './preview-context'

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="ds-icon" />
  return {
    Activity: Icon,
    Building2: Icon,
    ChevronRight: Icon,
    ClipboardList: Icon,
    Eye: Icon,
    EyeOff: Icon,
    HardDrive: Icon,
    Info: Icon,
    LifeBuoy: Icon,
    MoreHorizontal: Icon,
    PanelLeft: Icon,
    Search: Icon,
    Shield: Icon,
    ShieldOff: Icon,
    Users: Icon,
  }
})

function renderPreview() {
  return render(
    <PreviewProvider>
      <DesignSystemApp />
    </PreviewProvider>,
  )
}

describe('HyMotion design system preview', () => {
  it('renders sample-data banner and foundations', () => {
    renderPreview()
    expect(screen.getByText(/Illustrative sample data only/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brand & foundations' })).toBeInTheDocument()
  })

  it('switches theme without losing the preview', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('switches to Arabic and applies RTL', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(screen.getByRole('button', { name: 'AR' }))
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByRole('heading', { name: 'الهوية والأساسات' })).toBeInTheDocument()
  })
})
