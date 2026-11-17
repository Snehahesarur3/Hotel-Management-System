import { buildDatabaseFromSeed, type MockDatabase } from '@/mock/seed'
import { loadSnapshot, saveSnapshot, STORAGE_KEY } from '@/mock/storage'
import { todayISO } from '@/utils/date'

/**
 * The in-browser mock database.
 *
 * - First access: loads the persisted copy from localStorage, or materialises the seed and saves it.
 * - Writes go through {@link mutateDatabase}: the mutator runs on a draft copy, and the draft
 *   replaces the current state (and is persisted) only if the mutator completes. A business-rule
 *   error therefore never leaves half-applied changes behind.
 * - Changes made in another tab are picked up through the `storage` event.
 */
let database: MockDatabase | null = null

function seedAndPersist(): MockDatabase {
  const fresh = buildDatabaseFromSeed(todayISO())
  saveSnapshot(fresh)
  return fresh
}

/** Current state. Treat the returned object as read-only; change data with mutateDatabase. */
export function getDatabase(): MockDatabase {
  database ??= loadSnapshot() ?? seedAndPersist()
  return database
}

/** Applies `mutator` atomically and persists the result. Returns the mutator's return value. */
export function mutateDatabase<T>(mutator: (draft: MockDatabase) => T): T {
  const draft = structuredClone(getDatabase())
  const result = mutator(draft)
  database = draft
  saveSnapshot(draft)
  return result
}

/** Discards all changes and restores the canonical seed (dates re-resolved against today). */
export function resetDatabase(): MockDatabase {
  database = seedAndPersist()
  return database
}

/** Drops the in-memory copy so the next access re-reads storage (simulates a page reload). */
export function reloadDatabaseFromStorage(): MockDatabase {
  database = null
  return getDatabase()
}

/**
 * Calls `onChange` when another browser tab modifies the demo data.
 * Returns an unsubscribe function.
 */
export function subscribeToExternalChanges(onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    database = null // re-read on next access
    onChange()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
