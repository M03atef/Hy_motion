import { apiPaged, apiRequest } from './client'
import type { PagedResult } from './types'
import {
  MEMBERS_ENDPOINTS,
  type CreateMemberRequest,
  type FreezeMembershipRequest,
  type MemberCreditSummaryDto,
  type MemberDetailDto,
  type MemberListItemDto,
  type MemberListStatusFilter,
  type MembershipSummaryDto,
  type UpdateMemberRequest,
} from './members-types'

export type { MemberListStatusFilter }

export async function listMembers(params: {
  search?: string
  status?: MemberListStatusFilter | ''
  page?: number
  pageSize?: number
}): Promise<PagedResult<MemberListItemDto>> {
  return apiPaged<MemberListItemDto>({
    method: MEMBERS_ENDPOINTS.list.method,
    url: MEMBERS_ENDPOINTS.list.path,
    params: {
      search: params.search?.trim() || undefined,
      status: params.status || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  })
}

export async function getMember(id: string): Promise<MemberDetailDto> {
  const ep = MEMBERS_ENDPOINTS.get(id)
  return apiRequest<MemberDetailDto>({ method: ep.method, url: ep.path })
}

export async function createMember(body: CreateMemberRequest): Promise<MemberDetailDto> {
  return apiRequest<MemberDetailDto>({
    method: MEMBERS_ENDPOINTS.create.method,
    url: MEMBERS_ENDPOINTS.create.path,
    data: body,
  })
}

export async function updateMember(id: string, body: UpdateMemberRequest): Promise<MemberDetailDto> {
  const ep = MEMBERS_ENDPOINTS.update(id)
  return apiRequest<MemberDetailDto>({ method: ep.method, url: ep.path, data: body })
}

export async function deactivateMember(id: string): Promise<{ message?: string }> {
  const ep = MEMBERS_ENDPOINTS.deactivate(id)
  return apiRequest<{ message?: string }>({ method: ep.method, url: ep.path })
}

export async function getMemberCredits(id: string): Promise<MemberCreditSummaryDto> {
  const ep = MEMBERS_ENDPOINTS.credits(id)
  return apiRequest<MemberCreditSummaryDto>({ method: ep.method, url: ep.path })
}

export async function getCurrentMembership(id: string): Promise<MembershipSummaryDto> {
  const ep = MEMBERS_ENDPOINTS.currentMembership(id)
  return apiRequest<MembershipSummaryDto>({ method: ep.method, url: ep.path })
}

export async function freezeMembership(
  id: string,
  body: FreezeMembershipRequest,
): Promise<{ message?: string }> {
  const ep = MEMBERS_ENDPOINTS.freeze(id)
  return apiRequest<{ message?: string }>({ method: ep.method, url: ep.path, data: body })
}

export async function unfreezeMembership(id: string): Promise<{ message?: string }> {
  const ep = MEMBERS_ENDPOINTS.unfreeze(id)
  return apiRequest<{ message?: string }>({ method: ep.method, url: ep.path })
}
