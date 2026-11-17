import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/types/api'
import { applyListQuery, collection, matchesSearch, nextId } from './collection'
import { reloadDatabaseFromStorage } from './db'
import { mockCall } from './latency'

interface Item {
  id: string
  name: string
  floor: number
  note?: string
}

const items: Item[] = [
  { id: 'A-1', name: 'Zoë Suite', floor: 5 },
  { id: 'A-2', name: 'garden room', floor: 1, note: 'quiet' },
  { id: 'A-3', name: 'Garden Deluxe', floor: 2 },
  { id: 'A-4', name: 'Room 10', floor: 10 },
  { id: 'A-5', name: 'Room 9', floor: 9 },
]

describe('applyListQuery', () => {
  const searchFields = (i: Item) => [i.name, i.note]

  it('searches case- and accent-insensitively, requiring every term', () => {
    expect(applyListQuery(items, { search: 'zoe' }, { searchFields }).content.map((i) => i.id)).toEqual(['A-1'])
    expect(applyListQuery(items, { search: 'GARDEN' }, { searchFields }).totalElements).toBe(2)
    expect(applyListQuery(items, { search: 'garden quiet' }, { searchFields }).content.map((i) => i.id)).toEqual(['A-2'])
    expect(applyListQuery(items, { search: '   ' }, { searchFields }).totalElements).toBe(5)
  })

  it('combines filters with search', () => {
    const page = applyListQuery(items, { search: 'garden' }, { searchFields, filter: (i) => i.floor > 1 })
    expect(page.content.map((i) => i.id)).toEqual(['A-3'])
  })

  it('sorts numbers numerically and text naturally, in both directions', () => {
    const byFloorDesc = applyListQuery(items, { sort: { field: 'floor', direction: 'desc' } })
    expect(byFloorDesc.content.map((i) => i.floor)).toEqual([10, 9, 5, 2, 1])
    const byName = applyListQuery(items, { sort: { field: 'name', direction: 'asc' } })
    expect(byName.content.map((i) => i.name)).toEqual(['garden room', 'Garden Deluxe', 'Room 9', 'Room 10', 'Zoë Suite'].sort((a, b) =>
      new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare(a, b),
    ))
    expect(byName.content.map((i) => i.name).slice(2, 4)).toEqual(['Room 9', 'Room 10'])
  })

  it('keeps empty values last whatever the direction', () => {
    const asc = applyListQuery(items, { sort: { field: 'note', direction: 'asc' } })
    const desc = applyListQuery(items, { sort: { field: 'note', direction: 'desc' } })
    expect(asc.content[0]!.id).toBe('A-2')
    expect(desc.content[0]!.id).toBe('A-2')
  })

  it('uses custom accessors and the default order as tie-breaker', () => {
    const page = applyListQuery(
      items,
      { sort: { field: 'nameLength', direction: 'asc' } },
      { sortAccessors: { nameLength: (i) => i.name.length }, defaultSort: (a, b) => a.id.localeCompare(b.id) },
    )
    expect(page.content.map((i) => i.id)).toEqual(['A-5', 'A-4', 'A-1', 'A-2', 'A-3'])
  })

  it('paginates the result', () => {
    const page = applyListQuery(items, { page: 1, size: 2 }, { defaultSort: (a, b) => a.id.localeCompare(b.id) })
    expect(page).toMatchObject({ page: 1, size: 2, totalElements: 5, totalPages: 3 })
    expect(page.content.map((i) => i.id)).toEqual(['A-3', 'A-4'])
  })

  it('matchesSearch ignores missing fields', () => {
    expect(matchesSearch([undefined, null, 'Amelia'], 'ame')).toBe(true)
  })
})

describe('nextId', () => {
  it('continues after the highest numeric id of the prefix', () => {
    expect(nextId(['BK-0007', 'BK-0040', 'PAY-0099', 'BK-x'], 'BK')).toBe('BK-0041')
    expect(nextId([], 'GST')).toBe('GST-0001')
  })
})

describe('collection CRUD', () => {
  beforeEach(() => {
    localStorage.clear()
    reloadDatabaseFromStorage()
  })

  const guests = collection('guests', { resource: 'Guest', idPrefix: 'GST' })

  it('reads records and returns 404 ApiErrors for unknown ids', () => {
    expect(guests.all()).toHaveLength(30)
    expect(guests.get('GST-0001').fullName).toBe('Aarav Mehta')
    expect(guests.findById('GST-9999')).toBeUndefined()
    expect(() => guests.get('GST-9999')).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('inserts with the next id and persists', () => {
    const { id: _ignored, ...template } = guests.get('GST-0001')
    void _ignored
    const created = guests.insert({ ...template, fullName: 'New Guest', email: 'new.guest@example.com' })
    expect(created.id).toBe('GST-0031')
    expect(reloadDatabaseFromStorage().guests.find((g) => g.id === 'GST-0031')?.fullName).toBe('New Guest')
  })

  it('rejects inserting a duplicate id with 409', () => {
    const existing = guests.get('GST-0002')
    expect(() => guests.insert(existing)).toThrow(expect.objectContaining({ status: 409 }))
  })

  it('updates fields but never the id', () => {
    const updated = guests.update('GST-0002', { phone: '+91 90000 99999', id: 'HACK' } as never)
    expect(updated.id).toBe('GST-0002')
    expect(guests.get('GST-0002').phone).toBe('+91 90000 99999')
    expect(() => guests.update('GST-9999', { phone: 'x' })).toThrow(ApiError)
  })

  it('removes records', () => {
    guests.remove('GST-0030')
    expect(guests.all()).toHaveLength(29)
    expect(() => guests.remove('GST-0030')).toThrow(expect.objectContaining({ status: 404 }))
  })
})

describe('mockCall', () => {
  it('returns detached copies', async () => {
    const source = { nested: { value: 1 } }
    const result = await mockCall(() => source)
    result.nested.value = 2
    expect(source.nested.value).toBe(1)
  })

  it('passes ApiErrors through and wraps unexpected errors as 500', async () => {
    await expect(mockCall(() => { throw new ApiError(409, 'Conflict!') })).rejects.toMatchObject({ status: 409, message: 'Conflict!' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(mockCall(() => { throw new TypeError('boom') })).rejects.toMatchObject({ status: 500 })
  })
})
