export class ApiClientError extends Error {
  readonly status: number
  readonly errorCode?: string
  readonly detail?: string

  constructor(message: string, status: number, errorCode?: string, detail?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.errorCode = errorCode
    this.detail = detail
  }
}

export function parsePlatformError(data: unknown, status: number): ApiClientError {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const errorCode = typeof body.errorCode === 'string' ? body.errorCode : undefined
    const primary =
      (typeof body.errorMessage === 'string' && body.errorMessage) ||
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof body.title === 'string' && body.title) ||
      null
    const detail = typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim() : undefined
    // Prefer combining message + detail when both exist (provision returns generic Error + ex.Message).
    let message = primary ?? detail ?? `Request failed (${status})`
    if (primary && detail && !primary.includes(detail)) {
      message = `${primary}: ${detail}`
    }
    return new ApiClientError(message, status, errorCode, detail)
  }
  return new ApiClientError(`Request failed (${status})`, status)
}
