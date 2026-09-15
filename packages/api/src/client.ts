import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorBody } from './types.js'

/**
 * HTTP client for the Loikmon backend (`/api/v1`).
 *
 * - Authentication: `Authorization: Bearer <token>` from the token provider
 *   given to `configureClient` (localStorage on web, SecureStore on mobile).
 * - Errors: every failed request rejects with an `ApiError` carrying the
 *   backend's stable `code` (e.g. SUBSCRIPTION_REQUIRED) and `requestId`.
 */

export const DEFAULT_BASE_URL = '/api/v1'

export interface ClientOptions {
  /** e.g. `/api/v1` (web behind nginx) or `https://api.loikmon.org/api/v1` (mobile). */
  baseURL?: string
  /** Returns the current session token, if any. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>
  /** Called when an authenticated request is rejected with 401 (expired/revoked session). */
  onUnauthorized?: (error: ApiError) => void
  timeout?: number
}

export class ApiError extends Error {
  override name = 'ApiError'
  constructor(
    message: string,
    /** HTTP status; 0 when the server could not be reached. */
    readonly status: number,
    /** Backend error code, or NETWORK_ERROR / TIMEOUT for transport failures. */
    readonly code: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message)
  }

  get isNetworkError() {
    return this.status === 0
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** Error code of any thrown value (`UNKNOWN` when it is not an ApiError). */
export function errorCode(err: unknown): string {
  return isApiError(err) ? err.code : 'UNKNOWN'
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(err)) return err.message || fallback
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError(err)) {
    const axiosError = err as AxiosError<Partial<ApiErrorBody>>
    const body = axiosError.response?.data
    const requestId = body?.request_id ?? (axiosError.response?.headers?.['x-request-id'] as string | undefined)
    if (axiosError.response) {
      return new ApiError(
        body?.message ?? axiosError.message,
        axiosError.response.status,
        body?.code ?? `HTTP_${axiosError.response.status}`,
        body?.details,
        requestId,
      )
    }
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError('The server took too long to respond', 0, 'TIMEOUT')
    }
    return new ApiError('Cannot reach the server. Check your connection.', 0, 'NETWORK_ERROR')
  }
  return new ApiError(err instanceof Error ? err.message : String(err), 0, 'UNKNOWN')
}

/**
 * 401 codes meaning the session itself is gone. Other 401s — e.g.
 * INVALID_CREDENTIALS for a wrong current password — must not sign the user out.
 */
const SESSION_ENDED_CODES = new Set(['UNAUTHORIZED', 'LOGIN_REQUIRED'])

let _instance: AxiosInstance | null = null
let _options: ClientOptions = {}

function build(options: ClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL ?? DEFAULT_BASE_URL,
    timeout: options.timeout ?? 20_000,
    headers: { Accept: 'application/json' },
  })

  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await _options.getToken?.()
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (err: unknown) => {
      const apiError = toApiError(err)
      const sentToken = axios.isAxiosError(err) && Boolean(err.config?.headers?.Authorization)
      if (sentToken && SESSION_ENDED_CODES.has(apiError.code)) _options.onUnauthorized?.(apiError)
      return Promise.reject(apiError)
    },
  )

  return instance
}

/** Configure (or reconfigure) the shared client. Call once at app start-up. */
export function configureClient(options: ClientOptions): AxiosInstance {
  _options = { ...options }
  _instance = build(_options)
  return _instance
}

/** The shared client. `baseURL` is only used when the client has not been configured yet. */
export function getClient(baseURL?: string): AxiosInstance {
  if (!_instance) {
    _options = { ..._options, baseURL: baseURL ?? _options.baseURL }
    _instance = build(_options)
  }
  return _instance
}

/** Replace or reset the singleton (pass null to reset; useful in tests). */
export function setClient(instance: AxiosInstance | null): void {
  _instance = instance
  if (!instance) _options = {}
}
