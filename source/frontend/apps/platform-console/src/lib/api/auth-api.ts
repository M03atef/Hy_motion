import { apiRaw } from './client'
import {
  AUTH_ENDPOINTS,
  type PlatformLoginRequest,
  type PlatformLoginResult,
  type PlatformMfaSetupRequest,
} from './types'

export async function platformLogin(body: PlatformLoginRequest): Promise<{
  status: number
  data: PlatformLoginResult
}> {
  return apiRaw<PlatformLoginResult>({
    method: 'POST',
    url: AUTH_ENDPOINTS.login,
    data: body,
  })
}

export async function platformMfaSetup(body: PlatformMfaSetupRequest): Promise<{
  status: number
  data: PlatformLoginResult
}> {
  return apiRaw<PlatformLoginResult>({
    method: 'POST',
    url: AUTH_ENDPOINTS.mfaSetup,
    data: body,
  })
}
