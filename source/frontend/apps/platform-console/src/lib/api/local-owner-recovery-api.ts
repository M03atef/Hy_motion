import { apiRequest } from './client'
import {
  LOCAL_OWNER_RECOVERY_ENDPOINTS,
  type LocalOwnerRecoveryDetailDto,
  type LocalOwnerRecoveryListItemDto,
  type OwnerRecoveryDecisionRequest,
} from './types'

export function fetchLocalOwnerRecoveries(customerId?: string, status?: string) {
  return apiRequest<LocalOwnerRecoveryListItemDto[]>({
    method: 'GET',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.list,
    params: { customerId, status },
  })
}

export function fetchLocalOwnerRecovery(id: string) {
  return apiRequest<LocalOwnerRecoveryDetailDto>({
    method: 'GET',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.detail(id),
  })
}

export function importLocalOwnerRecoveryChallenge(challenge: string, customerId?: string) {
  return apiRequest<LocalOwnerRecoveryDetailDto>({
    method: 'POST',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.importChallenge,
    data: { challenge, customerId },
  })
}

export function approveLocalOwnerRecovery(id: string, body: OwnerRecoveryDecisionRequest) {
  return apiRequest<LocalOwnerRecoveryDetailDto>({
    method: 'POST',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.approve(id),
    data: body,
  })
}

export function rejectLocalOwnerRecovery(id: string, body: OwnerRecoveryDecisionRequest) {
  return apiRequest<LocalOwnerRecoveryDetailDto>({
    method: 'POST',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.reject(id),
    data: body,
  })
}

export function revokeLocalOwnerRecovery(id: string, body: OwnerRecoveryDecisionRequest) {
  return apiRequest<LocalOwnerRecoveryDetailDto>({
    method: 'POST',
    url: LOCAL_OWNER_RECOVERY_ENDPOINTS.revoke(id),
    data: body,
  })
}
