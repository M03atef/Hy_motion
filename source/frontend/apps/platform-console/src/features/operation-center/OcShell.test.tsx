import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { OC_THEME_KEY, useOcThemeStore } from './theme-store'

const location = { pathname: '/oc' }

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="oc-icon" />
  return {
    Building2: Icon,
    LayoutDashboard: Icon,
    LifeBuoy: Icon,
    Search: Icon,
    Settings: Icon,
    ShoppingBag: Icon,
    Eye: Icon,
    EyeOff: Icon,
  }
})

vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
  Link: ({ children, to }: { children: import('react').ReactNode; to: string }) => <a href={to}>{children}</a>,
  Outlet: () => <div>overview-outlet</div>,
  useLocation: () => location,
}))

import { OcShell } from './OcShell'

function signIn(role = 'platform_admin') {
  useAuthStore.getState().applySuccessfulAuth({
    success: true,
    expiresInSeconds: 600,
    mfaSetupRequired: false,
    accessToken: 'tok',
    user: {
      id: '1',
      email: 'a@b.c',
      fullName: 'Admin User',
      role,
      mfaEnabled: true,
    },
  })
}

describe('OcShell', () => {
  beforeEach(() => {
    location.pathname = '/oc'
    useAuthStore.getState().logout()
    useUiStore.getState().setLocale('en')
    useOcThemeStore.getState().setTheme('dark')
    localStorage.removeItem(OC_THEME_KEY)
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders HyMotion identity and primary navigation', () => {
    signIn()
    render(<OcShell />)
    expect(screen.getAllByLabelText('HyMotion').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('navigation', { name: 'HyMotion' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /gyms/i })).toBeInTheDocument()
    expect(screen.getByText('overview-outlet')).toBeInTheDocument()
    const mark = document.querySelector('.ds-logo-mark img') as HTMLImageElement | null
    expect(mark?.getAttribute('src')).toContain('hymotion-mark-transparent.png')
    expect(document.querySelector('.ds-logo-tile')).toBeNull()
    expect(screen.queryByRole('link', { name: /legacy editors/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/oc/settings')
  })

  it('hides Sales from support and keeps it for sales', () => {
    signIn('platform_support')
    const { unmount } = render(<OcShell />)
    expect(screen.queryByRole('link', { name: /sales/i })).not.toBeInTheDocument()
    unmount()
    signIn('platform_sales')
    render(<OcShell />)
    expect(screen.getByRole('link', { name: /sales/i })).toBeInTheDocument()
  })

  it('switches theme on the Operation Center root without theming documentElement', async () => {
    signIn()
    const user = userEvent.setup()
    render(<OcShell />)
    const root = document.querySelector('[data-oc]') as HTMLElement
    expect(root.dataset.theme).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(root.dataset.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(root.dataset.theme).toBe('dark')
  })

  it('applies Arabic RTL on the HyMotion shell root', async () => {
    signIn()
    const user = userEvent.setup()
    render(<OcShell />)
    await user.click(screen.getByRole('button', { name: 'AR' }))
    const root = document.querySelector('[data-oc]') as HTMLElement
    expect(root.dir).toBe('rtl')
    expect(root.lang).toBe('ar')
    expect(screen.getByRole('navigation', { name: 'HyMotion' })).toBeInTheDocument()
  })
})
