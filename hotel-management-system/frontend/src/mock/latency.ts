import { apiConfig } from '@/api/config'
import { ApiError } from '@/types/api'

/** Simulates network latency so loading states are exercised in mock mode. */
export function simulateLatency(ms: number = apiConfig.mockLatencyMs): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs a mock operation after the simulated latency, like a network round trip:
 * - the result is a structured clone, so callers never hold references into the mock database;
 * - ApiErrors pass through unchanged; any other failure becomes a 500 ApiError,
 *   matching what the HTTP adapter produces for an unexpected server error.
 */
export async function mockCall<T>(operation: () => T): Promise<T> {
  await simulateLatency()
  try {
    return structuredClone(operation())
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('[mock-api] Unexpected error', error)
    throw new ApiError(500, 'An unexpected error occurred')
  }
}
