/**
 * HyMotion — Frontend API Contracts
 *
 * Generated directly from GMS.Api / GMS.Application / GMS.Core source (controllers, DTOs,
 * constants, enums). Every type here corresponds to a real C# class/route that exists in the
 * backend today. No endpoint, field, or status code in this file is invented.
 *
 * Companion document: FRONTEND_INTEGRATION_PROMPTS.md (feature-by-feature user flows,
 * state management, validation, edge cases). This file is the machine-shaped contract layer;
 * that file is the narrative/behavioral layer. Read both.
 *
 * ── Conventions ──
 * - JSON casing: ASP.NET Core's default System.Text.Json policy is camelCase for all controller
 *   responses/requests (no custom JsonOptions registered in Program.cs) — every field below is
 *   named as it appears on the wire, already camelCase.
 * - Guid            -> string (UUID)
 * - DateTime        -> string (ISO 8601 UTC, e.g. "2026-07-13T14:30:00Z")
 * - DateOnly        -> string ("YYYY-MM-DD")
 * - TimeOnly        -> string ("HH:mm:ss")
 * - decimal         -> number
 * - enum types used DIRECTLY as a DTO field (rare — see ManualCheckinReason below) serialize as
 *   their numeric ordinal, NOT as a string. No JsonStringEnumConverter is registered anywhere in
 *   the codebase. Every other "enum-like" concept in this API (role, status, plan type, payment
 *   method, etc.) is modeled as a plain lowercase/snake_case STRING in the DTOs themselves —
 *   those are listed below as TS string-literal unions for convenience, not because the backend
 *   enforces them via a real enum.
 * - Nullable C# properties (`Type?` / `string?`) are marked optional AND `| null` below to match
 *   exactly what System.Text.Json emits (a present-but-null field, not an absent key).
 */

// ═══════════════════════════════════════════════════════════════════════════
// § 0. Cross-cutting: transport, auth, pagination, errors, feature flags
// ═══════════════════════════════════════════════════════════════════════════

/** Every tenant-scoped request must resolve a tenant. Preferred: the `gym_code` JWT claim
 *  (set automatically once logged in). Fallback: an `X-Gym-Code` header — required only for
 *  the two auth endpoints that precede having a token (POST /api/auth/login, POST /api/auth/member-otp,
 *  POST /api/auth/member-verify all take gymCode in the body instead). TenantMiddleware caches the
 *  resolved tenant for 10 minutes per gym code. */
export interface TenantHeader {
  "X-Gym-Code"?: string;
}

/** Decoded JWT claims. Staff tokens carry role + discrete "perm" claims (17 possible values,
 *  baked in at login — no per-request DB/permission check). Member tokens carry no role claim
 *  and no working `member_id` claim (see note). `sub` is the ASP.NET Identity user id in both
 *  cases; for member accounts this IS the value to use as the member's identity for ownership
 *  checks (see NOTE below). */
export interface JwtClaims {
  sub: string; // Guid — ASP.NET Identity user id (== member id for member logins, see note)
  email: string;
  jti: string;
  tenant_id: string; // Guid
  gym_code: string;
  first_name: string;
  last_name: string;
  /** ClaimTypes.Role — one or more of: "Owner" | "Manager" | "Trainer" | "Member" | "Receptionist".
   *  Absent entirely for... actually always present; staff and member logins both add role claims
   *  via ASP.NET Identity's role assignment. */
  role?: string | string[];
  /** Repeated claim, one entry per granted permission string (see PermissionKey below). Present
   *  only for staff-type roles; member-role tokens are granted none of these by ResolvePermissionsAsync. */
  perm?: string | string[];
}
/** NOTE (verified against GMS.Infrastructure/Services/TokenService.cs and
 *  GMS.Application/Services/AuthService.cs): NO code path ever adds a `member_id` claim to any
 *  JWT — `TokenService.GenerateAccessTokenAsync` only emits sub/email/jti/tenant_id/gym_code/
 *  first_name/last_name/role/perm. Member-scoped APIs (notifications, invitations) receive
 *  Identity `sub` and must resolve GymMember via AppUser (UserId == sub → GymMember.AppUserId).
 *  Do not treat `sub` as GymMember.Id on the client or server. */

/** GET/list endpoints that accept page/pageSize return this envelope. */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Shape A — RFC7807 ProblemDetails, returned by controllers that route Result<T> failures
 *  through a `ProblemFromResult(error)` helper (Sales, Shifts, Refunds, Trials, ZReports,
 *  CallSheet, Debtors, Imports). `title` is always the machine-readable CODE (e.g.
 *  "OPEN_SHIFT_REQUIRED"), `detail` is the human message, `status` is the mapped HTTP status. */
export interface ProblemDetailsError {
  type?: string;
  title: string; // machine-readable code
  status: number;
  detail: string; // human message
  instance?: string;
}

/** Shape B — ad-hoc anonymous JSON object, returned by controllers that did NOT adopt the
 *  ProblemDetails helper (Members, Memberships, Admin, Notifications, Invitation,
 *  TenantSettings, Attendance, Auth, PromoCodes, MembershipPlans, Analytics, Reports, Audit).
 *  Shape varies by call site — the two forms actually seen in source are: */
export type AdHocError =
  | { message: string }
  | { error: string; message?: string };

export type ApiError = ProblemDetailsError | AdHocError;

/** Legacy DTO type (GMS.Application.DTOs.ErrorResponse) — declared in source but not
 *  constructed/returned by any controller found in this survey. Do not build error handling
 *  against this shape; it is dead code as far as the API surface goes. */
export interface ErrorResponse {
  message: string;
  details?: string | null;
  statusCode: number;
}

/** Idempotency: ONLY POST /api/sales supports this. Send either the `X-Idempotency-Key` header
 *  or the `idempotencyKey` field in the body — the header wins if both are present. No other
 *  endpoint in the API (refund execution, invoice creation, import execution included) exposes
 *  a client-supplied idempotency key. */
export interface IdempotencyHeader {
  "X-Idempotency-Key"?: string;
}

/** Feature flags live in Tenant.Settings JSON under "feature_flags" and gate modules via
 *  [FeatureFlag("...")] on the controller class. Tier map is authoritative for plan packaging;
 *  Settings deny overlay can still force false. A disabled module returns 404 with title "FEATURE_DISABLED". */
export interface FeatureFlagsDto {
  sales: boolean;
  shifts: boolean;
  trials: boolean;
  refunds: boolean;
  debtors: boolean;
  imports: boolean;
  inventory: boolean;
  /** Pro+ On Hand / Move / Count hub. Starter/Growth use Products desk only. */
  stock_management: boolean;
}
/** Controllers actually decorated with [FeatureFlag(...)]: SalesController("sales"),
 *  ShiftsController("shifts"), TrialController("trials"), RefundsController("refunds"),
 *  DebtorsController("debtors"), ImportsController("imports"), inventory controllers
 *  ("inventory"), InventoryTransfersController + InventoryCountsController ("stock_management").
 *  NOTE: CallSheetController has NO [FeatureFlag] attribute despite being an operational sibling
 *  of these — call-sheet endpoints are NOT gated by any flag. */

/** Role policies (ASP.NET named policies, distinct from the fine-grained perm system below):
 *  OwnerOnly, ManagerOrAbove (Owner|Manager), AnyStaff (Owner|Manager|Trainer — Receptionist
 *  is NOT included; Quick Actions GET uses an explicit four-role list instead).
 *  AuthenticatedMember (Member role only), AnyAuthenticated (any valid JWT regardless of role).
 *  Frontend GfpAuthz.AnyStaff includes Receptionist for nav/shell `kind: 'any'` only — that is
 *  not the ASP.NET policy.
export type RolePolicy =
  | "OwnerOnly"
  | "ManagerOrAbove"
  | "AnyStaff"
  | "AuthenticatedMember"
  | "AnyAuthenticated";

/** Fine-grained permission strings — the "perm" JWT claim values. Exhaustive
 *  (GMS.Core.Constants.Permissions.All). Owner is granted all at login; other roles get a
 *  subset resolved server-side (not documented in this DTO layer — treat as backend-authoritative,
 *  the frontend should gate UI on the actual `perm` claims present in the token, not on role name). */
export type PermissionKey =
  | "members.view"
  | "members.create"
  | "members.edit"
  | "checkin.manual"
  | "sales.sell"
  | "sales.discount.apply"
  | "sales.discount.override"
  | "payments.cash.accept"
  | "payments.refund.request"
  | "payments.refund.approve"
  | "shift.open"
  | "shift.close"
  | "shift.reconcile.approve"
  | "memberships.freeze"
  | "plans.manage"
  | "reports.financial.view"
  | "settings.manage"
  | "inventory.view"
  | "inventory.manage"
  | "inventory.adjust"
  | "inventory.purchase"
  | "inventory.transfer"
  | "member_orders.view"
  | "member_orders.manage";

/** Canonical Identity role names as returned on the wire (PascalCase).
 *  Create/Update accept case-insensitive input. Staff API `id` is ApplicationUser.Id (JWT sub). */
export type StaffRole = "Owner" | "Manager" | "Trainer" | "Receptionist";

// ═══════════════════════════════════════════════════════════════════════════
// § 1. Authentication & Session (AuthController — api/auth, no [Authorize] prefix)
// ═══════════════════════════════════════════════════════════════════════════

export interface LoginRequest {
  email: string;
  password: string;
  gymCode: string;
}
export interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string;
  gymCode: string;
}
export interface LoginResponse {
  accessToken: string; // 15 min expiry
  refreshToken: string; // 30 day expiry
  expiresAtUtc: string;
  user: UserInfo;
}
export interface RefreshTokenRequest {
  refreshToken: string;
}
export interface MemberOtpRequest {
  phoneNumber: string; // international format e.g. +201234567890
  gymCode: string;
}
export interface MemberOtpVerifyRequest {
  phoneNumber: string;
  gymCode: string;
  otp: string; // 6-digit
}

export const AUTH_ENDPOINTS = {
  login: { method: "POST", path: "/api/auth/login" }, // body: LoginRequest -> LoginResponse
  refresh: { method: "POST", path: "/api/auth/refresh" }, // body: RefreshTokenRequest -> LoginResponse
  memberOtpSend: { method: "POST", path: "/api/auth/member-otp" }, // body: MemberOtpRequest
  memberOtpVerify: { method: "POST", path: "/api/auth/member-verify" }, // body: MemberOtpVerifyRequest -> LoginResponse
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 2. Members (MembersController — api/members, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface MemberListItemDto {
  id: string;
  memberNumber: string;
  fullName: string;
  fullNameAr: string;
  phone: string;
  isActive: boolean;
  activePlan?: string | null;
  activePlanAr?: string | null;
  expiryDate?: string | null; // DateOnly
  membershipStatus?: string | null;
  planType?: string | null;
  sessionsRemaining?: number | null;
}
export interface MembershipSummaryDto {
  id: string;
  planName: string;
  planNameAr: string;
  planType: string;
  status: string; // active | expired | frozen | cancelled | pending
  startDate: string; // DateOnly
  endDate: string; // DateOnly
  sessionsRemaining?: number | null;
  frozenFromDate?: string | null;
  frozenUntilDate?: string | null;
  amountPaid: number;
  paymentMethod: string;
}
export interface AttendanceSummaryDto {
  id: string;
  checkInAtUtc: string;
  checkOutAtUtc?: string | null;
  entryMethod: string;
}
export interface MemberDetailDto {
  id: string;
  memberNumber: string;
  fullName: string;
  fullNameAr: string;
  phone: string;
  email: string;
  dateOfBirth: string; // DateOnly
  profilePhotoUrl?: string | null;
  notes?: string | null;
  isActive: boolean;
  invitationQuotaRemaining: number;
  referralCode?: string | null;
  successfulReferralCount?: number;
  referralTier?: string | null;
  createdAtUtc: string;
  currentMembership?: MembershipSummaryDto | null;
  recentAttendance: AttendanceSummaryDto[]; // last 5
}
export interface CreateMemberRequest {
  fullName: string;
  fullNameAr: string;
  phone: string;
  dateOfBirth: string; // DateOnly
  nationalId?: string | null;
  emergencyContact?: string | null;
  email?: string | null;
  notes?: string | null;
}
export interface UpdateMemberRequest {
  fullName?: string | null;
  fullNameAr?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  emergencyContact?: string | null;
  email?: string | null;
  notes?: string | null;
}
export interface FreezeMembershipRequest {
  frozenUntil: string; // DateTime
  reason?: string | null;
}
export interface MemberCreditEntryDto {
  id: string;
  amount: number;
  entryType: "refund" | "payment_use" | "adjustment";
  referenceId?: string | null;
  reason?: string | null;
  createdAtUtc: string;
}
export interface MemberCreditSummaryDto {
  balance: number;
  entries: MemberCreditEntryDto[];
}

export const MEMBERS_ENDPOINTS = {
  list: { method: "GET", path: "/api/members" }, // query: search?, status?, page=1, pageSize=20 -> PagedResult<MemberListItemDto> ; perm members.view
  get: (id: string) => ({ method: "GET", path: `/api/members/${id}` }), // -> MemberDetailDto ; perm members.view
  create: { method: "POST", path: "/api/members" }, // body: CreateMemberRequest ; perm members.create
  update: (id: string) => ({ method: "PUT", path: `/api/members/${id}` }), // body: UpdateMemberRequest ; perm members.edit
  deactivate: (id: string) => ({ method: "DELETE", path: `/api/members/${id}` }), // policy OwnerOnly
  attendance: (id: string) => ({ method: "GET", path: `/api/members/${id}/attendance` }), // query: page=1, pageSize=20 ; perm members.view
  currentMembership: (id: string) => ({ method: "GET", path: `/api/members/${id}/membership` }), // -> MembershipSummaryDto ; perm members.view
  freeze: (id: string) => ({ method: "POST", path: `/api/members/${id}/freeze` }), // body: FreezeMembershipRequest ; perm memberships.freeze
  unfreeze: (id: string) => ({ method: "POST", path: `/api/members/${id}/unfreeze` }), // perm memberships.freeze
  credits: (id: string) => ({ method: "GET", path: `/api/members/${id}/credits` }), // -> MemberCreditSummaryDto ; perm members.view
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 3. Membership Plans (MembershipPlansController — api/membership-plans, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

/** PlanType is a free string, not a real C# enum. Valid values per doc-comments in
 *  CreatePlanRequest/UpdatePlanRequest: */
export type PlanType =
  | "monthly_unlimited"
  | "session_pack"
  | "time_limited"
  | "pt_credits"
  | "family"
  | "trial"
  | "day_pass";

export interface PlanListItemDto {
  id: string;
  name: string;
  nameAr: string;
  planType: string;
  price: number;
  currency: string; // default "EGP"
  durationDays: number;
  isActive: boolean;
  createdAtUtc: string;
}
export interface PlanDetailDto {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  planType: string;
  price: number;
  currency: string;
  durationDays: number;
  sessionCount?: number | null;
  timeRestrictionStart?: string | null; // TimeOnly
  timeRestrictionEnd?: string | null;
  invitationQuota: number; // retired guest-pass column
  referralInviteQuota: number; // Invitations per covering membership
  /** credit | free_days — null = not configured */
  referralRewardType?: string | null;
  referralRewardValue?: number | null;
  trialVisitLimit?: number | null;
  isActive: boolean;
  activeMemberships: number;
  totalMemberships: number;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}
export interface CreatePlanRequest {
  name: string;
  nameAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  planType: PlanType; // default "monthly_unlimited"
  price: number;
  durationDays: number;
  sessionCount?: number | null; // session_pack: 10, 20, or 50
  timeRestrictionStart?: string | null; // time_limited plans
  timeRestrictionEnd?: string | null;
  invitationQuota?: number; // retired guest-pass column, default 0
  referralInviteQuota?: number; // Invitations per covering membership, default 0
  referralRewardType?: "credit" | "free_days" | null;
  referralRewardValue?: number | null;
  trialVisitLimit?: number | null; // trial plans
}
export type UpdatePlanRequest = CreatePlanRequest;

export const PLANS_ENDPOINTS = {
  list: { method: "GET", path: "/api/membership-plans" }, // -> PlanListItemDto[] (NOT paged) ; perm plans.manage
  get: (id: string) => ({ method: "GET", path: `/api/membership-plans/${id}` }), // -> PlanDetailDto ; perm plans.manage
  create: { method: "POST", path: "/api/membership-plans" }, // body: CreatePlanRequest ; perm plans.manage
  update: (id: string) => ({ method: "PUT", path: `/api/membership-plans/${id}` }), // body: UpdatePlanRequest ; perm plans.manage
  delete: (id: string) => ({ method: "DELETE", path: `/api/membership-plans/${id}` }), // perm plans.manage
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 4. Memberships — Assign/Renew/History (MembershipsController — api/memberships, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface MembershipDto {
  id: string;
  planName: string;
  planNameAr: string;
  planType: string;
  startDate: string;
  endDate: string;
  status: string;
  sessionsRemaining?: number | null;
  amountPaid: number;
  paymentMethod: string;
  paymentDate?: string | null;
  autoRenew: boolean;
  frozenFromDate?: string | null;
  frozenUntilDate?: string | null;
  daysRemaining: number; // computed server-side
}
export interface MembershipHistoryItemDto {
  id: string;
  planName: string;
  planNameAr: string;
  planType: string;
  startDate: string;
  endDate: string;
  status: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate?: string | null;
  createdAtUtc: string;
}
export interface AssignMembershipRequest {
  planId: string;
  /** 'cash' | 'paymob' | 'fawry' — cash activates immediately; gateway methods create a
   *  'pending' membership, activated later by a payment webhook. */
  paymentMethod: "cash" | "paymob" | "fawry";
  /** Cash taken now. Omit to charge the full plan price. Less than plan price → Sale.AmountDue (Collect Payment). Ignored for gateway. */
  amountPaid?: number | null;
}
export interface RenewMembershipRequest {
  planId?: string | null; // null = renew same plan
  paymentMethod: "cash" | "paymob" | "fawry" | "vodafone_cash"; // default "cash"
  amountPaid: number;
  /**
   * How to handle remaining days when the current membership still covers today.
   * Default: cancel_and_switch. Ignored for dating when nothing covers today.
   * Unknown values → 400.
   */
  transitionMode?: "cancel_and_switch" | "queue_next" | "manual_rollover";
}

export const MEMBERSHIPS_ENDPOINTS = {
  current: (memberId: string) => ({ method: "GET", path: `/api/memberships/${memberId}/current` }), // policy AnyStaff -> MembershipDto
  history: (memberId: string) => ({ method: "GET", path: `/api/memberships/${memberId}/history` }), // query: page=1, pageSize=20 ; policy AnyStaff -> PagedResult<MembershipHistoryItemDto>
  assign: (memberId: string) => ({ method: "POST", path: `/api/memberships/${memberId}/assign` }), // body: AssignMembershipRequest ; policy ManagerOrAbove -> 201 MembershipDto | 409 if already active
  renew: (memberId: string) => ({ method: "POST", path: `/api/memberships/${memberId}/renew` }), // body: RenewMembershipRequest ; policy ManagerOrAbove -> MembershipDto
  cancel: (memberId: string) => ({ method: "POST", path: `/api/memberships/${memberId}/cancel` }), // policy ManagerOrAbove -> MembershipDto ; not a refund; 409 if expired/already cancelled
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 5. Attendance & Check-In (AttendanceController — api/attendance)
// ═══════════════════════════════════════════════════════════════════════════

/** ManualCheckinReason is a REAL C# enum used directly as a DTO field type — it serializes as
 *  its numeric ordinal (no string converter registered). Send/expect the number, not the name. */
export const ManualCheckinReason = {
  DeadPhone: 1,
  NoAppYet: 2,
  AppIssue: 3,
  Other: 4,
} as const;
export type ManualCheckinReason = typeof ManualCheckinReason[keyof typeof ManualCheckinReason];

export interface QrCheckinRequest {
  gymCode: string; // from the gym's static QR code
}
export interface QrCheckinResponse {
  attendanceId: string;
  memberName: string;
  memberNameAr: string;
  checkInAtUtc: string;
  planName: string;
  planNameAr: string;
  sessionsRemaining?: number | null;
  message: string;
  messageAr: string;
}
export interface ManualCheckinRequest {
  memberId: string;
  reason: ManualCheckinReason; // numeric ordinal
  notes?: string | null; // for reason = Other(4)
}
export interface ManualCheckinResponse extends QrCheckinResponse {
  staffName: string;
}
export interface MemberSearchRequest {
  query: string;
  includeInactive?: boolean; // default false
}
export interface MemberSearchResult {
  id: string;
  memberNumber: string;
  fullName: string;
  fullNameAr: string;
  phoneNumber: string;
  profilePhotoUrl: string;
  membershipStatus: string; // active | expired | frozen | cancelled | none
  planName: string;
  planNameAr: string;
  planType?: string;
  sessionsRemaining?: number | null;
  isSelectable: boolean;
  unselectableReason?: string | null;
  unselectableReasonAr?: string | null;
}
export interface TodayAttendanceDto {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  memberNameAr: string;
  checkInAtUtc: string;
  checkOutAtUtc?: string | null;
  entryMethod: string;
  planName?: string | null;
}

export const ATTENDANCE_ENDPOINTS = {
  qrCheckin: { method: "POST", path: "/api/attendance/qr-checkin" }, // policy AuthenticatedMember ; body: QrCheckinRequest -> QrCheckinResponse
  manualCheckin: { method: "POST", path: "/api/attendance/manual-checkin" }, // perm checkin.manual ; body: ManualCheckinRequest -> ManualCheckinResponse
  searchMembers: { method: "GET", path: "/api/attendance/search-members" }, // perm checkin.manual ; query: MemberSearchRequest -> MemberSearchResult[]
  today: { method: "GET", path: "/api/attendance/today" }, // perm members.view ; query: filter="all" -> TodayAttendanceDto[]
  occupancy: { method: "GET", path: "/api/attendance/occupancy" }, // perm members.view -> GymOccupancyDto
} as const;

// Live occupancy is a derived view of today's open visits (checkOutAtUtc == null),
// same window as GET /attendance/today. Not a second attendance system. No status enum —
// Available/Busy/Full is presentation-only on the client.
export interface GymOccupancyDto {
  gymName: string;
  gymNameAr: string;
  gymActive: boolean;
  maxCapacity?: number | null; // null = not configured
  currentlyInside: number;
  available?: number | null; // null when maxCapacity unset; never negative
  occupancyPercent?: number | null; // may exceed 100
  source: "attendance_open_visits";
}

export const MEMBER_OCCUPANCY_ENDPOINTS = {
  get: { method: "GET", path: "/api/member/occupancy" }, // AuthenticatedMember -> GymOccupancyDto (same payload)
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 6. Point of Sale / Sales (SalesController — api/sales, [Authorize], [FeatureFlag("sales")])
// ═══════════════════════════════════════════════════════════════════════════

export type PaymentMethod = "cash" | "card_paymob" | "fawry" | "vodafone" | "instapay" | "account_credit";

export interface NewMemberRequest {
  fullName: string;
  fullNameAr?: string | null;
  phoneNumber: string;
  dateOfBirth?: string | null; // optional for walk-ins
}
export interface ManualDiscountRequest {
  amount: number;
  reason: string;
}
export interface SalePaymentRequest {
  method: PaymentMethod;
  amount: number;
}
export interface PartialPaymentRequest {
  dueDate: string; // DateOnly — presence of this object signals intent to leave a balance due
}
export interface CreateSaleRequest {
  idempotencyKey?: string | null; // or use X-Idempotency-Key header instead (header wins)
  /** Required for membership/trial lines; omit both memberId and newMember for walk-in retail-only. */
  memberId?: string | null;
  newMember?: NewMemberRequest | null;
  /** Legacy membership sale. Ignored when `lines` is non-empty. */
  planId?: string | null;
  /** Optional warehouse for retail stock deduction (defaults to tenant default warehouse). */
  warehouseId?: string | null;
  /** Explicit cart. When omitted/empty, falls back to planId-only membership sale. */
  lines?: CreateSaleLineRequest[] | null;
  promoCode?: string | null;
  manualDiscount?: ManualDiscountRequest | null;
  payments: SalePaymentRequest[];
  partialPayment?: PartialPaymentRequest | null;
  referralCode?: string | null;
  referringMemberId?: string | null;
}
export interface CreateSaleLineRequest {
  lineType: "membership" | "trial" | "day_pass" | "retail" | "fee" | string;
  productId?: string | null;
  planId?: string | null;
  qty: number;
  unitPrice?: number | null;
}
export interface RecordPaymentRequest {
  method: PaymentMethod;
  amount: number;
}
export interface SaleTotalsDto {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  amountDue: number;
}
export interface SaleInvoiceRefDto {
  invoiceId: string;
  invoiceNumber: string;
  saleId: string;
  total?: number;
  currency?: string;
}
export interface SaleResponse {
  saleId: string;
  membershipId?: string | null;
  isReplay: boolean; // true if this response came from an idempotency-key replay
  /** "ready" when invoiceId is set inline; otherwise queued | skipped | not_applicable */
  invoiceStatus: "ready" | "queued" | "skipped" | "not_applicable";
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  totals: SaleTotalsDto;
  warnings: string[];
  receiptUrl?: string | null;
}
export interface ValidatePromoRequest {
  code: string;
  planId: string;
  memberId: string;
}
export interface PromoValidationResult {
  isValid: boolean;
  failureReason?: PromoValidationReasonCode | null;
  promoCodeId?: string | null;
  code?: string | null;
  type?: "percent" | "fixed" | null;
  originalPrice?: number | null;
  discountAmount?: number | null;
  finalPrice?: number | null;
}
export type PromoValidationReasonCode =
  | "CODE_NOT_FOUND"
  | "CODE_INACTIVE"
  | "DATE_RANGE_INVALID"
  | "MAX_USES_REACHED"
  | "MEMBER_MAX_USES_REACHED"
  | "PLAN_NOT_IN_SCOPE"
  | "BELOW_MIN_PRICE"
  | "PLAN_NOT_FOUND";
/** ProblemDetails.title values for POST /api/sales and /api/sales/{id}/payments. */
export type SaleFailureCode =
  | "STAFF_USER_NOT_FOUND" // 400
  | "MEMBER_NOT_FOUND" // 400
  | "MEMBER_CREATE_FAILED" // 400
  | "PLAN_NOT_FOUND" // 400
  | "FORBIDDEN_DISCOUNT_OVERRIDE" // 403
  | "OVERPAY" // 400
  | "PAYMENT_INCOMPLETE" // 400
  | "OPEN_SHIFT_REQUIRED" // 409
  | "PROMO_RACE_LOST" // 400
  | "SALE_NOT_FOUND" // 400
  | "SALE_NOT_COLLECTABLE" // 400 — not partially_paid or AmountDue is 0 (completed / refunded)
  | "PAYMENT_EXCEEDS_AMOUNT_DUE" // 400
  | "INSUFFICIENT_CREDIT" // 400
  | "INSUFFICIENT_STOCK" // 400 — retail line, includes SKU/name in detail
  | "STOCK_UNSELLABLE_EXPIRED" // 400 — physical on-hand exists but all batches expired (FEFO)
  | "INVENTORY_REQUIRED" // 400 — retail without inventory feature
  | "WAREHOUSE_NOT_FOUND" // 400
  | "PRODUCT_NOT_FOUND" // 400
  | "MEMBER_REQUIRED"; // 400

export const SALES_ENDPOINTS = {
  validatePromo: { method: "POST", path: "/api/sales/validate-promo" }, // perm sales.sell ; body: ValidatePromoRequest -> PromoValidationResult
  create: { method: "POST", path: "/api/sales" }, // perm sales.sell ; body: CreateSaleRequest ; header X-Idempotency-Key? -> SaleResponse
  recordPayment: (id: string) => ({ method: "POST", path: `/api/sales/${id}/payments` }), // perm sales.sell ; body: RecordPaymentRequest -> SaleResponse ; Member 360 Collect Payment uses this against one outstanding sale
  /** Desk print: 404 INVOICE_NOT_READY until Hangfire creates the invoice. */
  invoiceForSale: (id: string) => ({ method: "GET", path: `/api/sales/${id}/invoice` }), // perm sales.sell -> SaleInvoiceRefDto
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 7. Promo Codes (PromoCodesController — api/promo-codes, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface PromoCodeDto {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo?: string[] | null; // plan ids, null = all plans
  validFrom: string; // DateOnly
  validTo: string;
  maxUses?: number | null;
  maxUsesPerMember?: number | null;
  usesCount: number;
  minPrice?: number | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}
export interface CreatePromoCodeRequest {
  code: string; // stored uppercased regardless of input case
  type: "percent" | "fixed"; // default "percent"
  value: number;
  appliesTo?: string[] | null;
  validFrom: string;
  validTo: string;
  maxUses?: number | null;
  maxUsesPerMember?: number | null;
  minPrice?: number | null;
}
export type UpdatePromoCodeRequest = CreatePromoCodeRequest;

export const PROMO_CODES_ENDPOINTS = {
  list: { method: "GET", path: "/api/promo-codes" }, // perm sales.sell ; query: activeOnly?, validToday?, page=1, pageSize=20 -> PagedResult<PromoCodeDto>
  get: (id: string) => ({ method: "GET", path: `/api/promo-codes/${id}` }), // perm sales.sell -> PromoCodeDto
  create: { method: "POST", path: "/api/promo-codes" }, // perm plans.manage ; body: CreatePromoCodeRequest
  update: (id: string) => ({ method: "PUT", path: `/api/promo-codes/${id}` }), // perm plans.manage ; body: UpdatePromoCodeRequest
  deactivate: (id: string) => ({ method: "DELETE", path: `/api/promo-codes/${id}` }), // perm plans.manage
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 7b. Offers (OffersController — api/offers, [Authorize])
// Member: MemberOffersController — api/member/offers, AuthenticatedMember
// ═══════════════════════════════════════════════════════════════════════════

export type OfferAppliesTo = "memberships" | "products" | "both";
export type OfferDiscountType = "percentage" | "fixed" | "bxgy";
export type OfferRedemption = "automatic" | "promoCode";
export type OfferStatus = "draft" | "scheduled" | "active" | "expired";

export interface OfferDto {
  id: string;
  name: string;
  nameAr?: string | null;
  shortDescription: string;
  shortDescriptionAr?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  start: string; // DateOnly yyyy-MM-dd
  end: string;
  appliesTo: OfferAppliesTo;
  planIds: string[];
  productIds: string[];
  membershipLabels: string[];
  productLabels: string[];
  discountType: OfferDiscountType;
  value?: number | null;
  maxDiscount?: number | null;
  buyQty?: number | null;
  getQty?: number | null;
  allMembers: boolean;
  newMembersOnly: boolean;
  minPurchase?: number | null;
  usageLimit?: number | null;
  perMemberLimit?: number | null;
  usesCount: number;
  showOnMemberApp: boolean;
  featured: boolean;
  showBanner: boolean;
  displayOrder: number;
  redemption: OfferRedemption;
  promoCode?: string | null;
  promoCodeId?: string | null;
  isDraft: boolean;
  status: OfferStatus;
  discountLabel: string;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface MemberOfferDto {
  id: string;
  name: string;
  nameAr?: string | null;
  shortDescription: string;
  shortDescriptionAr?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  start: string;
  end: string;
  appliesTo: OfferAppliesTo;
  membershipLabels: string[];
  productLabels: string[];
  discountType: OfferDiscountType;
  discountLabel: string;
  buyQty?: number | null;
  getQty?: number | null;
  newMembersOnly: boolean;
  showOnMemberApp: boolean;
  featured: boolean;
  showBanner: boolean;
  displayOrder: number;
  redemption: OfferRedemption;
  /** Present when redemption is promoCode — never the actual code. */
  promoCodeHint?: string | null;
  status: "active";
}

export interface UpsertOfferRequest {
  name: string;
  nameAr?: string | null;
  shortDescription?: string;
  shortDescriptionAr?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  start: string;
  end: string;
  appliesTo: OfferAppliesTo;
  planIds?: string[] | null;
  productIds?: string[] | null;
  membershipLabels?: string[] | null;
  productLabels?: string[] | null;
  discountType: OfferDiscountType; // "percent" accepted as percentage
  value?: number | null;
  maxDiscount?: number | null;
  buyQty?: number | null;
  getQty?: number | null;
  allMembers?: boolean;
  newMembersOnly?: boolean;
  minPurchase?: number | null;
  usageLimit?: number | null;
  perMemberLimit?: number | null;
  showOnMemberApp?: boolean;
  featured?: boolean;
  showBanner?: boolean;
  displayOrder?: number;
  redemption: OfferRedemption; // "auto" | "code" accepted
  promoCode?: string | null;
  isDraft?: boolean;
}

export const OFFERS_ENDPOINTS = {
  list: { method: "GET", path: "/api/offers" }, // perm sales.sell -> OfferDto[]
  get: (id: string) => ({ method: "GET", path: `/api/offers/${id}` }), // perm sales.sell -> OfferDto
  create: { method: "POST", path: "/api/offers" }, // perm plans.manage ; body: UpsertOfferRequest -> 201 OfferDto
  update: (id: string) => ({ method: "PUT", path: `/api/offers/${id}` }), // perm plans.manage ; body: UpsertOfferRequest
  end: (id: string) => ({ method: "POST", path: `/api/offers/${id}/end` }), // perm plans.manage ; sets end=yesterday Cairo so status is expired now, deactivates linked promo
} as const;

export const MEMBER_OFFERS_ENDPOINTS = {
  list: { method: "GET", path: "/api/member/offers" }, // AuthenticatedMember -> MemberOfferDto[] (visible + in-date + eligibility)
  get: (id: string) => ({ method: "GET", path: `/api/member/offers/${id}` }), // 404 if hidden/expired/draft
} as const;

// Desk UI: /dashboard/offers/ is API-backed. Publishing a promo-code offer also creates/updates /api/promo-codes.
// Member App: use MEMBER_OFFERS_ENDPOINTS. Do not call staff /api/promo-codes.

// ═══════════════════════════════════════════════════════════════════════════
// § 8. Cash Drawer / Shifts (ShiftsController — api/shifts, [Authorize], [FeatureFlag("shifts")])
// ═══════════════════════════════════════════════════════════════════════════

export interface CashMovementDto {
  id: string;
  type: "sale" | "refund" | "paid_in" | "paid_out" | "float_adjust";
  amount: number; // signed: positive = cash in, negative = cash out
  referenceId?: string | null;
  reason?: string | null;
  createdByUserId: string;
  createdAtUtc: string;
}
export interface ShiftDto {
  id: string;
  userId: string;
  userName?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  /** Null while open (blind-count design: counting staff must not see the expected total before
   *  entering their physical count). Populated only once closed. */
  expectedCash?: number | null;
  countedCash?: number | null;
  variance?: number | null;
  varianceNote?: string | null;
  approvedByUserId?: string | null;
  status: "open" | "closed" | "approved";
  movements: CashMovementDto[];
}
export interface OpenShiftRequest {
  openingFloat: number;
}
export interface CloseShiftRequest {
  countedCash: number;
  varianceNote?: string | null;
}
export interface RecordMovementRequest {
  /** Only 'paid_in' | 'paid_out' | 'float_adjust' may be POSTed — 'sale'/'refund' rows are
   *  recorded internally by the sale/refund flows. */
  type: "paid_in" | "paid_out" | "float_adjust";
  /** SIGN CONVENTION (verified in ShiftService.RecordMovementAsync/NormalizeSignedAmount):
   *  for paid_in/paid_out, send a POSITIVE magnitude — the server normalizes the sign itself
   *  (paid_in -> positive, paid_out -> negative) regardless of what you send. For float_adjust,
   *  the server uses your literal signed value as-is (positive or negative). */
  amount: number;
  referenceId?: string | null;
  reason?: string | null;
}
export interface ApproveShiftRequest {
  note?: string | null;
}
export interface ShiftOpenSummaryDto {
  openShifts: ShiftDto[];
  totalCashInDrawers: number;
}
/** ProblemDetails.title values for shift endpoints. */
export type ShiftFailureCode =
  | "STAFF_USER_NOT_FOUND"
  | "SHIFT_ALREADY_OPEN" // 409
  | "NO_OPEN_SHIFT" // 409
  | "SHIFT_NOT_FOUND" // 404
  | "NOT_AWAITING_APPROVAL" // 409
  | "MANAGER_APPROVAL_REQUIRED" // 403
  | "INVALID_MOVEMENT_TYPE"
  | "SHIFT_NOT_OPEN"; // 409

export const SHIFTS_ENDPOINTS = {
  open: { method: "POST", path: "/api/shifts/open" }, // perm shift.open ; body: OpenShiftRequest -> ShiftDto
  current: { method: "GET", path: "/api/shifts/current" }, // perm shift.open -> ShiftDto
  closeCurrent: { method: "POST", path: "/api/shifts/current/close" }, // perm shift.close ; body: CloseShiftRequest -> ShiftDto
  recordMovement: { method: "POST", path: "/api/shifts/current/movements" }, // perm shift.open ; body: RecordMovementRequest -> CashMovementDto | ShiftDto
  /** Part 2 — server-side movements page (RLS-safe count). Prefer shift-scoped path; current alias OK for open drawer. */
  listMovements: (id: string) => ({
    method: "GET",
    path: `/api/shifts/${id}/movements`,
  }), // query: page=1, pageSize=8|20 -> PagedResult<CashMovementDto>
  listCurrentMovements: {
    method: "GET",
    path: "/api/shifts/current/movements",
  }, // query: page=1, pageSize=8|20 -> PagedResult<CashMovementDto> (same resource as POST record)
  approve: (id: string) => ({ method: "POST", path: `/api/shifts/${id}/approve` }), // perm shift.reconcile.approve ; body: ApproveShiftRequest
  forceClose: (id: string) => ({ method: "POST", path: `/api/shifts/${id}/force-close` }), // policy ManagerOrAbove
  /** ManagerOrAbove. Dates: from|startDate, to|endDate. Staff: userId|staffId. Count must run under tenant RLS/SESSION_CONTEXT. */
  list: { method: "GET", path: "/api/shifts" }, // query: from?, to?, startDate?, endDate?, userId?, staffId?, page=1, pageSize=20 -> PagedResult<ShiftDto>
  openSummary: { method: "GET", path: "/api/shifts/open-summary" }, // perm reports.financial.view -> ShiftOpenSummaryDto
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 9. Refunds & Account Credit (RefundsController — api/refunds, [Authorize], [FeatureFlag("refunds")])
// Staff initiate refunds from Sale context (POS receipt / invoice / onboard sale), not a Refunds nav module.
// GET list remains payments.refund.approve (history). Amount-based; remainder = sale.Total − SUM(executed).
// ═══════════════════════════════════════════════════════════════════════════

export interface RefundDto {
  id: string;
  saleId: string;
  paymentTransactionId?: string | null;
  amount: number;
  method: "cash" | "gateway" | "credit";
  reason: string;
  requestedByUserId: string;
  approvedByUserId?: string | null;
  status: "requested" | "approved" | "executed" | "rejected";
  rejectionNote?: string | null;
  creditNoteInvoiceId?: string | null;
  executedAt?: string | null;
  createdAtUtc: string;
  /** INVS-7: true when approve fully restored retail stock (full sale refund only). */
  stockRestored?: boolean;
}
export interface RequestRefundRequest {
  saleId: string;
  amount: number;
  /** 'gateway' is a listed value but NOT implemented server-side — requesting it fails with
   *  GATEWAY_REFUND_UNSUPPORTED. Only 'cash' and 'credit' currently work end-to-end. */
  method: "cash" | "gateway" | "credit";
  reason: string;
}
export interface RejectRefundRequest {
  note: string;
}
/** ProblemDetails.title values for refund endpoints. */
export type RefundFailureCode =
  | "STAFF_USER_NOT_FOUND"
  | "SALE_NOT_FOUND" // 404
  | "REFUND_NOT_FOUND" // 404
  | "REFUND_EXCEEDS_REMAINDER"
  | "SALE_FULLY_REFUNDED" // 409
  | "NOT_AWAITING_APPROVAL" // 409
  | "SELF_APPROVAL_FORBIDDEN" // 403 — approver cannot be the same user who requested it
  | "OPEN_SHIFT_REQUIRED" // 409
  | "GATEWAY_REFUND_UNSUPPORTED" // 409 — method:"gateway" always fails this today
  | "INSUFFICIENT_CREDIT"
  | "ORIGINAL_SALE_MOVEMENT_MISSING" // 400 — INVS-7 integrity
  | "STOCK_RESTORE_FAILED"; // 400

export const REFUNDS_ENDPOINTS = {
  request: { method: "POST", path: "/api/refunds" }, // perm payments.refund.request ; body: RequestRefundRequest
  approve: (id: string) => ({ method: "POST", path: `/api/refunds/${id}/approve` }), // perm payments.refund.approve
  reject: (id: string) => ({ method: "POST", path: `/api/refunds/${id}/reject` }), // perm payments.refund.approve ; body: RejectRefundRequest
  list: { method: "GET", path: "/api/refunds" }, // perm payments.refund.approve ; query: saleId?, memberId?, status? -> RefundDto[]
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 10. Invoices & Receipts (InvoicesController — api/invoices, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoiceLineSnapshotDto {
  description: string;
  descriptionAr?: string | null;
  qty: number; // default 1
  unitPrice: number;
  lineTotal: number;
}
export interface InvoiceDto {
  id: string;
  type: "invoice" | "credit_note";
  invoiceNumber: string;
  saleId?: string | null;
  originalInvoiceId?: string | null;
  memberNameSnapshot: string;
  memberPhoneSnapshot: string;
  lines: InvoiceLineSnapshotDto[];
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  issuedAt: string;
  pdfUrl?: string | null;
  status: "issued" | "voided";
  voidReason?: string | null;
}
export interface InvoiceQueryRequest {
  from?: string | null;
  to?: string | null;
  memberId?: string | null;
  status?: "issued" | "voided" | null;
  type?: "invoice" | "credit_note" | null;
  /** SaleLine.LineType filter for Finance hub Sell tabs */
  lineType?: "membership" | "retail" | "trial" | "day_pass" | "fee" | string | null;
  page?: number; // default 1
  pageSize?: number; // default 20
}
export interface VoidInvoiceRequest {
  reason: string;
}
export interface PaymentReceiptInfoDto {
  amount: number;
  paidAtUtc: string;
  method?: string | null;
}

export const INVOICES_ENDPOINTS = {
  list: { method: "GET", path: "/api/invoices" }, // perm reports.financial.view ; query: InvoiceQueryRequest -> PagedResult<InvoiceDto>
  get: (id: string) => ({ method: "GET", path: `/api/invoices/${id}` }), // perm reports.financial.view -> InvoiceDto
  void: (id: string) => ({ method: "POST", path: `/api/invoices/${id}/void` }), // perm payments.refund.approve ; body: VoidInvoiceRequest
  resend: (id: string) => ({ method: "POST", path: `/api/invoices/${id}/resend` }), // perm sales.sell
  receiptHtml: (id: string, paymentId?: string, format?: "a4" | "thermal") => {
    const q = new URLSearchParams();
    if (paymentId) q.set("paymentId", paymentId);
    if (format) q.set("format", format);
    const qs = q.toString();
    return {
      method: "GET" as const,
      path: `/api/invoices/${id}/receipt-html${qs ? `?${qs}` : ""}`,
    };
  }, // perm sales.sell -> text/html. Default thermal 80mm; format=a4 is branded A4. Same invoice totals.
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 11. Daily Z-Report (ZReportController — api/reports/z, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface ZReportMethodTotalDto {
  method: string; // cash | card_paymob | fawry | vodafone | instapay | account_credit
  count: number;
  total: number;
}
export interface ZReportLineTypeTotalDto {
  lineType: "membership" | "trial" | "day_pass" | "retail" | "fee";
  count: number;
  revenue: number;
}
export interface ZReportShiftRowDto {
  userId: string;
  userName: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  variance?: number | null;
  status: "open" | "closed" | "approved";
}
export interface ZReportDto {
  id: string;
  tenantId: string;
  reportDate: string; // DateOnly
  pdfUrl?: string | null;
  generatedAt: string;
  generatedByUserId?: string | null;
  methodTotals: ZReportMethodTotalDto[];
  lineTypeTotals: ZReportLineTypeTotalDto[];
  promoDiscountTotal: number;
  manualDiscountTotal: number;
  manualDiscountCount: number;
  refundsTotal: number;
  shifts: ZReportShiftRowDto[];
  outstandingAddedToday: number;
  membershipRevenueToday: number;
}

export interface ShiftZReportDto {
  shiftId: string;
  tenantId: string;
  userId: string;
  staffName: string;
  gymName: string;
  openedAt: string;
  closedAt?: string | null;
  status: "open" | "closed" | "approved";
  isFinal: boolean; // closed | approved — cash figures frozen on Shift
  revealCash: boolean; // false while open (blind count)
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  transactionCount: number;
  methods: ZReportMethodTotalDto[];
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashExpenses: number;
  cashPaidIn: number;
  floatAdjust: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  difference?: number | null;
  memberships: number;
  membershipCount: number;
  renewals: number;
  renewalCount: number;
  products: number;
  productCount: number;
  other: number;
  otherCount: number;
  refundCount: number;
  discountCount: number;
}
export interface ShiftZReportListItemDto {
  shiftId: string;
  userId: string;
  staffName: string;
  openedAt: string;
  closedAt?: string | null;
  status: "open" | "closed" | "approved";
  sales: number;
  refunds: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  difference?: number | null;
}
export interface ShiftZReportListDto {
  from: string;
  to: string;
  items: ShiftZReportListItemDto[];
}

export const ZREPORT_ENDPOINTS = {
  get: (date: string) => ({ method: "GET", path: `/api/reports/z/${date}` }), // date=YYYY-MM-DD daily Cairo snapshot (nightly job); perm reports.financial.view -> ZReportDto
  pdf: (date: string) => ({ method: "GET", path: `/api/reports/z/${date}/pdf` }), // daily snapshot PDF
  regenerate: (date: string) => ({ method: "POST", path: `/api/reports/z/${date}/regenerate` }), // policy ManagerOrAbove; daily snapshot only
  listShifts: { method: "GET", path: "/api/reports/z/shifts" }, // query from,to DateOnly Cairo OpenedAt ; perm reports.financial.view -> ShiftZReportListDto
  shiftClosing: (shiftId: string) => ({ method: "GET", path: `/api/reports/z/shifts/${shiftId}` }), // shift-linked txs; closed cash is frozen Shift.ExpectedCash/CountedCash/Variance
  shiftClosingPdf: (shiftId: string) => ({ method: "GET", path: `/api/reports/z/shifts/${shiftId}/pdf` }),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 12. Free Trials (TrialController — api/trials, [Authorize], [FeatureFlag("trials")])
// ═══════════════════════════════════════════════════════════════════════════

export interface TrialInitiateRequest {
  fullName: string;
  fullNameAr?: string | null;
  phoneNumber: string;
  planId: string; // must reference a plan with planType "trial"
}
export interface TrialInitiateResponse {
  otpSent: boolean;
  expiresInSeconds: number;
}
export interface TrialConfirmRequest {
  phoneNumber: string;
  otp: string;
}
export interface TrialConfirmResponse {
  member: MemberDetailDto;
  membership: MembershipSummaryDto;
}
/** ProblemDetails.title values for trial endpoints. */
export type TrialFailureCode =
  | "PLAN_NOT_FOUND" // 404
  | "PLAN_NOT_TRIAL"
  | "TRIAL_ALREADY_USED" // 409
  | "OTP_INVALID"
  | "PENDING_TRIAL_NOT_FOUND" // 404
  | "STAFF_USER_NOT_FOUND";

export const TRIALS_ENDPOINTS = {
  initiate: { method: "POST", path: "/api/trials/initiate" }, // perm sales.sell ; body: TrialInitiateRequest -> TrialInitiateResponse
  confirm: { method: "POST", path: "/api/trials/confirm" }, // perm sales.sell ; body: TrialConfirmRequest -> TrialConfirmResponse
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 13. Outstanding balances (DebtorsController — api/debtors, [Authorize], [FeatureFlag("debtors")])
// HyMotion does not expose Debtors as a primary product module. These APIs remain
// the outstanding-balance query over Sale.AmountDue (buyer = Sale.MemberId).
// ═══════════════════════════════════════════════════════════════════════════

export interface DebtorDto {
  memberId: string;
  fullName: string;
  phoneNumber: string;
  totalDue: number;
  oldestDueDate: string;
  agingBucket: "0-7" | "8-30" | "30+";
  lastPaymentAt?: string | null;
}
export interface DebtorsSummaryDto {
  totalOutstanding: number;
  debtorCount: number;
}
/** ProblemDetails.title values for debtors endpoints. */
export type DebtorFailureCode =
  | "MEMBER_NOT_FOUND" // 404
  | "NO_OUTSTANDING_BALANCE" // 404
  | "REMINDER_THROTTLE"; // 429

export const DEBTORS_ENDPOINTS = {
  list: { method: "GET", path: "/api/debtors" }, // perm sales.sell ; query: page=1, pageSize=20, memberId?, format? ("csv" streams text/csv instead of JSON) -> PagedResult<DebtorDto>
  summary: { method: "GET", path: "/api/debtors/summary" }, // perm reports.financial.view -> DebtorsSummaryDto
  outstandingSales: (memberId: string) => ({ method: "GET", path: `/api/debtors/${memberId}/sales` }), // perm sales.sell ; -> MemberOutstandingSalesDto (empty sales + totalDue 0 when nothing due)
  remind: (memberId: string) => ({ method: "POST", path: `/api/debtors/${memberId}/remind` }), // perm sales.sell ; 429 REMINDER_THROTTLE if reminded too recently
} as const;

export interface OutstandingSaleDto {
  saleId: string;
  createdAtUtc: string;
  dueDate?: string | null;
  status: "partially_paid";
  description: string;
  total: number;
  paid: number;
  amountDue: number;
}
export interface MemberOutstandingSalesDto {
  memberId: string;
  totalDue: number;
  sales: OutstandingSaleDto[];
}

// ═══════════════════════════════════════════════════════════════════════════
// § 14. Call Sheet follow-up queue (CallSheetController — api/call-sheet, [Authorize] — NO [FeatureFlag])
// Queue = sales.sell. Renewal-rate = reports.financial.view.
// Call Sheet is NOT source of truth for membership / payments / attendance.
// ═══════════════════════════════════════════════════════════════════════════

export type FollowUpReason = "renewal" | "trial" | "payment" | "welcome" | "inactive" | "offer" | "custom";
export type FollowUpSource = "system" | "manual";
export type FollowUpPriority = "high" | "medium" | "low";
export type FollowUpStatus = "pending" | "in_progress" | "contacted" | "no_answer" | "completed" | "cancelled";
export type CallOutcomeValue =
  | "reached" | "no_answer" | "busy" | "wrong_number" | "not_interested"
  | "will_visit" | "renewed" | "needs_follow_up"
  | "contacted" | "declined";
export type FollowUpNextAction =
  | "call_tomorrow" | "call_in_3_days" | "member_will_visit" | "member_renewed"
  | "not_interested" | "wrong_number" | "no_answer" | "completed" | "custom";

export interface FollowUpDto {
  id: string;
  memberId: string;
  membershipId?: string | null;
  fullName: string;
  memberNumber: string;
  phoneNumber: string;
  profilePhotoUrl?: string | null;
  reason: FollowUpReason;
  source: FollowUpSource;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  dueAtUtc: string;
  nextAction?: FollowUpNextAction | null;
  nextActionAtUtc?: string | null;
  why?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  lastContactAtUtc?: string | null;
  lastOutcome?: CallOutcomeValue | null;
  createdAtUtc: string;
  completedAtUtc?: string | null;
}
export interface FollowUpHistoryDto {
  id: string;
  atUtc: string;
  outcome: CallOutcomeValue;
  note?: string | null;
  nextAction?: FollowUpNextAction | null;
  nextActionAtUtc?: string | null;
  staffName?: string | null;
}
export interface FollowUpDetailDto extends FollowUpDto {
  notes?: string | null;
  history: FollowUpHistoryDto[];
}
export interface FollowUpSummaryDto {
  toCallToday: number;
  highPriority: number;
  pending: number;
  contactedToday: number;
  noAnswerToday: number;
  overdue: number;
}
export interface FollowUpListDto {
  summary: FollowUpSummaryDto;
  items: FollowUpDto[];
}
export interface CreateFollowUpRequest {
  memberId: string;
  reason: FollowUpReason;
  priority?: FollowUpPriority;
  dueAtUtc?: string | null;
  assignedToUserId?: string | null;
  notes?: string | null;
  why?: string | null;
  membershipId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

export interface CallSheetEntryDto {
  membershipId: string;
  memberId: string;
  fullName: string;
  phoneNumber: string;
  planName: string;
  endDate: string;
  lastVisitAt?: string | null;
  lastCallOutcome?: CallOutcomeValue | null;
}
export interface RecordCallOutcomeRequest {
  outcome: CallOutcomeValue;
  note?: string | null;
  nextAction?: FollowUpNextAction | null;
  nextActionAtUtc?: string | null;
}
export interface RenewalRateDto {
  staffUserId: string;
  staffName: string;
  totalCalled: number;
  renewed: number;
  renewalRatePercent: number;
}
export type CallSheetFailureCode =
  | "MEMBERSHIP_NOT_FOUND" | "STAFF_USER_NOT_FOUND" | "INVALID_OUTCOME"
  | "FOLLOW_UP_NOT_FOUND" | "MEMBER_NOT_FOUND" | "INVALID_REASON"
  | "INVALID_STATUS" | "INVALID_PRIORITY" | "INVALID_NEXT_ACTION";

export const CALL_SHEET_ENDPOINTS = {
  queue: { method: "GET", path: "/api/call-sheet" }, // perm sales.sell ; query date,reason,priority,status,assignee,q -> FollowUpListDto
  summary: { method: "GET", path: "/api/call-sheet/summary" }, // perm sales.sell
  byId: (id: string) => ({ method: "GET", path: `/api/call-sheet/${id}` }),
  create: { method: "POST", path: "/api/call-sheet" },
  recordOutcome: (followUpId: string) => ({ method: "POST", path: `/api/call-sheet/${followUpId}/outcome` }),
  complete: (followUpId: string) => ({ method: "POST", path: `/api/call-sheet/${followUpId}/complete` }),
  expiring: { method: "GET", path: "/api/call-sheet/expiring" }, // legacy dashboard; query days=7
  renewalRate: { method: "GET", path: "/api/call-sheet/renewal-rate" }, // perm reports.financial.view
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 15. Bulk Import (ImportsController — api/imports, [Authorize], [FeatureFlag("imports")])
// ═══════════════════════════════════════════════════════════════════════════

export interface ImportBatchDto {
  id: string;
  fileName: string;
  status: "validating" | "dry_run_ready" | "importing" | "completed" | "rolled_back" | "failed";
  totalRows: number;
  okRows: number;
  errorRows: number;
  mapping: Record<string, string>; // sourceHeader -> targetField
  completedAt?: string | null;
  createdAtUtc: string;
}
export interface ColumnMapRequest {
  /** target field values: fullName | phoneNumber | planName | startDate | endDate |
   *  sessionsRemaining | dateOfBirth */
  mapping: Record<string, string>;
}
export interface ImportPlanSpec {
  name: string;
  planType: PlanType; // default "monthly_unlimited"
  durationDays: number;
  price: number;
}
export interface CreatePlansFromImportRequest {
  plans: ImportPlanSpec[];
}
/** Per-row validation codes (ImportRow.ErrorCodes, comma-separated if multiple apply). */
export type ImportRowErrorCode =
  | "PHONE_INVALID"
  | "PHONE_DUP_FILE"
  | "PHONE_EXISTS"
  | "PLAN_UNMATCHED"
  | "DATE_RANGE_INVALID"
  | "RETAINED_HAS_ACTIVITY"
  | "ROLLED_BACK";
/** ProblemDetails.title values for batch-level import endpoints. */
export type ImportFailureCode =
  | "BATCH_NOT_FOUND" // 404
  | "INVALID_STATUS"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_ROWS"
  | "UNSUPPORTED_FILE_TYPE"
  | "ROLLBACK_WINDOW_EXPIRED";

export const IMPORTS_ENDPOINTS = {
  upload: { method: "POST", path: "/api/imports" }, // perm settings.manage ; multipart/form-data file: File -> ImportBatchDto
  setMapping: (id: string) => ({ method: "POST", path: `/api/imports/${id}/mapping` }), // perm settings.manage ; body: ColumnMapRequest
  get: (id: string) => ({ method: "GET", path: `/api/imports/${id}` }), // perm settings.manage -> ImportBatchDto
  errorsCsv: (id: string) => ({ method: "GET", path: `/api/imports/${id}/errors.csv` }), // perm settings.manage -> text/csv
  execute: (id: string) => ({ method: "POST", path: `/api/imports/${id}/execute` }), // perm settings.manage
  rollback: (id: string) => ({ method: "POST", path: `/api/imports/${id}/rollback` }), // policy ManagerOrAbove
  createPlans: (id: string) => ({ method: "POST", path: `/api/imports/${id}/create-plans` }), // perm plans.manage ; body: CreatePlansFromImportRequest
  template: { method: "GET", path: "/api/imports/template.xlsx" }, // perm settings.manage -> binary xlsx
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 16. Analytics Dashboards (AnalyticsController — api/analytics, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface DashboardOverviewDto {
  activeMembers: number;
  expiredMembers: number;
  newMembersThisMonth: number;
  revenueThisMonth: number;
  checkinsToday: number;
  checkinsThisWeek: number;
  snapshotTimeUtc: string; // pre-computed snapshot, not live
}
export interface RevenueChartDto {
  labels: string[]; // month names, e.g. "Jan"
  values: number[];
}
/** 7 days (Mon=0..Sun=6) x 24 hours matrix of check-in counts. */
export interface AttendanceHeatmapDto {
  data: number[][];
}
export interface MemberStatusPieDto {
  active: number;
  expired: number;
  frozen: number;
  cancelled: number;
  total: number; // computed server-side
}
export interface InvitationTypeFunnelDto {
  sent: number;
  visited: number;
  converted: number;
  conversionRate: number; // 0-100
}
export interface InvitationFunnelDto {
  sent: number;
  visited: number;
  converted: number;
  conversionRate: number; // 0-100 — all types (backward compatible)
  guestPass: InvitationTypeFunnelDto;
  referral: InvitationTypeFunnelDto;
  /** Cairo calendar month */
  newMembersThisMonth: number;
  referralConvertedMembersThisMonth: number;
  /** 0-100 contribution of referrals to new members this month */
  percentNewMembersFromReferrals: number;
}
export interface TrialAnalyticsDto {
  issued: number;
  converted: number;
  conversionRate: number;
  expired: number;
}

export const ANALYTICS_ENDPOINTS = {
  overview: { method: "GET", path: "/api/analytics/overview" }, // perm reports.financial.view -> DashboardOverviewDto
  revenue: { method: "GET", path: "/api/analytics/revenue" }, // perm reports.financial.view ; query: months=6 -> RevenueChartDto
  heatmap: { method: "GET", path: "/api/analytics/heatmap" }, // perm members.view -> AttendanceHeatmapDto
  memberStatus: { method: "GET", path: "/api/analytics/members-status" }, // perm members.view -> MemberStatusPieDto
  invitations: { method: "GET", path: "/api/analytics/invitations" }, // perm members.view -> InvitationFunnelDto
  trials: { method: "GET", path: "/api/analytics/trials" }, // perm reports.financial.view ; query: month (required, format not further specified — pass "YYYY-MM") -> TrialAnalyticsDto
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 17. Detailed Reports (ReportsController — api/reports, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface AttendanceSummaryItemDto {
  date: string; // DateOnly
  checkinCount: number;
  uniqueMembers: number;
}
export interface RevenueDetailItemDto {
  id: string;
  transactionDate: string;
  memberName: string;
  planName: string;
  amount: number;
  paymentMethod: string;
}
export interface PeakHourItemDto {
  timeSlot: string; // e.g. "10:00-11:00"
  checkinCount: number;
  percentage: number;
}
export interface MemberRetentionDto {
  totalExpiredMemberships: number;
  renewedMemberships: number;
  retentionRate: number; // 0-100
}

export const REPORTS_ENDPOINTS = {
  attendanceSummary: { method: "GET", path: "/api/reports/attendance-summary" }, // perm members.view -> AttendanceSummaryItemDto[]
  revenueDetail: { method: "GET", path: "/api/reports/revenue-detail" }, // perm reports.financial.view -> RevenueDetailItemDto[] (legacy Plan.Price; prefer sales)
  peakHours: { method: "GET", path: "/api/reports/peak-hours" }, // perm members.view -> PeakHourItemDto[]
  memberRetention: { method: "GET", path: "/api/reports/member-retention" }, // perm reports.financial.view -> MemberRetentionDto
  sales: { method: "GET", path: "/api/reports/sales" }, // perm reports.financial.view ; query from,to,method?,staffId?,type? -> SalesReportDto (PaymentTransaction cash-in by PaidAtUtc; Net = cash-in − executed cash refunds; type from SaleLine)
  refunds: { method: "GET", path: "/api/reports/refunds" }, // perm reports.financial.view ; query from,to,method?,staffId?,buyer? -> RefundsReportDto (executed Refund only; method is cash|credit|gateway)
  memberships: { method: "GET", path: "/api/reports/memberships" }, // perm members.view ; query from,to,planId?,staffId?,type=new|renewal? -> MembershipsReportDto (starts in Cairo range; Type from LastRenewalDate/PlanTransitionMode; Revenue = PaymentTransaction − executed refunds, not Plan.Price)
  products: { method: "GET", path: "/api/reports/products" }, // perm reports.financial.view ; query from,to,productId?,staffId?,method? -> ProductsReportDto (retail SaleLine by Sale.CreatedAtUtc; Status=refunded drops out; LineTotal is revenue, not Product.SellPrice)
  staffShifts: { method: "GET", path: "/api/reports/staff-shifts" }, // perm reports.financial.view ; query from,to,staffId?,shiftId? -> StaffShiftsReportDto (Sales = success PaymentTransaction by PaidAtUtc / ReceivedByUserId; Refunds = executed Refund; Shifts = OpenedAt Cairo same grain as Z-Report; no variance/scoring; drill Transactions only when staffId or shiftId is set)
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 18. Audit Log (AuditController — api/audit, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditEventDto {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  ipAddress?: string | null;
  createdAtUtc: string;
}
export interface AuditEventQueryRequest {
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number; // default 1
  pageSize?: number; // default 20
}

export const AUDIT_ENDPOINTS = {
  list: { method: "GET", path: "/api/audit" }, // perm settings.manage ; query: AuditEventQueryRequest -> PagedResult<AuditEventDto>
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 19. Staff / Admin Management (AdminController — api/admin, policy OwnerOnly at class level)
// ═══════════════════════════════════════════════════════════════════════════

export interface StaffListItemDto {
  /** ApplicationUser.Id (Identity / JWT sub). Not AppUser.Id. */
  id: string;
  fullName: string;
  email: string;
  role: string; // Owner | Manager | Trainer | Receptionist (PascalCase)
  isActive: boolean;
  lastLoginAt?: string | null; // AppUser.LastLoginAtUtc; null = never logged in
  createdAtUtc: string;
  profilePhotoUrl?: string | null;
  phoneNumber?: string | null; // AppUser.PhoneNumber
  staffNumber?: string | null; // ST-0001; server-generated; not either GUID
  jobTitle?: string | null;
  department?: string | null; // Front Desk | Sales | Training | Management | Operations | Other
  hireDate?: string | null; // DateOnly YYYY-MM-DD
}
export interface StaffDetailDto extends StaffListItemDto {
  updatedAtUtc?: string | null; // profile/role/status change — NOT last login
  notes?: string | null;
}
export interface CreateStaffRequest {
  fullName: string;
  email: string;
  password: string;
  role: "Manager" | "Trainer" | "Receptionist" | "manager" | "trainer" | "receptionist";
  phoneNumber?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  hireDate?: string | null;
  notes?: string | null;
}
export interface UpdateStaffRequest {
  fullName: string;
  role: "Manager" | "Trainer" | "Receptionist" | "manager" | "trainer" | "receptionist";
  isActive: boolean;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  hireDate?: string | null;
  notes?: string | null;
}
export interface ResetPasswordRequest {
  newPassword: string;
}
export interface StaffActivityItemDto {
  id: string;
  action: string;
  label: string;
  entityType?: string | null;
  createdAtUtc: string;
  aboutThisStaff: boolean;
}

export const ADMIN_ENDPOINTS = {
  staffList: { method: "GET", path: "/api/admin/staff" }, // -> StaffListItemDto[] (includes Owner, excludes Member); id = ApplicationUser.Id
  staffGet: (id: string) => ({ method: "GET", path: `/api/admin/staff/${id}` }), // -> StaffDetailDto
  staffCreate: { method: "POST", path: "/api/admin/staff" }, // body: CreateStaffRequest
  staffUpdate: (id: string) => ({ method: "PUT", path: `/api/admin/staff/${id}` }), // body: UpdateStaffRequest
  staffDelete: (id: string) => ({ method: "DELETE", path: `/api/admin/staff/${id}` }),
  staffResetPassword: (id: string) => ({ method: "POST", path: `/api/admin/staff/${id}/reset-password` }), // body: ResetPasswordRequest
  staffActivity: (id: string) => ({ method: "GET", path: `/api/admin/staff/${id}/activity` }), // -> StaffActivityItemDto[]
  staffPhoto: (id: string) => ({ method: "POST", path: `/api/admin/staff/${id}/photo` }), // multipart file; persists ProfilePhotoUrl
  rolesCatalog: { method: "GET", path: "/api/admin/roles" }, // -> RoleCatalogDto (OwnerOnly); Owner locked; overlay on Tenant.Settings.role_permissions
  rolesUpdate: (role: "Manager" | "Trainer" | "Receptionist") => ({ method: "PUT", path: `/api/admin/roles/${role}` }), // body: { permissions: PermissionKey[] }
  rolesReset: (role: "Manager" | "Trainer" | "Receptionist") => ({ method: "POST", path: `/api/admin/roles/${role}/reset` }),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 20. Tenant Settings & Tax Configuration (TenantSettingsController — api/settings)
// ═══════════════════════════════════════════════════════════════════════════
// NOTE: this controller has NO class-level [Authorize] — GetTenantSettings/UpdateTenantSettings/
// GetTaxSettings/UpdateTaxSettings each declare [Authorize(Policy="OwnerOnly")] individually, but
// GetGymCode and GetQRPosterUrl declare only plain [Authorize] (any authenticated staff or member).

export interface TenantSettingsDto {
  tenantId: string;
  gymName: string;
  gymNameAr: string;
  gymCode: string;
  shortName?: string | null;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  primaryColor?: string; // default #7ACC00
  secondaryColor?: string; // default #148F8F
  accentColor?: string; // default #A0E040
  cardPrimaryColor?: string;
  showGymLogoOnCard?: boolean; // default true
  gymMaxCapacity?: number | null; // 1–9999; null = not configured
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}
export interface UpdateTenantSettingsRequest {
  gymName: string;
  gymNameAr: string;
  shortName?: string | null;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  cardPrimaryColor?: string | null;
  showGymLogoOnCard?: boolean | null;
  gymMaxCapacity?: number | null; // 1–9999 or null to clear
}
export interface TenantBrandingDto {
  gymName: string;
  gymNameAr: string;
  shortName?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  cardPrimaryColor: string;
  showGymLogoOnCard: boolean;
}
export interface TaxSettingsDto {
  vatEnabled: boolean;
  vatRate: number;
  taxRegistrationNumber?: string | null;
  invoiceFooterText?: string | null;
  invoiceFooterTextAr?: string | null;
}
export type UpdateTaxSettingsRequest = TaxSettingsDto;

export const TENANT_SETTINGS_ENDPOINTS = {
  get: { method: "GET", path: "/api/settings" }, // policy OwnerOnly -> TenantSettingsDto
  update: { method: "PUT", path: "/api/settings" }, // policy OwnerOnly ; body: UpdateTenantSettingsRequest
  branding: { method: "GET", path: "/api/settings/branding" }, // [Authorize] any staff -> TenantBrandingDto (tenant from context)
  uploadLogo: { method: "POST", path: "/api/settings/logo" }, // OwnerOnly ; multipart file -> { logoUrl, relativeUrl, settings }
  deleteLogo: { method: "DELETE", path: "/api/settings/logo" }, // OwnerOnly -> TenantSettingsDto
  gymCode: { method: "GET", path: "/api/settings/gym-code" }, // [Authorize] any staff -> { gymCode: string }
  qrPoster: { method: "GET", path: "/api/settings/qr-poster" }, // [Authorize] any staff -> { qrPosterUrl: string }
  tax: { method: "GET", path: "/api/settings/tax" }, // policy OwnerOnly -> TaxSettingsDto
  updateTax: { method: "PUT", path: "/api/settings/tax" }, // policy OwnerOnly ; body: UpdateTaxSettingsRequest
} as const;

/**
 * Dashboard Quick Actions — tenant-wide ordered shortcut keys.
 *
 * Do NOT hang this on GET/PUT /api/settings: that DTO has no keys field and is OwnerOnly.
 * Receptionist/Trainer must READ the same list; Manager must WRITE (Owner too).
 *
 * Backend needed:
 *   GET  /api/settings/quick-actions  [Authorize] AnyStaff → QuickActionsSettingsDto
 *   PUT  /api/settings/quick-actions  policy ManagerOrAbove ; body: UpdateQuickActionsRequest
 *
 * Unknown keys are ignored by FE. Missing/404 → default
 * ["new_member","checkin","new_sale","collect_payment"].
 * FE whitelist: apps/web/src/app/shared/quick-actions.js
 */
export interface QuickActionsSettingsDto {
  keys: string[];
}
export type UpdateQuickActionsRequest = QuickActionsSettingsDto;

export const QUICK_ACTIONS_SETTINGS_ENDPOINTS = {
  get: { method: "GET", path: "/api/settings/quick-actions" }, // AnyStaff -> QuickActionsSettingsDto
  update: { method: "PUT", path: "/api/settings/quick-actions" }, // ManagerOrAbove ; body: UpdateQuickActionsRequest
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 20b. Quick Actions (TenantSettingsController — api/settings/quick-actions)
// ═══════════════════════════════════════════════════════════════════════════
// Gym-wide dashboard shortcuts. NOT part of GET/PUT /api/settings (gym profile stays OwnerOnly).
// GET: Owner | Manager | Trainer | Receptionist. Missing config → default four keys (never 404).
// PUT: ManagerOrAbove. Trainer/Receptionist/Member → 403. Empty array is stored (cleared).
// Max 6 keys. Whitelist only; unknown dropped; "new_offer" aliases to add_promo_code.
// Persist Tenant.Settings.quick_actions.keys. Feature flags do not strip keys on the server.

export interface QuickActionsSettingsDto {
  keys: string[];
}
export type UpdateQuickActionsRequest = QuickActionsSettingsDto;

export const QUICK_ACTIONS_ENDPOINTS = {
  get: { method: "GET", path: "/api/settings/quick-actions" },
  update: { method: "PUT", path: "/api/settings/quick-actions" }, // ManagerOrAbove ; body: { keys: string[] }
} as const;

export const QUICK_ACTION_KEYS = [
  "new_member",
  "checkin",
  "new_sale",
  "collect_payment",
  "send_debtor_reminder", // backend whitelist only; not a desk destination after Debtors nav removal
  "open_shift",
  "close_shift",
  "new_refund", // backend whitelist only; refund is a Sale action, not a Quick Action destination
  "add_promo_code", // gated on 'offers' feature flag — paused with Offers & Promotions nav (2026-09-06)
  "freeze_membership",
  "book_class",
  "view_classes",
  "checkin_member",
  // "new_trial" removed 2026-09-07 — target page (/dashboard/trials/) redirects to dashboard;
  // Trials was dropped from the product IA and never had a live desk destination.
] as const;

export const QUICK_ACTION_DEFAULT_KEYS: readonly string[] = [
  "new_member",
  "checkin",
  "new_sale",
  "collect_payment",
];

// ═══════════════════════════════════════════════════════════════════════════
// § 21. Notifications (NotificationsController — api/notifications, [Authorize])
// ═══════════════════════════════════════════════════════════════════════════
// NOTE: GetMyNotifications/MarkAsRead carry only [Authorize] in the attributes — they are scoped
// to "whichever member the JWT's sub claim resolves to" at runtime (see JwtClaims note above),
// not restricted by role in the attribute itself.

export interface NotificationDto {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  channel: string; // "push" | "whatsapp"
  sentAt?: string | null;
  isRead: boolean;
}
export interface SendBulkNotificationRequest {
  memberIds?: string[] | null; // null = use allMembers flag
  allMembers: boolean;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  channel: "push" | "whatsapp"; // default "push"
}

export const NOTIFICATIONS_ENDPOINTS = {
  mine: { method: "GET", path: "/api/notifications" }, // [Authorize] ; query: page=1, pageSize=20 -> PagedResult<NotificationDto>
  markRead: (id: string) => ({ method: "POST", path: `/api/notifications/${id}/read` }), // [Authorize] ; 403 if not the owning member
  sendBulk: { method: "POST", path: "/api/notifications/send-bulk" }, // policy ManagerOrAbove ; body: SendBulkNotificationRequest
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 22. Invitations (InvitationController — api/invitation)
// ═══════════════════════════════════════════════════════════════════════════
// One product: a member submits a friend's name + phone so staff can follow up.
// JWT `sub` is Identity ApplicationUser.Id — NOT GymMember.Id.
// Server resolves GymMember via AppUser.UserId (== sub) → GymMember.AppUserId.
// Status: new | contacted | interested | not_interested | converted
// Quota: plan.referralInviteQuota on the covering membership; consume on create.
// Frozen / expired / cancelled membership → remaining 0. No carry-over on renew.
// Front desk may create on behalf of a member via POST /api/invitation/members/{memberId}
// (GymMember.Id). Same quota rules as the Member App. Never trust client quota.
// National ID is optional. Trial is not an invitation status.
// Retired (do not call): guest-quota, pending, redeem-visit, referral-share.

export type InvitationStatus =
  | "new"
  | "contacted"
  | "interested"
  | "not_interested"
  | "converted";

export interface SendInvitationRequest {
  name?: string;
  phoneNumber?: string;
  /** Aliases accepted by the API. */
  guestName?: string;
  guestPhoneNumber?: string;
  nationalId?: string | null; // optional, 14 digits when provided
  notes?: string | null;
}
export interface SendInvitationResponse {
  invitationId: string;
  name: string;
  phoneNumber: string;
  status: InvitationStatus | string;
  alreadyExisted: boolean;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  message: string;
  messageAr: string;
  guestName?: string;
}
export interface InvitationHistoryResponse {
  id: string;
  name: string;
  phoneNumber: string;
  nationalId?: string | null;
  notes?: string | null;
  status: InvitationStatus | string;
  createdAtUtc: string;
  contactedAtUtc?: string | null;
  convertedAtUtc?: string | null;
  invitedByMemberId: string;
  invitedByName: string;
  guestName?: string;
  guestPhoneNumber?: string;
  sentAtUtc?: string;
}
export interface InvitationQuotaDto {
  memberId: string;
  membershipId?: string | null;
  planId?: string | null;
  planName?: string | null;
  total: number;
  used: number;
  remaining: number;
  membershipStatus: string;
}
export interface InvitationMemberSummaryDto {
  quota: InvitationQuotaDto;
  total: number;
  new: number;
  contacted: number;
  interested: number;
  notInterested: number;
  converted: number;
  items: InvitationHistoryResponse[];
}

export const INVITATION_ENDPOINTS = {
  send: { method: "POST", path: "/api/invitation/send" }, // AuthenticatedMember
  history: { method: "GET", path: "/api/invitation/history" }, // AuthenticatedMember
  summary: { method: "GET", path: "/api/invitation/summary" }, // AuthenticatedMember -> InvitationQuotaDto
  staffList: { method: "GET", path: "/api/invitation?status=&q=" }, // members.view
  staffCreate: { method: "POST", path: "/api/invitation/members/{memberId}" }, // members.view; body: SendInvitationRequest; GymMember.Id
  member360: { method: "GET", path: "/api/invitation/members/{memberId}" }, // members.view -> InvitationMemberSummaryDto
  updateStatus: { method: "PATCH", path: "/api/invitation/{id}/status" }, // members.view body: { status }
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 22b. Inventory catalog (InventoryCatalogController — api/inventory) INVS-1
// ═══════════════════════════════════════════════════════════════════════════
// Feature flag: inventory (Growth/Pro/Enterprise via tier_feature_map; Starter off).
// Perms: inventory.view | inventory.manage. No QtyOnHand on product (ledger = INVS-3).
// POS will use product.id as SaleLine.referenceId when lineType = "retail".
// Owner desk (Product Accept 2026-08-14): Catalog Products table + Suppliers + Purchases.
// Warehouse/transfer/count UI hidden (`SHOP_OWNER_UX`); default warehouse still used on receive/POS.
// FE create/edit may send visibleToMembers for Member App store.

export interface ProductCategoryDto {
  id: string;
  name: string;
  nameAr?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAtUtc: string;
}
export interface ProductDto {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  sku: string;
  barcode?: string | null;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  unitOfMeasure: string;
  sellPrice: number;
  /** Null when caller lacks manage/purchase/reports.financial.view (Critical Close C4). */
  costPrice?: number | null;
  currency: string;
  taxable: boolean;
  vatRatePercent?: number | null;
  trackStock: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  allowFractionalQty: boolean;
  isSellable: boolean;
  isPurchasable: boolean;
  reorderMinQty: number;
  isActive: boolean;
  isArchived: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}
export interface CreateProductRequest {
  categoryId?: string | null;
  sku: string;
  barcode?: string | null;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  unitOfMeasure?: string;
  sellPrice: number;
  costPrice?: number;
  currency?: string;
  taxable?: boolean;
  vatRatePercent?: number | null;
  trackStock?: boolean;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  allowFractionalQty?: boolean;
  isSellable?: boolean;
  isPurchasable?: boolean;
  /** Member App store visibility (FE form). Backend may echo isVisibleToMembers. */
  visibleToMembers?: boolean;
  reorderMinQty?: number;
  isActive?: boolean;
}
export type UpdateProductRequest = CreateProductRequest;
export interface CreateProductCategoryRequest {
  name: string;
  nameAr?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdateProductCategoryRequest = CreateProductCategoryRequest;

export const INVENTORY_ENDPOINTS = {
  listCategories: { method: "GET", path: "/api/inventory/categories" }, // inventory.view
  createCategory: { method: "POST", path: "/api/inventory/categories" }, // inventory.manage
  updateCategory: { method: "PUT", path: "/api/inventory/categories/{id}" }, // inventory.manage
  listProducts: { method: "GET", path: "/api/inventory/products?q=&categoryId=&includeArchived=" }, // inventory.view
  getProduct: { method: "GET", path: "/api/inventory/products/{id}" }, // inventory.view
  getByBarcode: { method: "GET", path: "/api/inventory/products/by-barcode/{code}" }, // inventory.view ; 404 if archived/inactive
  createProduct: { method: "POST", path: "/api/inventory/products" }, // inventory.manage
  updateProduct: { method: "PUT", path: "/api/inventory/products/{id}" }, // inventory.manage
  uploadProductImage: { method: "POST", path: "/api/inventory/products/image" }, // inventory.manage ; multipart file → { imageUrl, relativeUrl }
  archiveProduct: { method: "POST", path: "/api/inventory/products/{id}/archive" }, // inventory.manage
  unarchiveProduct: { method: "POST", path: "/api/inventory/products/{id}/unarchive" }, // inventory.manage
  listWarehouses: { method: "GET", path: "/api/inventory/warehouses?includeInactive=" }, // inventory.view
  getDefaultWarehouse: { method: "GET", path: "/api/inventory/warehouses/default" }, // inventory.view
  getWarehouse: { method: "GET", path: "/api/inventory/warehouses/{id}" }, // inventory.view
  createWarehouse: { method: "POST", path: "/api/inventory/warehouses" }, // inventory.manage ; body CreateWarehouseRequest
  updateWarehouse: { method: "PUT", path: "/api/inventory/warehouses/{id}" }, // inventory.manage ; Code not updatable
  setDefaultWarehouse: { method: "POST", path: "/api/inventory/warehouses/{id}/set-default" }, // inventory.manage
} as const;

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  isDefault: boolean;
  isActive: boolean;
  /** Reserved — no Branch entity yet */
  branchId?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}
export interface CreateWarehouseRequest {
  code: string;
  name: string;
  nameAr?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  branchId?: string | null;
}
export interface UpdateWarehouseRequest {
  name: string;
  nameAr?: string | null;
  isActive?: boolean;
  branchId?: string | null;
}

/** INVS-3 stock ledger reads (no public set-quantity; posts via services only). */
export interface StockOnHandDto {
  productId: string;
  warehouseId: string;
  batchId?: string | null;
  qtyOnHand: number;
  /** Sellable qty (excludes expired batches for TrackExpiry products). */
  qtyAvailable: number;
  productSku?: string | null;
  productName?: string | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
}
export interface StockMovementDto {
  id: string;
  productId: string;
  warehouseId: string;
  batchId?: string | null;
  qtyDelta: number;
  unitCost?: number | null;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  occurredAtUtc: string;
  createdAtUtc: string;
}
export interface StockQueryResponse {
  qtyOnHand: number;
  /** Aligns with POS sellable check (Release N FEFO). */
  qtyAvailable: number;
  productId: string;
  warehouseId: string;
  movements?: StockMovementDto[] | null;
}
export interface ProductStockBreakdownDto {
  productId: string;
  sku: string;
  name: string;
  totalOnHand: number;
  totalAvailable: number;
  warehouses: StockOnHandDto[];
  /** G4 — per-batch buckets for Fix pickers. */
  batches?: StockBatchBucketDto[];
}
export interface StockBatchBucketDto {
  warehouseId: string;
  warehouseCode?: string | null;
  batchId?: string | null;
  batchNumber?: string | null;
  expiresOn?: string | null;
  qtyOnHand: number;
  isExpired: boolean;
}
export interface StockBoardRowDto {
  productId: string;
  sku: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  reorderMinQty: number;
  /** Physical on-hand across all buckets (includes expired). */
  onHand: number;
  /** Sellable qty — same definition as sale pre-check. */
  available: number;
  warehouseId?: string | null;
  warehouseCode?: string | null;
}

export const INVENTORY_STOCK_ENDPOINTS = {
  queryStock: {
    method: "GET",
    path: "/api/inventory/stock?productId=&warehouseId=&includeMovements=&movementTake=",
  }, // inventory.view
  stockBoard: {
    method: "GET",
    path: "/api/inventory/stock/board?warehouseId=&q=",
  }, // inventory.view
  productStock: { method: "GET", path: "/api/inventory/products/{id}/stock" }, // inventory.view
  createAdjustment: { method: "POST", path: "/api/inventory/adjustments" }, // inventory.adjust
  listAdjustments: { method: "GET", path: "/api/inventory/adjustments?status=&take=" }, // inventory.adjust
  getAdjustment: { method: "GET", path: "/api/inventory/adjustments/{id}" }, // inventory.adjust
  postAdjustment: { method: "POST", path: "/api/inventory/adjustments/{id}/post" }, // inventory.adjust
  cancelAdjustment: { method: "POST", path: "/api/inventory/adjustments/{id}/cancel" }, // inventory.adjust ; draft only
} as const;

export interface StockAdjustmentLineDto {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  qtyDelta: number;
  unitCost?: number | null;
  batchId?: string | null;
  batchNumber?: string | null;
  expiresOn?: string | null;
}
export interface StockAdjustmentDto {
  id: string;
  warehouseId: string;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  status: "draft" | "posted" | "cancelled" | string;
  reasonCode:
    | "opening"
    | "damage"
    | "lost"
    | "expired"
    | "manual_count"
    | "internal_use"
    | "employee"
    | "supplier_correction"
    | "other"
    | string;
  note?: string | null;
  createdByUserId: string;
  postedByUserId?: string | null;
  postedAtUtc?: string | null;
  createdAtUtc: string;
  lineCount?: number;
  /** Server Σ(qtyDelta × unitCost). */
  estimatedValueImpactEgp?: number;
  lines: StockAdjustmentLineDto[];
}
export interface CreateStockAdjustmentRequest {
  warehouseId: string;
  reasonCode: string;
  note?: string | null;
  lines: {
    productId: string;
    qtyDelta: number;
    unitCost?: number | null;
    batchId?: string | null;
  }[];
}

// § 22b continued — Purchasing (INVS-5)
export interface SupplierDto {
  id: string;
  name: string;
  nameAr?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  /** Null when caller lacks manage/purchase/reports.financial.view */
  purchasesTotal?: number | null;
  paidTotal?: number | null;
  dueTotal?: number | null;
}
export interface CreateSupplierRequest {
  name: string;
  nameAr?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  address?: string | null;
  isActive?: boolean;
  openingAmount?: number | null;
  /** true = owed to supplier (له); false = عليه */
  openingOwedToSupplier?: boolean | null;
}
export interface UpdateSupplierRequest extends CreateSupplierRequest {}
export interface SupplierBalanceDto {
  supplierId: string;
  purchasesTotal: number;
  paidTotal: number;
  openingTotal: number;
  dueTotal: number;
}
export interface SupplierLedgerEntryDto {
  id: string;
  amount: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAtUtc: string;
}
export interface PostSupplierOpeningRequest {
  amount: number;
  owedToSupplier?: boolean;
  note?: string | null;
}
export interface PostSupplierPaymentRequest {
  amount: number;
  method?: string | null;
  note?: string | null;
  paidAtUtc?: string | null;
}
export interface PurchaseOrderLineDto {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  qtyOrdered: number;
  qtyReceived: number;
  qtyRemaining: number;
  /** May be redacted (0/hidden client-side) without manage/purchase/reports.financial.view. */
  unitCost: number;
}
export interface PurchaseOrderDto {
  id: string;
  supplierId: string;
  supplierName?: string | null;
  warehouseId: string;
  warehouseCode?: string | null;
  status: "draft" | "approved" | "partially_received" | "received" | "cancelled" | string;
  orderedAtUtc: string;
  approvedAtUtc?: string | null;
  notes?: string | null;
  lines: PurchaseOrderLineDto[];
}
export interface CreatePurchaseOrderRequest {
  supplierId: string;
  warehouseId: string;
  notes?: string | null;
  lines: { productId: string; qtyOrdered: number; unitCost: number }[];
}
export interface ReceivePurchaseOrderRequest {
  lines: {
    purchaseOrderLineId: string;
    qty: number;
    unitCost?: number | null;
    batchNumber?: string | null;
    expiresOn?: string | null; // DateOnly yyyy-MM-dd
  }[];
}
export interface GoodsReceiptDto {
  id: string;
  purchaseOrderId: string;
  warehouseId: string;
  receivedAtUtc: string;
  supplierId?: string | null;
  supplierName?: string | null;
  warehouseCode?: string | null;
  totalAmount?: number | null; // null when cost-redacted
  status?: "received";
  docKind?: "purchase_doc";
  lines: {
    id: string;
    purchaseOrderLineId: string;
    productId: string;
    qty: number;
    unitCost?: number | null;
    batchNumber?: string | null;
    expiresOn?: string | null;
    productBatchId?: string | null;
  }[];
}

/** AP-2 Buy docs list row — presentation over GoodsReceipt (not a PurchaseInvoice). */
export interface GoodsReceiptListItemDto {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  supplierName?: string | null;
  warehouseId: string;
  warehouseCode?: string | null;
  receivedAtUtc: string;
  totalAmount?: number | null;
  status: "received";
  docKind: "purchase_doc";
}

export const INVENTORY_PURCHASING_ENDPOINTS = {
  listSuppliers: { method: "GET", path: "/api/inventory/suppliers?includeInactive=" }, // inventory.view ; money totals redacted without manage/purchase/reports.financial.view
  getSupplier: { method: "GET", path: "/api/inventory/suppliers/{id}" }, // inventory.view
  createSupplier: { method: "POST", path: "/api/inventory/suppliers" }, // inventory.manage ; optional openingAmount
  updateSupplier: { method: "PUT", path: "/api/inventory/suppliers/{id}" }, // inventory.manage
  getSupplierBalance: { method: "GET", path: "/api/inventory/suppliers/{id}/balance" }, // inventory.view + CanSeeCost
  listSupplierLedger: { method: "GET", path: "/api/inventory/suppliers/{id}/ledger?fromUtc=&toUtc=" }, // inventory.view + CanSeeCost ; X-Gfp-Truncated/Take
  postSupplierOpening: { method: "POST", path: "/api/inventory/suppliers/{id}/opening" }, // inventory.purchase
  postSupplierPayment: { method: "POST", path: "/api/inventory/suppliers/{id}/payments" }, // inventory.purchase
  listPurchaseOrders: {
    method: "GET",
    path: "/api/inventory/purchase-orders?status=",
  }, // inventory.view ; body List<PO>; headers X-Gfp-Truncated, X-Gfp-Take when capped at 200; cost redacted without manage/purchase/reports.financial.view
  getPurchaseOrder: { method: "GET", path: "/api/inventory/purchase-orders/{id}" }, // inventory.view ; cost redacted without manage/purchase/reports.financial.view
  createPurchaseOrder: { method: "POST", path: "/api/inventory/purchase-orders" }, // inventory.manage
  createPurchaseOrderFromSuggestions: {
    method: "POST",
    path: "/api/inventory/purchase-orders/from-suggestions",
  }, // inventory.manage
  approvePurchaseOrder: { method: "POST", path: "/api/inventory/purchase-orders/{id}/approve" }, // inventory.purchase
  cancelPurchaseOrder: { method: "POST", path: "/api/inventory/purchase-orders/{id}/cancel" }, // inventory.purchase
  receivePurchaseOrder: { method: "POST", path: "/api/inventory/purchase-orders/{id}/receipts" }, // inventory.purchase
  listGoodsReceipts: {
    method: "GET",
    path: "/api/inventory/goods-receipts?fromUtc=&toUtc=&supplierId=",
  }, // inventory.view ; List<GoodsReceiptListItemDto>; X-Gfp-Truncated/Take; totalAmount redacted without CanSeeCost
  getGoodsReceipt: { method: "GET", path: "/api/inventory/goods-receipts/{id}" }, // inventory.view ; GoodsReceiptDto
} as const;

// § 22b continued — Warehouse transfers (INVS-8)
export interface StockTransferLineDto {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  qty: number;
  batchId?: string | null;
}
export interface StockTransferDto {
  id: string;
  fromWarehouseId: string;
  fromWarehouseCode?: string | null;
  toWarehouseId: string;
  toWarehouseCode?: string | null;
  status: "pending" | "in_transit" | "completed" | "cancelled" | string;
  note?: string | null;
  createdByUserId: string;
  submittedAtUtc?: string | null;
  receivedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  createdAtUtc: string;
  lines: StockTransferLineDto[];
}
export interface CreateStockTransferRequest {
  fromWarehouseId: string;
  toWarehouseId: string;
  note?: string | null;
  lines: { productId: string; qty: number; batchId?: string | null }[];
}

export const INVENTORY_TRANSFER_ENDPOINTS = {
  listTransfers: {
    method: "GET",
    path: "/api/inventory/transfers?status=",
  }, // inventory.transfer ; headers X-Gfp-Truncated, X-Gfp-Take when capped at 200
  getTransfer: { method: "GET", path: "/api/inventory/transfers/{id}" }, // inventory.transfer
  createTransfer: { method: "POST", path: "/api/inventory/transfers" }, // inventory.transfer
  submitTransfer: { method: "POST", path: "/api/inventory/transfers/{id}/submit" }, // inventory.transfer; silent FEFO via AllocateSaleAsync (multi-batch TransferOut posts; lines stay aggregated)
  receiveTransfer: { method: "POST", path: "/api/inventory/transfers/{id}/receive" }, // inventory.transfer; mirrors TransferOut batches into destination
  cancelTransfer: { method: "POST", path: "/api/inventory/transfers/{id}/cancel" }, // inventory.transfer ; pending only
  rejectTransfer: { method: "POST", path: "/api/inventory/transfers/{id}/reject" }, // inventory.transfer ; in_transit → return to source (mirrors TransferOut batches)
} as const;

// § 22b continued — Stock counts (INVS-9)
export interface StockCountLineDto {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  systemQty: number;
  countedQty: number;
  variance: number;
}
export interface StockCountDto {
  id: string;
  warehouseId: string;
  warehouseCode?: string | null;
  status: "draft" | "submitted" | "approved" | "cancelled" | string;
  countedAtUtc: string;
  note?: string | null;
  createdByUserId: string;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  createdAtUtc: string;
  lines: StockCountLineDto[];
}
export interface CreateStockCountRequest {
  warehouseId: string;
  /** Omit/empty = all active TrackStock products. */
  productIds?: string[] | null;
  note?: string | null;
}
export interface UpdateStockCountLinesRequest {
  lines: { lineId: string; countedQty: number }[];
}

export const INVENTORY_COUNT_ENDPOINTS = {
  listCounts: { method: "GET", path: "/api/inventory/counts?status=" }, // inventory.adjust
  getCount: { method: "GET", path: "/api/inventory/counts/{id}" }, // inventory.adjust
  createCount: { method: "POST", path: "/api/inventory/counts" }, // inventory.adjust — snapshots system qty
  updateCountLines: { method: "PUT", path: "/api/inventory/counts/{id}/lines" }, // inventory.adjust ; draft only
  submitCount: { method: "POST", path: "/api/inventory/counts/{id}/submit" }, // inventory.adjust
  approveCount: { method: "POST", path: "/api/inventory/counts/{id}/approve" }, // inventory.adjust ; drift check
  cancelCount: { method: "POST", path: "/api/inventory/counts/{id}/cancel" }, // inventory.adjust ; draft|submitted
} as const;

// § 22b continued — Reports & alerts (INVS-10)
export interface InventoryExpiryWindowDto {
  days: number;
  batchCount: number;
}
export interface InventorySummaryReportDto {
  /** Null when caller lacks reports.financial.view */
  inventoryValueEgp?: number | null;
  outOfStockCount: number;
  lowStockCount: number;
  expiringSoon: InventoryExpiryWindowDto[];
  includesValuation: boolean;
  todayRetailUnits: number;
  /** Null without reports.financial.view */
  todayRetailSalesEgp?: number | null;
  pendingPoCount: number;
  inTransitTransferCount: number;
}
export interface InventoryReorderSuggestionDto {
  productId: string;
  sku: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  onHand: number;
  /** Sellable qty (excludes expired). Preferred Need signal. */
  available: number;
  reorderMinQty: number;
  suggestedQty: number;
  /** Null/omitted unless caller has inventory.manage or inventory.purchase. */
  costPrice?: number | null;
  sellPrice: number;
  /** 30d lookback average daily sale units (server). */
  avgDailySales: number;
  /** Available / AvgDailySales when velocity > 0; otherwise null. */
  daysOfCover?: number | null;
  /** Open PO remaining + in-transit transfer qty (server). */
  incomingOpenQty: number;
}
export interface InventoryDeadStockRowDto {
  productId: string;
  sku: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  onHand: number;
  costPrice?: number | null;
  lastSoldAtUtc?: string | null;
  daysIdle: number;
}
export interface InventoryProductPerformanceRowDto {
  productId: string;
  sku: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  qtySold: number;
  revenueEgp: number;
  estMarginEgp?: number | null;
  lastSoldAtUtc?: string | null;
}
export interface InventoryMovementReportRowDto {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  warehouseId: string;
  warehouseCode?: string | null;
  batchId?: string | null;
  qtyDelta: number;
  unitCost?: number | null;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  occurredAtUtc: string;
}

export const INVENTORY_REPORT_ENDPOINTS = {
  summary: { method: "GET", path: "/api/inventory/reports/summary" }, // inventory.view (+ reports.financial.view for valuation / todayRetailSalesEgp)
  movements: {
    method: "GET",
    path: "/api/inventory/reports/movements?fromUtc=&toUtc=&productId=&warehouseId=&reason=&take=",
  }, // inventory.view ; max 366 days
  reorderSuggestions: { method: "GET", path: "/api/inventory/reports/reorder-suggestions" },
  deadStock: { method: "GET", path: "/api/inventory/reports/dead-stock?daysIdle=30" },
  productPerformance: {
    method: "GET",
    path: "/api/inventory/reports/product-performance?fromUtc=&toUtc=&take=",
  },
} as const;


/** INVS-10 alert keys via Tenant.Settings (Owner). */
export interface InventoryAlertSettingsDto {
  lowStockNotifyRoles: string[];
  expiryWindowsDays: number[];
}
export const SETTINGS_INVENTORY_ALERTS = {
  get: { method: "GET", path: "/api/settings/inventory-alerts" },
  update: { method: "PUT", path: "/api/settings/inventory-alerts" },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 23. Payment Gateway Webhooks (PaymentsController — api/payments)
// ═══════════════════════════════════════════════════════════════════════════
// NOT a frontend integration point. These are server-to-server webhook receivers called
// directly by Paymob/Fawry, not by the SPA/mobile client. Listed for completeness only.

export const PAYMENTS_WEBHOOK_ENDPOINTS = {
  paymob: { method: "POST", path: "/api/payments/paymob-webhook" }, // gateway callback only
  fawry: { method: "POST", path: "/api/payments/fawry-webhook" }, // gateway callback only
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 24. Real-time — SignalR (AttendanceHub at /hubs/attendance)
// ═══════════════════════════════════════════════════════════════════════════
// Connect with the same JWT access token (as an access_token query param or Authorization
// header per the SignalR JS client's accessTokenFactory). Clients are auto-joined to a
// tenant-isolated group "tenant-{tenantId}" server-side — no client-side group join call needed.
// Delivery is best-effort: a failed/absent SignalR push never blocks or fails the underlying
// check-in HTTP call.

export interface MemberCheckedInEvent {
  attendanceId: string;
  memberId: string;
  memberName: string;
  memberNameAr: string;
  checkInAtUtc: string;
  entryMethod: string;
}
export const SIGNALR = {
  hubUrl: "/hubs/attendance",
  events: {
    /** The ONLY event emitted by this hub. Payload matches QrCheckinResponse/ManualCheckinResponse
     *  data at the time of check-in (verify exact field set against SignalRCheckinNotifier if the
     *  UI needs pixel-perfect parity — this type reflects the fields common to both). */
    memberCheckedIn: "MemberCheckedIn",
  },
} as const;
