import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CreditCard,
  FileText,
  KeyRound,
  LifeBuoy,
  Package,
  Receipt,
  RotateCcw,
  Shield,
  Tags,
  Users,
} from 'lucide-react'
import type { Actor, CaseStatus, PlaybookCategory, RiskLevel, StepStatus } from './types'

export const CATEGORY_ICONS: Record<PlaybookCategory, LucideIcon> = {
  setup: Users,
  handover: FileText,
  installation: Package,
  configuration: Tags,
  backup: Receipt,
  restore: RotateCcw,
  recovery: RotateCcw,
  updates: BookOpen,
  hardware: CreditCard,
  access: KeyRound,
  support: LifeBuoy,
  policies: Shield,
}

export const STEP_STATUSES: StepStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'needs_customer',
  'needs_support',
  'completed',
  'failed',
  'escalated',
]

export function riskClass(risk: RiskLevel): string {
  if (risk === 'destructive') return 'ops-badge ops-badge-destructive'
  if (risk === 'admin') return 'ops-badge ops-badge-admin'
  if (risk === 'support_only') return 'ops-badge ops-badge-support'
  return 'ops-badge ops-badge-safe'
}

export function statusClass(status: StepStatus | CaseStatus): string {
  if (status === 'completed') return 'ops-st ops-st-ok'
  if (status === 'failed' || status === 'escalated') return 'ops-st ops-st-bad'
  if (status === 'blocked' || status === 'needs_customer' || status === 'needs_support') return 'ops-st ops-st-warn'
  if (status === 'in_progress') return 'ops-st ops-st-run'
  return 'ops-st ops-st-idle'
}

/** Customer-facing actor line. Gym people vs HyMotion team. */
export function whoTone(who: Actor): 'gym' | 'team' {
  return who === 'owner' || who === 'staffOnPc' || who === 'customer' ? 'gym' : 'team'
}
