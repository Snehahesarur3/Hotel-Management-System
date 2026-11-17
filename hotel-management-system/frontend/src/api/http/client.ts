import axios, { AxiosError } from 'axios'
import { apiConfig } from '@/api/config'
import { sessionStore } from '@/auth/session'
import { ApiError } from '@/types/api'

/** Axios instance for the Spring Boot API. Only used when mock mode is disabled. */
export const httpClient = axios.create({
  baseURL: apiConfig.baseUrl,
  timeout: apiConfig.requestTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
})

interface BackendErrorBody {
  status?: number
  message?: string
  fieldErrors?: Record<string, string>
}

/** Converts any Axios/network failure into an {@link ApiError}. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError(0, 'Cannot reach the server. Check that the backend is running.')
    }
    const body = (error.response.data ?? {}) as BackendErrorBody
    return new ApiError(
      error.response.status,
      body.message ?? error.message ?? 'Request failed',
      body.fieldErrors,
    )
  }
  return new ApiError(0, error instanceof Error ? error.message : 'Unknown error')
}

// Every request carries the signed-in user's credentials, unless the caller set its own (sign-in does).
httpClient.interceptors.request.use((config) => {
  const authorization = sessionStore.get()?.authorization
  if (authorization && !config.headers.has('Authorization')) config.headers.set('Authorization', authorization)
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    // The API no longer accepts the session's credentials (e.g. the backend restarted with other users):
    // end the session so the app returns to the sign-in page. Sign-in requests have no session yet.
    const sentSession = error instanceof AxiosError && error.config?.headers?.get('Authorization') === sessionStore.get()?.authorization
    if (apiError.status === 401 && sessionStore.get() && sentSession) sessionStore.end('expired')
    return Promise.reject(apiError)
  },
)
