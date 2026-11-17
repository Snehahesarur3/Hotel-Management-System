import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/types/api'
import { getDatabase, mutateDatabase, reloadDatabaseFromStorage, resetDatabase, subscribeToExternalChanges } from './db'
import { CURRENT_SEED_VERSION, STORAGE_KEY } from './storage'

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage() // start every test from a freshly seeded database
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mock database persistence', () => {
  it('seeds on first use and saves a versioned snapshot', () => {
    expect(getDatabase().rooms).toHaveLength(50)
    const snapshot = stored()
    expect(snapshot.schema).toBe(1)
    expect(snapshot.seedVersion).toBe(CURRENT_SEED_VERSION)
    expect(snapshot.db.rooms).toHaveLength(50)
  })

  it('keeps changes across a page reload', () => {
    mutateDatabase((db) => {
      db.rooms.find((r) => r.id === 'RM-101')!.pricePerNight = 3999
    })
    const reloaded = reloadDatabaseFromStorage()
    expect(reloaded.rooms.find((r) => r.id === 'RM-101')!.pricePerNight).toBe(3999)
  })

  it('applies mutations atomically: a failing mutation changes nothing', () => {
    const before = structuredClone(getDatabase())
    expect(() =>
      mutateDatabase((db) => {
        db.rooms[0]!.status = 'MAINTENANCE'
        db.guests.pop()
        throw new ApiError(409, 'Room is already booked')
      }),
    ).toThrow('Room is already booked')
    expect(getDatabase()).toEqual(before)
    expect(reloadDatabaseFromStorage()).toEqual(before)
  })

  it('re-seeds when stored data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(reloadDatabaseFromStorage().rooms).toHaveLength(50)
    expect(stored().seedVersion).toBe(CURRENT_SEED_VERSION)
  })

  it('re-seeds when the stored data comes from another seed version', () => {
    mutateDatabase((db) => {
      db.rooms = db.rooms.slice(0, 3)
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored(), seedVersion: CURRENT_SEED_VERSION - 1 }))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(reloadDatabaseFromStorage().rooms).toHaveLength(50)
  })

  it('keeps working in memory when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mutateDatabase((db) => {
      db.guests[0]!.fullName = 'Renamed Guest'
    })
    expect(getDatabase().guests[0]!.fullName).toBe('Renamed Guest')
  })

  it('reset discards local changes', () => {
    mutateDatabase((db) => {
      db.reservations = []
    })
    expect(resetDatabase().reservations).toHaveLength(40)
    expect(reloadDatabaseFromStorage().reservations).toHaveLength(40)
  })

  it('notices changes made in another tab', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToExternalChanges(onChange)

    // Simulate another tab writing a different price.
    const other = stored()
    other.db.rooms[0].pricePerNight = 1234
    localStorage.setItem(STORAGE_KEY, JSON.stringify(other))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(getDatabase().rooms[0]!.pricePerNight).toBe(1234)

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }))
    expect(onChange).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
