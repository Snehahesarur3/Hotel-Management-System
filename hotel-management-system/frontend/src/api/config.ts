/**
 * Single source of runtime API configuration, read from Vite env variables (.env / .env.local).
 * Components never read import.meta.env directly.
 */
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return value.trim().toLowerCase() === 'true'
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  mockEnabled: parseBoolean(import.meta.env.VITE_MOCK_API_ENABLED, true),
  mockLatencyMs: parseNonNegativeInt(import.meta.env.VITE_MOCK_LATENCY_MS, 300),
  requestTimeoutMs: 15_000,
} as const

export type ApiMode = 'mock' | 'http'

export const apiMode: ApiMode = apiConfig.mockEnabled ? 'mock' : 'http'

// Exported for unit tests.
export const __internal = { parseBoolean, parseNonNegativeInt }
