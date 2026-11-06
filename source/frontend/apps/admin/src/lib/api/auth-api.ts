import { apiRequest, logoutLocal } from './client'
import { applySession, rememberGymCode, sessionFromLogin } from './session'
import {
  AUTH_ENDPOINTS,
  type LoginRequest,
  type LoginResponse,
  type MemberOtpRequest,
  type MemberOtpVerifyRequest,
} from './types'

export async function staffLogin(request: LoginRequest): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>({
    method: AUTH_ENDPOINTS.login.method,
    url: AUTH_ENDPOINTS.login.path,
    data: request,
  })
  applySession(sessionFromLogin(data))
  rememberGymCode(request.gymCode)
  return data
}

export async function staffLogout(): Promise<void> {
  logoutLocal()
}

/** Member OTP step 1 — stub-ready API call. */
export async function sendMemberOtp(request: MemberOtpRequest): Promise<{ message?: string }> {
  rememberGymCode(request.gymCode)
  return apiRequest<{ message?: string }>({
    method: AUTH_ENDPOINTS.memberOtpSend.method,
    url: AUTH_ENDPOINTS.memberOtpSend.path,
    data: request,
  })
}

/** Member OTP step 2 — verify & establish session. */
export async function verifyMemberOtp(request: MemberOtpVerifyRequest): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>({
    method: AUTH_ENDPOINTS.memberOtpVerify.method,
    url: AUTH_ENDPOINTS.memberOtpVerify.path,
    data: request,
  })
  applySession(sessionFromLogin(data))
  rememberGymCode(request.gymCode)
  return data
}

/** Hit a permissioned endpoint to validate the bearer token (Prompt 1 acceptance). */
export async function probeAuthenticatedSession(): Promise<unknown> {
  return apiRequest({
    method: 'GET',
    url: '/api/settings/gym-code',
  })
}
