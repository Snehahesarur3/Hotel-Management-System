import settingsJson from '@seed/settings.json'
import type { MockDatabase } from '@/mock/seed'

/**
 * localStorage persistence for the mock database.
 * Every access is wrapped in try/catch: storage can be unavailable (private mode, blocked
 * site data) or full, in which case the app keeps working in memory for the session.
 */
export const STORAGE_KEY = 'hms.mock-db'
const SCHEMA_VERSION = 1
export const CURRENT_SEED_VERSION: number = settingsJson.seedVersion

const COLLECTIONS = [
  'rooms',
  'guests',
  'reservations',
  'payments',
  'staff',
  'menuItems',
  'restaurantOrders',
  'inventory',
  'housekeepingTasks',
] as const satisfies ReadonlyArray<keyof MockDatabase>

interface Snapshot {
  schema: number
  seedVersion: number
  savedAt: string
  db: MockDatabase
}

function isValidSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Partial<Snapshot>
  const db = snapshot.db as Partial<MockDatabase> | undefined
  return (
    snapshot.schema === SCHEMA_VERSION &&
    snapshot.seedVersion === CURRENT_SEED_VERSION &&
    typeof db === 'object' &&
    db !== null &&
    typeof db.seededOn === 'string' &&
    typeof db.settings === 'object' &&
    COLLECTIONS.every((key) => Array.isArray(db[key]))
  )
}

/**
 * Fills in collections added after a snapshot was saved, so existing demo data (and the user's
 * changes to it) survive app upgrades instead of being re-seeded.
 */
const ADDED_COLLECTIONS = ['billAdjustments', 'stockMovements'] as const satisfies ReadonlyArray<keyof MockDatabase>

function migrate(db: MockDatabase): MockDatabase {
  const migrated: Record<string, unknown> = { ...db }
  for (const key of ADDED_COLLECTIONS) if (!Array.isArray(migrated[key])) migrated[key] = []
  return migrated as unknown as MockDatabase
}

/**
 * Returns the persisted database, or null when there is none, it is unreadable,
 * or it was produced by a different seed/schema version (the caller then re-seeds).
 */
export function loadSnapshot(): MockDatabase | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isValidSnapshot(parsed)) return migrate(parsed.db)
    console.info('[mock-db] Stored demo data is outdated or invalid; re-seeding.')
    return null
  } catch (error) {
    console.warn('[mock-db] Could not read stored demo data; re-seeding.', error)
    return null
  }
}

/** Persists the database. Returns false if storage is unavailable or full. */
export function saveSnapshot(db: MockDatabase): boolean {
  try {
    const snapshot: Snapshot = { schema: SCHEMA_VERSION, seedVersion: CURRENT_SEED_VERSION, savedAt: new Date().toISOString(), db }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch (error) {
    console.warn('[mock-db] Could not save demo data; changes will last for this session only.', error)
    return false
  }
}
