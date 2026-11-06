import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ApiClientError, parseApiErrorBody } from './errors'
import {
  applySession,
  getAccessToken,
  getRefreshToken,
  sessionFromLogin,
  wipeSession,
} from './session'
import { AUTH_ENDPOINTS, type LoginResponse, type PagedResult } from './types'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const baseURL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshInFlight: Promise<string> | null = null

function readTokenExpired(headers: unknown): boolean {
  if (!headers || typeof headers !== 'object') return false
  const h = headers as Record<string, unknown> & {
    get?: (name: string) => string | null | undefined
  }
  const read = (key: string): string | undefined => {
    if (typeof h.get === 'function') {
      const v = h.get(key) ?? h.get(key.toLowerCase())
      return v ?? undefined
    }
    const direct = h[key] ?? h[key.toLowerCase()]
    return typeof direct === 'string' ? direct : undefined
  }
  const value = read('Token-Expired') ?? read('token-expired')
  return String(value).toLowerCase() === 'true'
}

function hardLogoutSession(): void {
  wipeSession()
  void import('@/stores/feature-flags-store').then(({ useFeatureFlagsStore }) => {
    useFeatureFlagsStore.getState().reset()
  })
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    hardLogoutSession()
    throw new ApiClientError({
      status: 401,
      message: 'Session expired. Please sign in again.',
      code: 'NO_REFRESH_TOKEN',
    })
  }

  try {
    // Use bare axios to avoid this interceptor looping on refresh itself.
    const { data } = await axios.post<LoginResponse>(
      `${baseURL}${AUTH_ENDPOINTS.refresh.path}`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 },
    )

    // Persist newest pair immediately — rotation revokes the old refresh token.
    applySession(sessionFromLogin(data))
    return data.accessToken
  } catch {
    // Refresh failure = hard logout, never retry.
    hardLogoutSession()
    throw new ApiClientError({
      status: 401,
      message: 'Session expired. Please sign in again.',
      code: 'REFRESH_FAILED',
    })
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status ?? 0
    const config = error.config as RetriableConfig | undefined
    const tokenExpired = readTokenExpired(error.response?.headers)

    if (status === 401 && tokenExpired && config && !config._retry) {
      config._retry = true
      try {
        if (!refreshInFlight) {
          refreshInFlight = refreshAccessToken().finally(() => {
            refreshInFlight = null
          })
        }
        const accessToken = await refreshInFlight
        config.headers.Authorization = `Bearer ${accessToken}`
        return api.request(config)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    const parsed = parseApiErrorBody(error.response?.data)
    return Promise.reject(
      new ApiClientError({
        status,
        message: parsed.message || error.message || 'Request failed',
        code: parsed.code,
        body: parsed.body,
        isTokenExpired: tokenExpired,
      }),
    )
  },
)

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<T>(config)
  return response.data
}

export async function apiPaged<T>(config: AxiosRequestConfig): Promise<PagedResult<T>> {
  return apiRequest<PagedResult<T>>(config)
}

export function logoutLocal(): void {
  hardLogoutSession()
}
