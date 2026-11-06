import { apiRequest } from './client'
import {
  PLATFORM_USER_ENDPOINTS,
  type ChangePlatformUserRoleRequest,
  type CreatePlatformUserRequest,
  type PlatformUserDto,
} from './types'

/** PlatformAdminOnly at the controller level — the entire resource, including reads. */
export function fetchPlatformUsers() {
  return apiRequest<PlatformUserDto[]>({
    method: 'GET',
    url: PLATFORM_USER_ENDPOINTS.list,
  })
}

export function createPlatformUser(body: CreatePlatformUserRequest) {
  return apiRequest<PlatformUserDto>({
    method: 'POST',
    url: PLATFORM_USER_ENDPOINTS.create,
    data: body,
  })
}

/** No request body — the backend action takes only the id. */
export function disablePlatformUser(id: string) {
  return apiRequest<PlatformUserDto>({
    method: 'POST',
    url: PLATFORM_USER_ENDPOINTS.disable(id),
  })
}

/** No request body — the backend action takes only the id. */
export function reactivatePlatformUser(id: string) {
  return apiRequest<PlatformUserDto>({
    method: 'POST',
    url: PLATFORM_USER_ENDPOINTS.reactivate(id),
  })
}

export function changePlatformUserRole(id: string, body: ChangePlatformUserRoleRequest) {
  return apiRequest<PlatformUserDto>({
    method: 'PUT',
    url: PLATFORM_USER_ENDPOINTS.changeRole(id),
    data: body,
  })
}
