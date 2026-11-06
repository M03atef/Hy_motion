export type Bi = { en: string; ar: string }

export type PlaybookCategory =
  | 'setup'
  | 'handover'
  | 'installation'
  | 'configuration'
  | 'backup'
  | 'restore'
  | 'recovery'
  | 'updates'
  | 'hardware'
  | 'access'
  | 'support'
  | 'policies'

export type RiskLevel = 'safe' | 'admin' | 'destructive' | 'support_only'

export type Audience = 'customer' | 'support' | 'both'

export type Actor = 'hyMotion' | 'support' | 'owner' | 'staffOnPc' | 'customer'

export type StepStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'needs_customer'
  | 'needs_support'
  | 'completed'
  | 'failed'
  | 'escalated'

export type CaseStatus = StepStatus

export interface PlaybookCommand {
  id: string
  label: Bi
  /** Exact command to copy. Empty means instruction-only. */
  text: string
  supportOnly: boolean
}

export interface KitItem {
  id: string
  /** Folder name on the USB/SSD. Keep ASCII. */
  folder: string
  title: Bi
  why: Bi
  howToGet: Bi
  required: boolean
  /** Pack at HQ only. Do not install this on the gym PC. */
  hqOnly?: boolean
}

export interface PlaybookPhase {
  id: string
  title: Bi
  hint: Bi
  stepIds: string[]
}

export interface PlaybookStep {
  id: string
  action: Bi
  who: Actor
  expected: Bi
  verification: Bi
  failurePath?: Bi
  /** Extra facts for HyMotion staff: paths, accounts, commands, limits. */
  tech?: Bi
  risk: RiskLevel
  audience: Audience
  unsupported?: boolean
  commands?: PlaybookCommand[]
}

export interface FailureCase {
  id: string
  title: Bi
  whatHappened: Bi
  doNot: Bi
  immediate: Bi
  recovery: Bi
  escalation: Bi
  logs: Bi
  customerMessage: Bi
  closure: Bi
  tech?: Bi
  /** Gym view hides `support`. Default is both. */
  audience?: Audience
}

export interface Playbook {
  id: string
  category: PlaybookCategory
  title: Bi
  purpose: Bi
  whenToUse: Bi
  preconditions: Bi[]
  requiredAccess: Bi
  risk: RiskLevel
  audience: Audience
  customerSummary: Bi
  steps: PlaybookStep[]
  failures: FailureCase[]
  recovery: Bi
  escalation: Bi
  customerCommunication: Bi
  securityWarnings: Bi[]
  finalVerification: Bi[]
  closure: Bi[]
  lifecycle?: Bi[]
  /** USB/SSD packing list. Support view. */
  kit?: KitItem[]
  kitLayout?: Bi
  phases?: PlaybookPhase[]
}
