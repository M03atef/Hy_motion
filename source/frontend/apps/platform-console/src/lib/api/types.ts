export type PlatformRole = 'platform_support' | 'platform_ops' | 'platform_admin' | 'platform_sales'

export interface PlatformAdminDto {
  id: string
  email: string
  fullName: string
  role: PlatformRole | string
  mfaEnabled: boolean
}

export interface PlatformLoginRequest {
  email: string
  password: string
  mfaCode?: string
}

export interface PlatformLoginResult {
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
  accessToken?: string | null
  expiresInSeconds: number
  mfaSetupRequired: boolean
  setupToken?: string | null
  otpAuthUri?: string | null
  mfaManualKey?: string | null
  user?: PlatformAdminDto | null
}

export interface PlatformMfaSetupRequest {
  setupToken: string
  mfaCode: string
}

export interface PlatformPagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export type RiskBand = 'healthy' | 'watch' | 'at_risk' | 'critical' | (string & {})

export interface PlatformTenantListItemDto {
  id: string
  name: string
  gymCode: string
  planTier?: string | null
  status?: string | null
  billingCycle?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  /** Trial end from live subscription row (trialing). Prefer over currentPeriodEnd for trial display. */
  trialEndsAtUtc?: string | null
  priceEgp?: number | null
  /** CP7 list seam — null until health scores are populated. */
  riskBand?: RiskBand | null
  healthScore?: number | null
  lastLoginAtUtc?: string | null
  /** P2.1 — the tenant's active Owner-role account. Null when there is no active Owner. */
  ownerName?: string | null
  ownerEmail?: string | null
  /** P2.1 — active_members usage counter for the current Cairo period (monthly rollup, not live). */
  memberCount?: number | null
  /** Null means unlimited on the tenant's current tier. */
  memberCap?: number | null
}

export interface SubscriptionStatusDto {
  id: string
  tenantId: string
  planTier: string
  status: string
  billingCycle: string
  priceEgp: number
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAtUtc?: string | null
  cancelAtPeriodEnd: boolean
  cancelledAtUtc?: string | null
  suspendedAtUtc?: string | null
  updatedAtUtc: string
  pendingDowngradeTier?: string | null
  hasPaymentMethodOnFile?: boolean
}

/** CP4 usage metric keys from platform.usage_counters. */
export type UsageMetricKey =
  | 'active_members'
  | 'whatsapp_messages'
  | 'staff_seats'
  | 'branches'
  | (string & {})

/** Flat row from GET /platform-api/tenants/{id} → usageCounters (live API shape). */
export interface UsageCounterDto {
  period: string // YYYY-MM
  metric: UsageMetricKey
  count: number
  cap: number | null
  overageBilledEgp: number | null
  updatedAtUtc: string
}

/**
 * View model for the Usage panel — derived client-side from usageCounters[].
 * Do not expect this nested shape on the wire.
 */
export interface TenantUsageView {
  period: string
  metrics: Array<{
    metric: UsageMetricKey
    count: number
    cap: number | null
    overageBilledEgp: number | null
  }>
  /** Newest counter UpdatedAtUtc — for snapshot "as of" label. */
  asOfUtc: string | null
}

export interface PlatformTenantDetailDto {
  id: string
  name: string
  nameAr: string
  gymCode: string
  city: string
  phoneNumber: string
  email: string
  isActive: boolean
  subscription?: SubscriptionStatusDto | null
  /** Current Cairo-month rollup rows (same period), empty if none rolled up yet. */
  usageCounters?: UsageCounterDto[]
  /** CP7 rules-based health — null when not yet computed for this tenant. */
  health?: TenantHealthScoreDto | null
  /** Active feature overrides (CP4/CP6) — includes from detail payload. */
  featureOverrides?: FeatureOverrideDto[]
  /** Active / recent price overrides (coupons). */
  priceOverrides?: PriceOverrideDto[]
  /** Recent platform_audit_log rows for this tenant (CP6). */
  recentAudit?: PlatformAuditLogDto[]
  /** Staff (non-Member) login accounts for this tenant. */
  users?: PlatformTenantUserDto[]
  /**
   * Optional Local customer that already points at this tenant via customer.tenantId.
   * Present only when exactly one customer has that link.
   */
  customerId?: string | null
}

export interface PlatformTenantUserDto {
  id: string
  fullName: string
  email: string
  role?: string | null
  isActive: boolean
  updatedAtUtc?: string | null
}

/** P2.2 — mirrors backend StaffListItemDto/StaffDetailDto (GMS.Application.DTOs.Admin). Id is
 * always ApplicationUser.Id (the identity/login id), never the separate AppUser row id. */
export interface TenantStaffDto {
  id: string
  fullName: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt?: string | null
  createdAtUtc: string
  staffNumber?: string | null
  jobTitle?: string | null
  department?: string | null
}

/** Owner is deliberately excluded — the backend rejects it (assigned only at tenant
 * provisioning) and P2.2 does not implement an owner-transfer workflow. */
export const TENANT_STAFF_ROLES = ['Manager', 'Trainer', 'Receptionist'] as const
export type TenantStaffRole = (typeof TENANT_STAFF_ROLES)[number]

export interface CreateTenantStaffRequest {
  fullName: string
  email: string
  password: string
  role: string
}

export interface DisableTenantStaffRequest {
  reason: string
}

export interface ReactivateTenantStaffRequest {
  reason: string
}

export interface ChangeTenantStaffRoleRequest {
  role: string
  reason: string
}

export interface ResetTenantStaffPasswordRequest {
  newPassword: string
  reason: string
}

export const TENANT_STAFF_ENDPOINTS = {
  list: (tenantId: string) => `/platform-api/tenants/${tenantId}/users`,
  create: (tenantId: string) => `/platform-api/tenants/${tenantId}/users`,
  disable: (tenantId: string, staffId: string) => `/platform-api/tenants/${tenantId}/users/${staffId}/disable`,
  reactivate: (tenantId: string, staffId: string) => `/platform-api/tenants/${tenantId}/users/${staffId}/reactivate`,
  changeRole: (tenantId: string, staffId: string) => `/platform-api/tenants/${tenantId}/users/${staffId}/role`,
  resetPassword: (tenantId: string, staffId: string) => `/platform-api/tenants/${tenantId}/users/${staffId}/reset-password`,
} as const

export interface PlatformAuditLogDto {
  id: string
  actorPlatformUserId: string
  actorName?: string | null
  action: string
  tenantId?: string | null
  /** Populated only by the global audit feed (GET /platform-api/audit) — null on the per-tenant
   * embedded RecentAudit, where the caller is already on that tenant's page. */
  tenantName?: string | null
  gymCode?: string | null
  beforeJson?: string | null
  afterJson?: string | null
  createdAtUtc: string
}

export interface ImpersonateRequest {
  reason: string
}

export interface ImpersonationResponse {
  accessToken: string
  expiresAtUtc: string
  tenantId: string
  gymCode: string
  impersonatedUserId: string
  impersonatedEmail: string
  refreshAllowed: boolean
}

export interface FeatureOverrideDto {
  id: string
  tenantId: string
  featureKey: string
  enabled: boolean
  reason: string
  grantedByPlatformUserId: string
  expiresAtUtc?: string | null
  createdAtUtc: string
}

export interface PriceOverrideDto {
  id: string
  tenantId: string
  discountType: string
  value: number
  expiresAtUtc: string
  reason: string
  grantedByPlatformUserId: string
  createdAtUtc: string
  isActive?: boolean
}

/** Same 4 tiers as backend PlanTiers — fixed enum for the Change Plan select, not a Plans CRUD UI. */
export const PLAN_TIERS = ['starter', 'growth', 'pro', 'enterprise'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

export function planTierRank(tier: string): number {
  return PLAN_TIERS.indexOf(tier.toLowerCase() as PlanTier)
}

export interface ChangeTierRequest {
  newTier: string
  /** Upgrades ignore this server-side (always immediate). Downgrades: true = now, false = period end. */
  effectiveNow: boolean
  reason?: string
}

export interface CancelSubscriptionRequest {
  /** false = cancel_at_period_end; true = immediate cancel. */
  immediate: boolean
  reason?: string
}

export interface SubscriptionMutationResult {
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
  subscription?: SubscriptionStatusDto | null
}

export interface ConvertTrialRequest {
  reason: string
}

export interface RestartPaidRequest {
  tier: string
  reason: string
}

export interface StartTrialRequest {
  tier?: string
  trialDays?: number
}

export const SUBSCRIPTION_ENDPOINTS = {
  changeTier: (tenantId: string) => `/platform-api/tenants/${tenantId}/subscription/change-tier`,
  cancel: (tenantId: string) => `/platform-api/tenants/${tenantId}/subscription/cancel`,
  undoCancel: (tenantId: string) => `/platform-api/tenants/${tenantId}/subscription/undo-cancel`,
  convertTrial: (tenantId: string) => `/platform-api/tenants/${tenantId}/subscription/convert-trial`,
  restartPaid: (tenantId: string) => `/platform-api/tenants/${tenantId}/subscription/restart-paid`,
} as const

export interface ForceSuspendRequest {
  reason: string
}

export interface ForceReactivateRequest {
  reason: string
}

export interface ExtendTrialRequest {
  days: number
  reason: string
}

export interface CreateCouponRequest {
  discountType: 'percent' | 'fixed'
  value: number
  expiresAtUtc: string
  reason: string
}

export interface UpsertFeatureOverrideRequest {
  featureKey: string
  enabled: boolean
  reason: string
  expiresAtUtc?: string | null
}

export interface PlatformActionResult {
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
}

/**
 * Known feature keys for overrides.
 * Authoritative Phase A modules from backend FeatureKeys; plus planned Stage 2 keys
 * (upsert accepts any string key — list is for the select UX).
 */
export const KNOWN_FEATURE_KEYS = [
  'sales',
  'shifts',
  'trials',
  'refunds',
  'debtors',
  'imports',
  'digital_waivers',
  'presence_verification',
  'crm',
  'online_joining',
  'marketing_broadcasts',
  'retention_automation',
  'referrals',
  'eta_invoicing',
  'pt_booking',
] as const

export type KnownFeatureKey = (typeof KNOWN_FEATURE_KEYS)[number]

export type FactorImpact = 'positive' | 'negative' | 'neutral'

/** Wire shape from GET /tenants/{id}.health (camelCase JSON). */
export interface TenantHealthScoreDto {
  riskBand: RiskBand
  score: number
  /** rules_v1 JSON string — parse client-side into contributing factors. */
  contributingFactorsJson?: string | null
  /** Alias some responses may still emit. */
  breakdownJson?: string | null
  computedAtUtc: string
  updatedAtUtc?: string
  assignedPlatformUserId?: string | null
  confidence?: number | null
  summary?: string | null
}

/** One factor row after parsing contributingFactorsJson.signals. */
export interface HealthFactorView {
  factor: string
  label: string
  weight: number
  signalValue: string
  impact: FactorImpact
  available: boolean
  score: number | null
}

/**
 * View model for the Health panel — derived from health + JSON.
 * Do not expect the task's nested healthScore shape on the wire.
 */
export interface HealthScoreView {
  score: number
  riskBand: RiskBand
  computedAt: string
  summary: string | null
  confidence: number | null
  contributingFactors: HealthFactorView[]
}

export interface SubscriptionChangeDto {
  id: string
  tenantId: string
  subscriptionId: string
  changeType: string
  fromTier?: string | null
  toTier?: string | null
  effectiveAtUtc: string
  proratedAmountEgp?: number | null
  initiatedBy: string
  platformAdminUserId?: string | null
  reason?: string | null
  createdAtUtc: string
}

export interface PlatformInvoiceDto {
  id: string
  tenantId: string
  subscriptionId: string
  invoiceNumber: string
  periodStart: string
  periodEnd: string
  subtotal: number
  vatAmount: number
  total: number
  currency: string
  status: string
  dueDate: string
  paidAtUtc?: string | null
  paymentMethod?: string | null
  etaUuid?: string | null
  pdfUrl?: string | null
  createdAtUtc: string
}

export const AUTH_ENDPOINTS = {
  login: '/platform-api/auth/login',
  mfaSetup: '/platform-api/auth/mfa/setup',
} as const

export interface ProvisionTenantRequest {
  name: string
  nameAr?: string
  city: string
  address?: string
  phoneNumber: string
  email: string
  gymCode?: string
  timeZone?: string
  ownerFullName: string
  ownerEmail: string
  ownerPassword: string
  /** default growth */
  tier?: string
  /** Optional 1–90; omitted → platform default (14). */
  trialDays?: number
}

export interface ProvisionTenantResponse {
  tenantId: string
  gymCode: string
  ownerUserId: string
  ownerEmail: string
  trialStarted: boolean
  trialError?: string | null
}

export const TENANT_ENDPOINTS = {
  list: '/platform-api/tenants',
  provision: '/platform-api/tenants/provision',
  detail: (id: string) => `/platform-api/tenants/${id}`,
  changes: (id: string) => `/platform-api/tenants/${id}/subscription/changes`,
  invoices: (id: string) => `/platform-api/tenants/${id}/invoices`,
  forceSuspend: (id: string) => `/platform-api/tenants/${id}/force-suspend`,
  forceReactivate: (id: string) => `/platform-api/tenants/${id}/force-reactivate`,
  extendTrial: (id: string) => `/platform-api/tenants/${id}/extend-trial`,
  startTrial: (id: string) => `/platform-api/tenants/${id}/start-trial`,
  coupon: (id: string) => `/platform-api/tenants/${id}/coupon`,
  featureOverrides: (id: string) => `/platform-api/tenants/${id}/feature-overrides`,
  featureOverride: (id: string, overrideId: string) =>
    `/platform-api/tenants/${id}/feature-overrides/${overrideId}`,
  impersonate: (id: string) => `/platform-api/tenants/${id}/impersonate`,
} as const

export type RiskQueueOutcomeValue =
  | 'contacted'
  | 'retained'
  | 'churned'
  | 'no_answer'
  | 'watching'

export const RISK_QUEUE_OUTCOMES: RiskQueueOutcomeValue[] = [
  'contacted',
  'retained',
  'churned',
  'no_answer',
  'watching',
]

export const RISK_QUEUE_BANDS = ['healthy', 'watch', 'at_risk', 'critical'] as const

export interface RiskQueueOutcomeDto {
  id: string
  tenantId: string
  platformUserId: string
  outcome: string
  note?: string | null
  createdAtUtc: string
}

export interface RiskQueueItemDto {
  tenantId: string
  name: string
  gymCode: string
  planTier?: string | null
  subscriptionStatus?: string | null
  score: number
  riskBand: string
  computedAtUtc: string
  assignedPlatformUserId?: string | null
  assignedAtUtc?: string | null
  contributingFactorsJson?: string | null
  summary?: string | null
  recentOutcomes: RiskQueueOutcomeDto[]
}

export interface AssignRiskQueueRequest {
  assignedPlatformUserId?: string | null
}

export interface RecordRiskQueueOutcomeRequest {
  outcome: string
  note?: string
}

export const RISK_QUEUE_ENDPOINTS = {
  list: '/platform-api/risk-queue',
  assign: (tenantId: string) => `/platform-api/risk-queue/${tenantId}/assign`,
  outcome: (tenantId: string) => `/platform-api/risk-queue/${tenantId}/outcome`,
} as const

/** CP8 SaaS metrics — DateOnly fields arrive as yyyy-MM-dd strings. */
export interface MrrSnapshotDto {
  asOf: string
  mrrEgp: number
  arrEgp: number
  payingTenantCount: number
  computedAtUtc: string
  currency: string
}

export interface MrrMovementDto {
  from: string
  to: string
  startingMrrEgp: number
  newMrrEgp: number
  expansionMrrEgp: number
  contractionMrrEgp: number
  churnedMrrEgp: number
  endingMrrEgp: number
  endingMrrDirectEgp: number
  reconciles: boolean
  computedAtUtc: string
}

export interface CohortRetentionDto {
  cohortMonth: string
  signedUp: number
  retainedPaying: number
  retentionRate: number
}

export interface ChurnMetricsDto {
  from: string
  to: string
  grossChurnRate: number
  startingMrrEgp: number
  churnedMrrEgp: number
  startingPayingTenants: number
  churnedTenants: number
  cohorts: CohortRetentionDto[]
  computedAtUtc: string
}

export interface ConversionMetricsDto {
  from: string
  to: string
  trialsStarted: number
  convertedToPaid: number
  conversionRate: number
  computedAtUtc: string
}

export interface TierDistributionRowDto {
  planTier: string
  tenantCount: number
  mrrEgp: number
}

export interface TierDistributionDto {
  asOf: string
  tiers: TierDistributionRowDto[]
  totalMrrEgp: number
  totalPayingTenants: number
  computedAtUtc: string
}

export const METRICS_ENDPOINTS = {
  mrr: '/platform-api/metrics/mrr',
  movement: '/platform-api/metrics/movement',
  churn: '/platform-api/metrics/churn',
  conversion: '/platform-api/metrics/conversion',
  tierDistribution: '/platform-api/metrics/tier-distribution',
} as const

/** Wire shape of GET /platform-api/usage/summary — cross-tenant rollup for the current Cairo period. */
export interface PlatformUsageSummaryDto {
  period: string // YYYY-MM
  totals: UsageMetricTotalDto[]
  /** Tenants at or above 80% of their cap for any metric, worst first — already filtered server-side. */
  tenantsNearLimit: TenantNearLimitDto[]
  computedAtUtc: string
}

export interface UsageMetricTotalDto {
  metric: UsageMetricKey
  totalCount: number
  /** Tenants with a counter row for this metric this period — not a cap. */
  tenantCount: number
}

export interface TenantNearLimitDto {
  tenantId: string
  tenantName: string
  gymCode: string
  metric: UsageMetricKey
  count: number
  cap: number
  /** Rounded percentage, e.g. 92 for 92%. */
  percentOfCap: number
}

export const USAGE_ENDPOINTS = {
  summary: '/platform-api/usage/summary',
} as const

export interface PlatformAuditListParams {
  tenantId?: string
  action?: string
  from?: string // yyyy-MM-dd
  to?: string // yyyy-MM-dd
  page?: number
  pageSize?: number
}

export const AUDIT_ENDPOINTS = {
  list: '/platform-api/audit',
} as const

/** Same roles as backend PlatformRoles — fixed set, not user-editable. */
export const PLATFORM_USER_ROLES = ['platform_support', 'platform_ops', 'platform_admin', 'platform_sales'] as const
export type PlatformUserRole = (typeof PLATFORM_USER_ROLES)[number]

export interface PlatformUserDto {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  mfaEnabled: boolean
  lastLoginAtUtc?: string | null
  createdAtUtc: string
}

export interface CreatePlatformUserRequest {
  email: string
  fullName: string
  role: string
  password: string
}

export interface ChangePlatformUserRoleRequest {
  role: string
}

export const PLATFORM_USER_ENDPOINTS = {
  list: '/platform-api/platform-users',
  create: '/platform-api/platform-users',
  disable: (id: string) => `/platform-api/platform-users/${id}/disable`,
  reactivate: (id: string) => `/platform-api/platform-users/${id}/reactivate`,
  changeRole: (id: string) => `/platform-api/platform-users/${id}/role`,
} as const

/** Module keys from backend FeatureKeys — do not invent. */
export const COMMERCIAL_PLAN_FEATURE_KEYS = [
  'sales',
  'shifts',
  'trials',
  'refunds',
  'debtors',
  'imports',
  'inventory',
  'stock_management',
  'hr',
] as const

export interface CommercialPlanListItemDto {
  tier: string
  displayName: string
  description?: string | null
  sortOrder: number
  isActiveForSales: boolean
  isDefault: boolean
  monthlyPriceEgp: number
  annualPriceEgp: number
  annualSavingsPercent: number
  membersCap?: number | null
  staffCap?: number | null
  branchesCap?: number | null
  whatsAppCap?: number | null
  featureCount: number
  liveSubscriptionCount: number
  updatedAtUtc: string
}

export interface CommercialPlanDetailDto extends CommercialPlanListItemDto {
  enabledFeatures: string[]
}

export interface UpdatePlanMetadataRequest {
  displayName: string
  description?: string | null
  sortOrder: number
  reason: string
}

export interface UpdatePlanPricingRequest {
  monthlyPriceEgp: number
  reason: string
}

export interface UpdatePlanCapsRequest {
  activeMembers?: number | null
  staffSeats?: number | null
  branches?: number | null
  whatsAppMessages?: number | null
  reason: string
}

export interface UpdatePlanFeaturesRequest {
  enabledFeatures: string[]
  reason: string
}

export interface UpdatePlanSalesStatusRequest {
  isActiveForSales: boolean
  reason: string
}

export interface SetDefaultPlanRequest {
  reason: string
}

export interface PlanChangeLogDto {
  id: string
  tier: string
  fieldName: string
  oldValue?: string | null
  newValue?: string | null
  actorPlatformUserId: string
  actorName?: string | null
  reason: string
  createdAtUtc: string
}

export interface CommercialPlanMutationResult {
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
  plan?: CommercialPlanDetailDto | null
}

/** Mirrors GMS.Platform.Constants.LocalLicensingConstants.LocalLicenseStatuses. */
export const LOCAL_LICENSE_STATUSES = ['created', 'pending_activation', 'active', 'suspended', 'revoked'] as const
export type LocalLicenseStatus = (typeof LOCAL_LICENSE_STATUSES)[number]

export interface LocalLicenseListItemDto {
  id: string
  licenseKey: string
  customerId?: string | null
  contractId?: string | null
  contractNumber?: string | null
  customerName: string
  edition: string
  status: string
  deviceLimit: number
  activeInstallationCount: number
  issuedAtUtc?: string | null
  createdAtUtc: string
  lastValidatedAtUtc?: string | null
  installationStatus?: string | null
  gymCode?: string | null
  gymName?: string | null
  appVersion?: string | null
}

export interface LocalInstallationDto {
  id?: string
  installationId: string
  status: string
  firstActivatedAtUtc: string
  lastValidatedAtUtc?: string | null
  deactivatedAtUtc?: string | null
  deactivationReason?: string | null
  gymCode?: string | null
  gymName?: string | null
  appVersion?: string | null
}

export interface LocalLifecycleEventDto {
  operationId: string
  eventType: string
  installationId?: string | null
  gymCode?: string | null
  gymName?: string | null
  message?: string | null
  createdAtUtc: string
}

export interface LocalLicenseChangeDto {
  changeType: string
  fromStatus?: string | null
  toStatus?: string | null
  initiatedBy: string
  reason?: string | null
  createdAtUtc: string
}

export interface LocalLicenseDetailDto extends LocalLicenseListItemDto {
  customerContact?: string | null
  dealReference?: string | null
  notes?: string | null
  revokedReason?: string | null
  revokedAtUtc?: string | null
  installations: LocalInstallationDto[]
  recentChanges: LocalLicenseChangeDto[]
  recentOperations?: LocalLifecycleEventDto[]
  transferCount: number
  suspiciousEventCount: number
}

export interface IssueLocalLicenseRequest {
  customerName?: string
  customerContact?: string | null
  customerId?: string | null
  contractId?: string | null
  dealReference?: string | null
  edition: string
  deviceLimit: number
  notes?: string | null
}

export interface IssueLocalLicenseResult {
  id: string
  licenseKey: string
}

export interface LocalLicenseActionRequest {
  reason: string
}

export interface LocalLicenseTransferRequest {
  oldInstallationId?: string | null
  reason: string
}

export const LOCAL_LICENSE_ENDPOINTS = {
  list: '/platform-api/local-licenses',
  issue: '/platform-api/local-licenses',
  detail: (id: string) => `/platform-api/local-licenses/${id}`,
  suspend: (id: string) => `/platform-api/local-licenses/${id}/suspend`,
  revoke: (id: string) => `/platform-api/local-licenses/${id}/revoke`,
  reactivate: (id: string) => `/platform-api/local-licenses/${id}/reactivate`,
  authorizeTransfer: (id: string) => `/platform-api/local-licenses/${id}/authorize-transfer`,
} as const

export const CUSTOMER_ENDPOINTS = {
  list: '/platform-api/customers',
  detail: (id: string) => `/platform-api/customers/${id}`,
  profile: (id: string) => `/platform-api/customers/${id}/profile`,
  passwordReset: (id: string) => `/platform-api/customers/${id}/owner-password-reset`,
  contracts: '/platform-api/contracts',
  contract: (id: string) => `/platform-api/contracts/${id}`,
  contractStatus: (id: string) => `/platform-api/contracts/${id}/status`,
  payments: '/platform-api/customer-payments',
  catalog: '/platform-api/catalog-products',
  catalogItem: (id: string) => `/platform-api/catalog-products/${id}`,
  tickets: '/platform-api/support-tickets',
  ticket: (id: string) => `/platform-api/support-tickets/${id}`,
  deskFeedback: '/platform-api/desk-feedback',
  deskFeedbackItem: (id: string) => `/platform-api/desk-feedback/${id}`,
  salesContractTerms: '/platform-api/local-sales-contract-terms',
  salesContracts: '/platform-api/local-sales-contracts',
  salesContract: (contractId: string) => `/platform-api/contracts/${contractId}/sales-contract`,
  salesContractPreview: (contractId: string) => `/platform-api/contracts/${contractId}/sales-contract/preview`,
  salesContractHtml: (contractId: string) => `/platform-api/contracts/${contractId}/sales-contract/html`,
  salesContractReprint: (contractId: string) => `/platform-api/contracts/${contractId}/sales-contract/reprint`,
} as const

export const LOCAL_OWNER_RECOVERY_ENDPOINTS = {
  list: '/platform-api/local-owner-recoveries',
  detail: (id: string) => `/platform-api/local-owner-recoveries/${id}`,
  importChallenge: '/platform-api/local-owner-recoveries/import-challenge',
  approve: (id: string) => `/platform-api/local-owner-recoveries/${id}/approve`,
  reject: (id: string) => `/platform-api/local-owner-recoveries/${id}/reject`,
  revoke: (id: string) => `/platform-api/local-owner-recoveries/${id}/revoke`,
} as const

export interface PlatformCustomerListItemDto {
  id: string
  businessName: string
  ownerName: string
  phone?: string | null
  email?: string | null
  status: string
  leadSource?: string | null
  assignedSalesRepPlatformAdminUserId?: string | null
  tenantId?: string | null
  openTicketCount: number
  createdAtUtc: string
}

export interface PlatformCustomerDetailDto extends PlatformCustomerListItemDto {
  whatsApp?: string | null
  address?: string | null
  preferredContactMethod: string
  notes?: string | null
  createdByPlatformAdminUserId?: string | null
  ownerUsername?: string | null
  ownerEmail?: string | null
  ownerAccountStatus: string
  ownerAccountCreatedAtUtc?: string | null
  ownerLastLoginAtUtc?: string | null
  passwordResetInitiatedAtUtc?: string | null
  updatedAtUtc: string
}

export interface UpsertPlatformCustomerRequest {
  businessName: string
  ownerName: string
  phone?: string | null
  whatsApp?: string | null
  email?: string | null
  address?: string | null
  preferredContactMethod?: string | null
  notes?: string | null
  status?: string | null
  leadSource?: string | null
  assignedSalesRepPlatformAdminUserId?: string | null
  tenantId?: string | null
  ownerUsername?: string | null
  ownerEmail?: string | null
}

export interface PlatformCatalogProductDto {
  id: string
  sku: string
  name: string
  description?: string | null
  productType: string
  defaultPrice: number
  currency: string
  isActive: boolean
}

export interface UpsertCatalogProductRequest {
  sku: string
  name: string
  description?: string | null
  productType: string
  defaultPrice: number
  isActive: boolean
}

export interface ContractItemInput {
  catalogProductId?: string | null
  name?: string | null
  quantity: number
  unitPrice?: number | null
  discountAmount?: number
}

export interface CreatePlatformContractRequest {
  customerId: string
  contractDate?: string | null
  startDate?: string | null
  endDate?: string | null
  discount?: number
  notes?: string | null
  items: ContractItemInput[]
}

export interface PlatformContractItemDto {
  id: string
  catalogProductId?: string | null
  skuSnapshot: string
  nameSnapshot: string
  productTypeSnapshot: string
  descriptionSnapshot?: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  lineTotal: number
}

export interface PlatformContractDto {
  id: string
  customerId: string
  customerName?: string | null
  contractNumber: string
  contractDate: string
  startDate?: string | null
  endDate?: string | null
  status: string
  currency: string
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  notes?: string | null
  createdAtUtc: string
  items: PlatformContractItemDto[]
}

export interface ChangeContractStatusRequest {
  status: string
}

export interface RecordCustomerPaymentRequest {
  contractId: string
  amount: number
  paymentDate?: string | null
  paymentMethod: string
  reference?: string | null
  notes?: string | null
}

export interface PlatformCustomerPaymentDto {
  id: string
  customerId: string
  contractId: string
  contractNumber?: string | null
  amount: number
  currency: string
  paymentDate: string
  paymentMethod: string
  reference?: string | null
  notes?: string | null
  createdAtUtc: string
}

export interface CreateSupportTicketRequest {
  customerId: string
  contractId?: string | null
  localLicenseId?: string | null
  localInstallationId?: string | null
  subject: string
  description: string
  priority?: string | null
}

export interface UpdateSupportTicketRequest {
  status?: string | null
  priority?: string | null
  assignedToPlatformAdminUserId?: string | null
  resolution?: string | null
}

export interface PlatformSupportTicketDto {
  id: string
  ticketNumber: string
  customerId: string
  customerName?: string | null
  contractId?: string | null
  localLicenseId?: string | null
  localInstallationId?: string | null
  subject: string
  description: string
  priority: string
  status: string
  assignedToPlatformAdminUserId?: string | null
  createdAtUtc: string
  updatedAtUtc: string
  resolvedAtUtc?: string | null
  resolution?: string | null
}

export interface DeskFeedbackDto {
  id: string
  customerId?: string | null
  customerName?: string | null
  tenantId: string
  gymCode?: string | null
  gymName?: string | null
  senderUserId: string
  senderRole: string
  senderEmail?: string | null
  senderDisplayName?: string | null
  category: string
  subject?: string | null
  message: string
  status: string
  appVersion?: string | null
  pageUrl?: string | null
  internalNote?: string | null
  responseToCustomer?: string | null
  reviewedByPlatformAdminUserId?: string | null
  createdAtUtc: string
  updatedAtUtc: string
  alreadySubmitted?: boolean
}

export interface UpdateDeskFeedbackRequest {
  status?: string | null
  internalNote?: string | null
  responseToCustomer?: string | null
}

export interface InitiateOwnerPasswordResetRequest {
  reason: string
}

export interface InitiateOwnerPasswordResetResult {
  initiated: boolean
  message: string
}

export interface PlatformCustomerProfileDto {
  customer: PlatformCustomerDetailDto
  latestContract?: PlatformContractDto | null
  purchasedItems: PlatformContractItemDto[]
  contractTotal: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  license?: LocalLicenseListItemDto | null
  licenses?: LocalLicenseListItemDto[] | null
  installation?: LocalInstallationDto | null
  openSupportTicketCount: number
  lastValidation?: string | null
}

export type LocalOwnerRecoveryStatus =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'revoked'

export interface LocalOwnerRecoveryHistoryItemDto {
  atUtc: string
  event: string
  actor?: string | null
  outcome?: string | null
  reason?: string | null
}

export interface LocalOwnerRecoveryListItemDto {
  id: string
  licenseId: string
  customerId?: string | null
  installationId: string
  gymCode: string
  gymName?: string | null
  status: LocalOwnerRecoveryStatus | string
  method: string
  createdAtUtc: string
  expiresAtUtc?: string | null
  completedAtUtc?: string | null
  reference: string
}

export interface LocalOwnerRecoveryDetailDto extends LocalOwnerRecoveryListItemDto {
  approvedAtUtc?: string | null
  rejectedAtUtc?: string | null
  revokedAtUtc?: string | null
  decisionByPlatformUserId?: string | null
  decisionReason?: string | null
  history: LocalOwnerRecoveryHistoryItemDto[]
  recoveryCode?: string | null
}

export interface OwnerRecoveryDecisionRequest {
  reason: string
  method?: 'online' | 'offline' | string
}

export interface LocalSalesContractTermsDto {
  termsEn: string
  termsAr: string
  updatedAtUtc: string
}

export interface UpsertLocalSalesContractTermsRequest {
  termsEn: string
  termsAr: string
}

export interface LocalSalesContractDocumentDto {
  id: string
  contractId: string
  customerId: string
  contractNumber: string
  language: string
  status: string
  issuedAtUtc: string
  printCount: number
  lastPrintedAtUtc?: string | null
}

export interface LocalSalesContractHtmlDto extends LocalSalesContractDocumentDto {
  html: string
  issued: boolean
}

export const PLANS_ENDPOINTS = {
  list: '/platform-api/plans',
  detail: (tier: string) => `/platform-api/plans/${tier}`,
  history: (tier: string) => `/platform-api/plans/${tier}/history`,
  metadata: (tier: string) => `/platform-api/plans/${tier}/metadata`,
  pricing: (tier: string) => `/platform-api/plans/${tier}/pricing`,
  caps: (tier: string) => `/platform-api/plans/${tier}/caps`,
  features: (tier: string) => `/platform-api/plans/${tier}/features`,
  salesStatus: (tier: string) => `/platform-api/plans/${tier}/sales-status`,
  setDefault: (tier: string) => `/platform-api/plans/${tier}/set-default`,
} as const
