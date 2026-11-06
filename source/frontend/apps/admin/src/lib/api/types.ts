/**
 * Cross-cutting + Auth contracts from FRONTEND_API_CONTRACTS.ts (§0 / §1).
 */

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ProblemDetailsError {
  type?: string
  title: string
  status: number
  detail: string
  instance?: string
  traceId?: string
}

export type AdHocError = { message: string } | { error: string; message?: string }

export type ApiErrorBody = ProblemDetailsError | AdHocError

export type PermissionKey =
  | 'members.view'
  | 'members.create'
  | 'members.edit'
  | 'checkin.manual'
  | 'sales.sell'
  | 'sales.discount.apply'
  | 'sales.discount.override'
  | 'payments.cash.accept'
  | 'payments.refund.request'
  | 'payments.refund.approve'
  | 'shift.open'
  | 'shift.close'
  | 'shift.reconcile.approve'
  | 'memberships.freeze'
  | 'plans.manage'
  | 'reports.financial.view'
  | 'settings.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.adjust'
  | 'inventory.purchase'
  | 'inventory.transfer'
  | 'member_orders.view'
  | 'member_orders.manage'

export interface LoginRequest {
  email: string
  password: string
  gymCode: string
}

export interface UserInfo {
  id: string
  email: string
  fullName: string
  role: string
  tenantId: string
  gymCode: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresAtUtc: string
  user: UserInfo
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface MemberOtpRequest {
  phoneNumber: string
  gymCode: string
}

export interface MemberOtpVerifyRequest {
  phoneNumber: string
  gymCode: string
  otp: string
}

export const AUTH_ENDPOINTS = {
  login: { method: 'POST', path: '/api/auth/login' },
  refresh: { method: 'POST', path: '/api/auth/refresh' },
  memberOtpSend: { method: 'POST', path: '/api/auth/member-otp' },
  memberOtpVerify: { method: 'POST', path: '/api/auth/member-verify' },
} as const

export interface SessionSnapshot {
  accessToken: string
  /** Empty for impersonation sessions — refresh is forbidden. */
  refreshToken: string
  expiresAtUtc: string
  user: UserInfo
  impersonation?: {
    platformUserId: string
    expiresAtUtc: string
  }
}
