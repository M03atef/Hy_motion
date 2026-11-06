/**
 * Run: npx tsx src/config/nav.selftest.ts
 *
 * Four fixture JWTs (Owner / Manager / Trainer / Receptionist) → assert filtered
 * NavCategory item keys. Pure claim checks — no Vite aliases in the assert path.
 */
import { NAV_CATEGORIES, type NavCategory } from './nav.ts'
import { filterVisibleNav } from './nav-visibility.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

/** Minimal unsigned JWT for claim fixtures (signature ignored client-side). */
function b64url(obj: object): string {
  const json = JSON.stringify(obj)
  const b64 = typeof btoa === 'function'
    ? btoa(json)
    : Buffer.from(json).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fixtureToken(role: string, perms: string[]): string {
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
    role,
    perm: perms,
    tenant_id: '00000000-0000-0000-0000-000000000001',
  })}.sig`
}

const ALL_PERMS = [
  'members.view',
  'members.create',
  'members.edit',
  'checkin.manual',
  'sales.sell',
  'sales.discount.apply',
  'sales.discount.override',
  'payments.cash.accept',
  'payments.refund.request',
  'payments.refund.approve',
  'shift.open',
  'shift.close',
  'shift.reconcile.approve',
  'memberships.freeze',
  'plans.manage',
  'reports.financial.view',
  'settings.manage',
  'member_orders.view',
  'member_orders.manage',
] as const

/** Mirrors DefaultPermissionProvider server defaults. */
const FIXTURES = {
  Owner: {
    role: 'Owner',
    token: fixtureToken('Owner', [...ALL_PERMS]),
  },
  Manager: {
    role: 'Manager',
    token: fixtureToken(
      'Manager',
      ALL_PERMS.filter((p) => p !== 'plans.manage' && p !== 'settings.manage'),
    ),
  },
  Trainer: {
    role: 'Trainer',
    // Server default: only checkin.manual — UI must not invent members.view from role name
    token: fixtureToken('Trainer', ['checkin.manual']),
  },
  Receptionist: {
    role: 'Receptionist',
    token: fixtureToken('Receptionist', [
      'members.view',
      'members.create',
      'members.edit',
      'checkin.manual',
      'sales.sell',
      'sales.discount.apply',
      'payments.cash.accept',
      'payments.refund.request',
      'shift.open',
      'shift.close',
      'member_orders.view',
      'member_orders.manage',
    ]),
  },
} as const

const ALL_MODULES_ON = () => true
const SALES_DISABLED = (k: string) => k !== 'sales'

function shape(cats: NavCategory[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const c of cats) out[c.key] = c.items.map((i) => i.key)
  return out
}

function assertShape(
  label: string,
  actual: Record<string, string[]>,
  expected: Record<string, string[]>,
) {
  const aKeys = Object.keys(actual).sort()
  const eKeys = Object.keys(expected).sort()
  assert(
    aKeys.join(',') === eKeys.join(','),
    `${label}: category keys\n  got:  ${aKeys.join(',')}\n  want: ${eKeys.join(',')}`,
  )
  for (const k of eKeys) {
    assert(
      (actual[k] || []).join(',') === expected[k].join(','),
      `${label}: ${k} items\n  got:  ${(actual[k] || []).join(',')}\n  want: ${expected[k].join(',')}`,
    )
  }
}

// ── Owner: everything (modules on) ──
assertShape(
  'Owner',
  shape(
    filterVisibleNav(NAV_CATEGORIES, {
      accessToken: FIXTURES.Owner.token,
      role: FIXTURES.Owner.role,
      isModuleAvailable: ALL_MODULES_ON,
    }),
  ),
  {
    overview: ['dashboard'],
    members: ['members', 'attendance'],
    'front-desk': ['sales', 'member-orders', 'call-sheet'],
    money: ['shifts', 'offers', 'invoices', 'reports'],
    catalog: ['plans'],
    administration: ['imports', 'staff', 'roles', 'settings'],
  },
)

// ── Manager: no plans.manage / settings.manage; not OwnerOnly ──
assertShape(
  'Manager',
  shape(
    filterVisibleNav(NAV_CATEGORIES, {
      accessToken: FIXTURES.Manager.token,
      role: FIXTURES.Manager.role,
      isModuleAvailable: ALL_MODULES_ON,
    }),
  ),
  {
    overview: ['dashboard'],
    members: ['members', 'attendance'],
    'front-desk': ['sales', 'member-orders', 'call-sheet'],
    money: ['shifts', 'offers', 'invoices', 'reports'],
    // catalog dropped — no plans.manage
    // administration: no imports (settings.manage), no staff/settings (OwnerOnly)
  },
)

// ── Trainer: only checkin.manual (+ any staff dashboard) ──
assertShape(
  'Trainer',
  shape(
    filterVisibleNav(NAV_CATEGORIES, {
      accessToken: FIXTURES.Trainer.token,
      role: FIXTURES.Trainer.role,
      isModuleAvailable: ALL_MODULES_ON,
    }),
  ),
  {
    overview: ['dashboard'],
    members: ['attendance'],
  },
)

// ── Receptionist: server default perms — hides Plans & Settings ──
assertShape(
  'Receptionist',
  shape(
    filterVisibleNav(NAV_CATEGORIES, {
      accessToken: FIXTURES.Receptionist.token,
      role: FIXTURES.Receptionist.role,
      isModuleAvailable: ALL_MODULES_ON,
    }),
  ),
  {
    overview: ['dashboard'],
    members: ['members', 'attendance'],
    'front-desk': ['sales', 'member-orders', 'call-sheet'],
    money: ['shifts', 'offers', 'reports'],
    // no invoices (reports.financial.view), no catalog, no administration
  },
)

// ── FEATURE_DISABLED sales: hide POS (+ promo); Call Sheet stays; Debtors is not a nav module ──
{
  const cats = filterVisibleNav(NAV_CATEGORIES, {
    accessToken: FIXTURES.Receptionist.token,
    role: FIXTURES.Receptionist.role,
    isModuleAvailable: SALES_DISABLED,
  })
  const front = cats.find((c) => c.key === 'front-desk')
  assert(front, 'front-desk remains')
  const keys = front!.items.map((i) => i.key)
  assert(!keys.includes('sales'), 'FEATURE_DISABLED sales hides POS')
  assert(keys.includes('call-sheet'), 'Call Sheet never feature-flag-gated')
  assert(!keys.includes('debtors'), 'Debtors is not a primary nav module')
  assert(!keys.includes('refunds'), 'Refunds is not a primary nav module')
  assert(!keys.includes('trials'), 'trials removed from product IA')
  const money = cats.find((c) => c.key === 'money')
  assert(money && !money.items.some((i) => i.key === 'offers'), 'promo flagged with sales')
}

// ── Claims over role name: Receptionist role but Owner perms → Plans visible ──
{
  const richRecep = fixtureToken('Receptionist', [...ALL_PERMS])
  const cats = filterVisibleNav(NAV_CATEGORIES, {
    accessToken: richRecep,
    role: 'Receptionist',
    isModuleAvailable: ALL_MODULES_ON,
  })
  const catalog = cats.find((c) => c.key === 'catalog')
  assert(catalog?.items.some((i) => i.key === 'plans'), 'plans.manage claim shows Plans regardless of role name')
  const admin = cats.find((c) => c.key === 'administration')
  // Staff/Settings still OwnerOnly policy — role name matters for policy, not for permission items
  assert(admin && !admin.items.some((i) => i.key === 'staff'), 'Staff stays OwnerOnly even with full perms')
  assert(admin && !admin.items.some((i) => i.key === 'roles'), 'Roles stays OwnerOnly even with full perms')
}

console.log('nav.selftest: OK (Owner/Manager/Trainer/Receptionist fixtures)')
