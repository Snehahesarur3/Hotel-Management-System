import type { DemoDataControls } from '@/api/types'
import { getDatabase, resetDatabase, subscribeToExternalChanges } from '@/mock/db'
import { mockCall } from '@/mock/latency'

/** Mock-mode only: manage the browser's copy of the demo data. */
export const mockDemoData: DemoDataControls = {
  seededOn: () => getDatabase().seededOn,
  reset: () => mockCall(() => ({ seededOn: resetDatabase().seededOn })),
  subscribe: subscribeToExternalChanges,
}
