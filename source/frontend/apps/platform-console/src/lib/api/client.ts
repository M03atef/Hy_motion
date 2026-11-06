import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { clearAccessToken, getAccessToken } from './token'
import { parsePlatformError, ApiClientError } from './errors'

const baseURL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  validateStatus: () => true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<T>(config)
  const status = response.status

  if (status === 401) {
    clearAccessToken()
    onUnauthorized?.()
    throw parsePlatformError(response.data, status)
  }

  if (status >= 200 && status < 300) {
    return response.data
  }

  // MFA setup returns 403 with a usable body — callers may want the payload.
  if (status === 403) {
    throw Object.assign(parsePlatformError(response.data, status), {
      data: response.data,
    })
  }

  throw parsePlatformError(response.data, status)
}

/** Login/setup helpers that need the raw status + body (403 setup path). */
export async function apiRaw<T>(config: AxiosRequestConfig): Promise<{ status: number; data: T }> {
  try {
    const response = await api.request<T>(config)
    return { status: response.status, data: response.data }
  } catch (err) {
    const ax = err as AxiosError
    throw new ApiClientError(ax.message, ax.response?.status ?? 0)
  }
}
