import type { AdHocError, ApiErrorBody, ProblemDetailsError } from './types'
import { displayBilingualText, splitSlashBilingual, type Locale } from '@/lib/i18n/bilingual'

export class ApiClientError extends Error {
  readonly status: number
  readonly code?: string
  readonly body: ApiErrorBody | string | null
  readonly isTokenExpired: boolean

  constructor(opts: {
    status: number
    message: string
    code?: string
    body?: ApiErrorBody | string | null
    isTokenExpired?: boolean
  }) {
    super(opts.message)
    this.name = 'ApiClientError'
    this.status = opts.status
    this.code = opts.code
    this.body = opts.body ?? null
    this.isTokenExpired = opts.isTokenExpired ?? false
  }
}

function isProblemDetails(value: unknown): value is ProblemDetailsError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as ProblemDetailsError).title === 'string' &&
    'detail' in value
  )
}

function isAdHocError(value: unknown): value is AdHocError {
  if (typeof value !== 'object' || value === null) return false
  return 'error' in value || 'message' in value
}

/** Parse ProblemDetails first, then ad-hoc { error, message }. */
export function parseApiErrorBody(data: unknown): {
  message: string
  code?: string
  body: ApiErrorBody | string | null
} {
  if (isProblemDetails(data)) {
    return {
      message: data.detail || data.title,
      code: data.title,
      body: data,
    }
  }

  if (isAdHocError(data)) {
    const message =
      'error' in data
        ? data.error || data.message || 'Request failed'
        : data.message || 'Request failed'
    return { message, body: data }
  }

  if (typeof data === 'string' && data.trim()) {
    return { message: data, body: data }
  }

  return { message: 'Request failed', body: null }
}

export function getDisplayMessage(error: unknown, locale: Locale = 'en'): string {
  if (error instanceof ApiClientError) {
    return displayBilingualText(error.message, locale) || error.message
  }
  if (error instanceof Error) {
    return displayBilingualText(error.message, locale) || error.message
  }
  return locale === 'ar' ? 'حدث خطأ ما' : 'Something went wrong'
}

export function getDisplayMessageFromBody(data: unknown, locale: Locale = 'en'): string {
  const parsed = parseApiErrorBody(data)
  const parts = splitSlashBilingual(parsed.message)
  return displayBilingualText(parts, locale) || parsed.message
}
