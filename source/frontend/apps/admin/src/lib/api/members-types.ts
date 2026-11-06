/** Member contracts from FRONTEND_API_CONTRACTS.ts (§2). */

export interface MemberListItemDto {
  id: string
  memberNumber: string
  fullName: string
  fullNameAr: string
  phone: string
  isActive: boolean
  activePlan?: string | null
  activePlanAr?: string | null
  expiryDate?: string | null
  membershipStatus?: string | null
}

export interface MembershipSummaryDto {
  id: string
  planName: string
  planNameAr: string
  planType: string
  status: string
  startDate: string
  endDate: string
  sessionsRemaining?: number | null
  frozenFromDate?: string | null
  frozenUntilDate?: string | null
  amountPaid: number
  paymentMethod: string
}

export interface AttendanceSummaryDto {
  id: string
  checkInAtUtc: string
  checkOutAtUtc?: string | null
  entryMethod: string
}

export interface MemberDetailDto {
  id: string
  memberNumber: string
  fullName: string
  fullNameAr: string
  phone: string
  email: string
  dateOfBirth: string
  profilePhotoUrl?: string | null
  notes?: string | null
  isActive: boolean
  invitationQuotaRemaining: number
  createdAtUtc: string
  currentMembership?: MembershipSummaryDto | null
  recentAttendance: AttendanceSummaryDto[]
}

export interface CreateMemberRequest {
  fullName: string
  fullNameAr: string
  phone: string
  dateOfBirth: string
  nationalId?: string | null
  emergencyContact?: string | null
  email?: string | null
  notes?: string | null
}

export interface UpdateMemberRequest {
  fullName?: string | null
  fullNameAr?: string | null
  phone?: string | null
  dateOfBirth?: string | null
  nationalId?: string | null
  emergencyContact?: string | null
  email?: string | null
  notes?: string | null
}

export interface FreezeMembershipRequest {
  frozenUntil: string
  reason?: string | null
}

export interface MemberCreditEntryDto {
  id: string
  amount: number
  entryType: 'refund' | 'payment_use' | 'adjustment'
  referenceId?: string | null
  reason?: string | null
  createdAtUtc: string
}

export interface MemberCreditSummaryDto {
  balance: number
  entries: MemberCreditEntryDto[]
}

/** Backend list filter values (MemberRepository status switch). */
export type MemberListStatusFilter = 'active' | 'expired' | 'frozen' | 'inactive'

export const MEMBERS_ENDPOINTS = {
  list: { method: 'GET' as const, path: '/api/members' },
  get: (id: string) => ({ method: 'GET' as const, path: `/api/members/${id}` }),
  create: { method: 'POST' as const, path: '/api/members' },
  update: (id: string) => ({ method: 'PUT' as const, path: `/api/members/${id}` }),
  deactivate: (id: string) => ({ method: 'DELETE' as const, path: `/api/members/${id}` }),
  attendance: (id: string) => ({ method: 'GET' as const, path: `/api/members/${id}/attendance` }),
  currentMembership: (id: string) => ({
    method: 'GET' as const,
    path: `/api/members/${id}/membership`,
  }),
  freeze: (id: string) => ({ method: 'POST' as const, path: `/api/members/${id}/freeze` }),
  unfreeze: (id: string) => ({ method: 'POST' as const, path: `/api/members/${id}/unfreeze` }),
  credits: (id: string) => ({ method: 'GET' as const, path: `/api/members/${id}/credits` }),
}
