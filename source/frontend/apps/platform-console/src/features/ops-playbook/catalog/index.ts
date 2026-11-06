import type { Playbook, PlaybookCategory, RiskLevel, Audience } from '../types'
import { backupPlaybook } from './backup'
import { customerOnboardPlaybook, licenseLifecyclePlaybook, supportTicketPlaybook } from './commerce'
import { fieldKitPlaybook } from './field-kit'
import { accessCardsPlaybook } from './hardware'
import { restorePlaybook } from './restore'
import { rollbackPlaybook } from './rollback'
import { localDesktopPlaybook } from './local-desktop'
import { handoverPlaybook, setupPlaybook } from './setup'
import { policiesPlaybook, supportPlaybooks, updatePlaybook } from './support'

export const PLAYBOOKS: Playbook[] = [
  localDesktopPlaybook,
  customerOnboardPlaybook,
  fieldKitPlaybook,
  setupPlaybook,
  handoverPlaybook,
  accessCardsPlaybook,
  backupPlaybook,
  restorePlaybook,
  rollbackPlaybook,
  licenseLifecyclePlaybook,
  supportTicketPlaybook,
  ...supportPlaybooks,
  updatePlaybook,
  policiesPlaybook,
]

export const CATEGORIES: PlaybookCategory[] = [
  'setup',
  'handover',
  'installation',
  'configuration',
  'backup',
  'restore',
  'recovery',
  'updates',
  'hardware',
  'access',
  'support',
  'policies',
]

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id)
}

export function filterPlaybooks(opts: {
  query?: string
  category?: PlaybookCategory | ''
  risk?: RiskLevel | ''
  audience?: Audience | '' | 'customer-action' | 'support-action'
}): Playbook[] {
  const q = (opts.query ?? '').trim().toLowerCase()
  return PLAYBOOKS.filter((p) => {
    if (opts.category && p.category !== opts.category) return false
    if (opts.risk && p.risk !== opts.risk) return false
    if (opts.audience === 'customer' && p.audience === 'support') return false
    if (opts.audience === 'support' && p.audience === 'customer') return false
    if (opts.audience === 'customer-action' && !p.steps.some((s) => s.who === 'customer' || s.who === 'owner' || s.who === 'staffOnPc'))
      return false
    if (opts.audience === 'support-action' && !p.steps.some((s) => s.who === 'support' || s.who === 'hyMotion')) return false
    if (!q) return true
    const gymSafe = opts.audience === 'customer'
    const blob = (
      gymSafe
        ? [
            p.id,
            p.title.en,
            p.title.ar,
            p.whenToUse.en,
            p.whenToUse.ar,
            p.customerSummary.en,
            p.customerSummary.ar,
            ...p.steps
              .filter((s) => s.audience !== 'support')
              .flatMap((s) => [s.action.en, s.action.ar, s.expected.en, s.expected.ar]),
          ]
        : [
            p.id,
            p.title.en,
            p.title.ar,
            p.purpose.en,
            p.purpose.ar,
            p.category,
            ...p.steps.flatMap((s) => [s.action.en, s.tech?.en, s.tech?.ar, ...(s.commands ?? []).map((c) => c.text)]),
            ...(p.kit ?? []).flatMap((k) => [k.folder, k.title.en, k.title.ar]),
            ...p.failures.flatMap((f) => [f.id, f.title.en, f.title.ar, f.tech?.en, f.tech?.ar, f.whatHappened.en]),
          ]
    )
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
}
