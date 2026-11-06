import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Package,
  PhoneCall,
  Settings,
  ShoppingCart,
  Users,
  UserCog,
  Shield,
  Wallet,
  DoorOpen,
  LineChart,
} from 'lucide-react'
import type { PermissionKey } from '@/lib/api'
import type { FeatureModuleKey } from '@/lib/features/probe'

/**
 * Declarative sidebar registry (§0.4 / Prompt 2).
 * Data only — icons are Lucide components, never JSX trees in the registry.
 *
 * Category table (derived from staff console IA; walkthrough paste omitted the literal table):
 * | Category        | Items                                              |
 * |-----------------|----------------------------------------------------|
 * | Overview        | Dashboard                                          |
 * | Members         | Members, Attendance                                |
 * | Front desk      | Sale, Member Orders, Call Sheet                          |
 * | Money           | Shifts, Offers & Promotions, Invoices, Reports    |
 * | Catalog         | Plans                                              |
 * | Administration  | Import, Staff, Roles, Settings                     |
 */

export type NavAccess =
  | { kind: 'permission'; value: PermissionKey | readonly PermissionKey[] }
  | { kind: 'policy'; value: 'OwnerOnly' | 'ManagerOrAbove' | 'AnyStaff' }
  | { kind: 'any' }

export type NavItem = {
  key: string
  label: string
  labelAr: string
  path: string
  icon: LucideIcon
  access: NavAccess
  featureFlag?: FeatureModuleKey
}

export type NavCategory = {
  key: string
  label: string
  labelAr: string
  items: NavItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: 'overview',
    label: 'Overview',
    labelAr: 'نظرة عامة',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        labelAr: 'لوحة التحكم',
        path: '/app',
        icon: LayoutDashboard,
        access: { kind: 'any' },
      },
    ],
  },
  {
    key: 'members',
    label: 'Members',
    labelAr: 'الأعضاء',
    items: [
      {
        key: 'members',
        label: 'Members',
        labelAr: 'الأعضاء',
        path: '/app/members',
        icon: Users,
        access: { kind: 'permission', value: 'members.view' },
      },
      {
        key: 'attendance',
        label: 'Attendance',
        labelAr: 'الحضور',
        path: '/app/attendance',
        icon: DoorOpen,
        // any-of: check-in desk OR live today view
        access: { kind: 'permission', value: ['checkin.manual', 'members.view'] },
      },
    ],
  },
  {
    key: 'front-desk',
    label: 'Front desk',
    labelAr: 'مكتب الاستقبال',
    items: [
      {
        key: 'sales',
        label: 'Sell',
        labelAr: 'بيع',
        path: '/app/sales',
        icon: ShoppingCart,
        access: { kind: 'permission', value: 'sales.sell' },
        featureFlag: 'sales',
      },
      {
        key: 'member-orders',
        label: 'Member Orders',
        labelAr: 'طلبات الأعضاء',
        path: '/app/member-orders',
        icon: Package,
        access: { kind: 'permission', value: 'sales.sell' },
      },
      {
        key: 'call-sheet',
        label: 'Call Sheet',
        labelAr: 'ورقة المتابعة',
        path: '/app/call-sheet',
        icon: PhoneCall,
        access: { kind: 'permission', value: 'sales.sell' },
        // never feature-flag-gated (§0.8 / §24)
      },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    labelAr: 'المالية',
    items: [
      {
        key: 'shifts',
        label: 'Shifts',
        labelAr: 'الورديات',
        path: '/app/shifts',
        icon: Wallet,
        access: { kind: 'permission', value: ['shift.open', 'shift.close'] },
        featureFlag: 'shifts',
      },
      {
        key: 'offers',
        label: 'Offers & Promotions',
        labelAr: 'العروض والترويج',
        path: '/app/offers',
        icon: BadgePercent,
        access: { kind: 'permission', value: ['sales.sell', 'plans.manage'] },
        featureFlag: 'sales',
      },
      {
        key: 'invoices',
        label: 'Invoices',
        labelAr: 'الفواتير',
        path: '/app/invoices',
        icon: FileText,
        access: { kind: 'permission', value: 'reports.financial.view' },
      },
      {
        key: 'reports',
        label: 'Reports',
        labelAr: 'التقارير',
        path: '/app/reports',
        icon: LineChart,
        access: {
          kind: 'permission',
          value: ['reports.financial.view', 'members.view'],
        },
      },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    labelAr: 'الباقات',
    items: [
      {
        key: 'plans',
        label: 'Plans',
        labelAr: 'الباقات',
        path: '/app/plans',
        icon: Package,
        access: { kind: 'permission', value: 'plans.manage' },
      },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    labelAr: 'الإدارة',
    items: [
      {
        key: 'imports',
        label: 'Import',
        labelAr: 'الاستيراد',
        path: '/app/imports',
        icon: FileSpreadsheet,
        access: { kind: 'permission', value: 'settings.manage' },
        featureFlag: 'imports',
      },
      {
        key: 'staff',
        label: 'Staff',
        labelAr: 'الموظفون',
        path: '/app/staff',
        icon: UserCog,
        access: { kind: 'policy', value: 'OwnerOnly' },
      },
      {
        key: 'roles',
        label: 'Roles',
        labelAr: 'الأدوار',
        path: '/app/roles',
        icon: Shield,
        access: { kind: 'policy', value: 'OwnerOnly' },
      },
      {
        key: 'settings',
        label: 'Settings',
        labelAr: 'الإعدادات',
        path: '/app/settings',
        icon: Settings,
        access: { kind: 'policy', value: 'OwnerOnly' },
      },
    ],
  },
]

/** Flat list for callers that don't need categories. */
export const NAV_ITEMS: NavItem[] = NAV_CATEGORIES.flatMap((c) => c.items)

/** @deprecated Alias — prefer `NavItem.label` */
export type LegacyNavLabels = { labelEn: string; labelAr: string }
