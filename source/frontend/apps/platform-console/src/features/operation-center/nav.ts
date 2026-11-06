import type { LucideIcon } from 'lucide-react'
import { Building2, LayoutDashboard, LifeBuoy, Settings, ShoppingBag } from 'lucide-react'
import { isSalesOrAbove } from '@/lib/platform-roles'

export interface OcNavItem {
  id: 'overview' | 'gyms' | 'sales' | 'support' | 'settings'
  labelKey: 'nav.overview' | 'nav.gyms' | 'nav.sales' | 'nav.support' | 'nav.settings'
  path: string
  icon: LucideIcon
  visible: (role: string | null | undefined) => boolean
}

export const OC_NAV: OcNavItem[] = [
  { id: 'overview', labelKey: 'nav.overview', path: '/oc', icon: LayoutDashboard, visible: () => true },
  { id: 'gyms', labelKey: 'nav.gyms', path: '/oc/gyms', icon: Building2, visible: () => true },
  { id: 'sales', labelKey: 'nav.sales', path: '/oc/sales', icon: ShoppingBag, visible: isSalesOrAbove },
  { id: 'support', labelKey: 'nav.support', path: '/oc/support', icon: LifeBuoy, visible: () => true },
  { id: 'settings', labelKey: 'nav.settings', path: '/oc/settings', icon: Settings, visible: () => true },
]

export function visibleOcNav(role: string | null | undefined): OcNavItem[] {
  return OC_NAV.filter((item) => item.visible(role))
}

export function ocNavActive(pathname: string, path: string): boolean {
  if (path === '/oc') return pathname === '/oc' || pathname === '/oc/'
  return pathname === path || pathname.startsWith(`${path}/`)
}
