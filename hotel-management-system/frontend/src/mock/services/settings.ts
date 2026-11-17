import type { SettingsService } from '@/api/types'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { parseOrThrow } from '@/mock/validation'
import { settingsInputSchema } from '@/schemas/settings'

/**
 * Mock implementation of /api/settings (backend: SettingsServiceImpl).
 * Only the hotel profile and check-in/check-out times change; the new profile appears on every invoice.
 * Currency, time zone and GST rates stay as seeded.
 */
export const mockSettingsService: SettingsService = {
  get: () => mockCall(() => getDatabase().settings),
  update: (raw) =>
    mockCall(() => {
      const { name, address, phone, email, gstin, checkInTime, checkOutTime } = parseOrThrow(settingsInputSchema, raw)
      return mutateDatabase((db) => {
        db.settings = { ...db.settings, hotel: { name, address, phone, email, gstin }, checkInTime, checkOutTime }
        return db.settings
      })
    }),
}
