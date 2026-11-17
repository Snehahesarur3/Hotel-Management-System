import { apiMode } from '@/api/config'
import { httpServices } from '@/api/http'
import type { DemoDataControls, ServiceProvider } from '@/api/types'
import { sessionStore } from '@/auth/session'
import { mockServices } from '@/mock/services'
import { withAccessControl } from '@/mock/services/accessControl'
import { mockDemoData } from '@/mock/services/demoData'

/**
 * The API adapter. Components and hooks import ONLY this module:
 *
 *   import { api } from '@/api'
 *   const health = await api.system.health()
 *
 * VITE_MOCK_API_ENABLED decides whether calls go to the in-browser mock services
 * or to the Spring Boot backend via Axios. Both check the signed-in user's role:
 * the backend in SecurityConfig, the mock services through the same rules (withAccessControl).
 */
export const api: ServiceProvider =
  apiMode === 'mock' ? withAccessControl(mockServices, () => sessionStore.get()?.user ?? null) : httpServices

/** Demo-data controls (reset, cross-tab sync); null when the backend is the data source. */
export const demoData: DemoDataControls | null = apiMode === 'mock' ? mockDemoData : null

export { apiMode } from '@/api/config'
export type { DemoDataControls, ServiceProvider } from '@/api/types'
