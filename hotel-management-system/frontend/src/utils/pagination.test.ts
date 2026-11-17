import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

const items = Array.from({ length: 45 }, (_, i) => i + 1)

describe('paginate', () => {
  it('returns the requested page with totals', () => {
    const page = paginate(items, 1, 20)
    expect(page.content[0]).toBe(21)
    expect(page.content).toHaveLength(20)
    expect(page.totalElements).toBe(45)
    expect(page.totalPages).toBe(3)
  })

  it('returns a partial last page and an empty page past the end', () => {
    expect(paginate(items, 2, 20).content).toEqual([41, 42, 43, 44, 45])
    expect(paginate(items, 9, 20).content).toEqual([])
  })

  it('rejects invalid paging arguments', () => {
    expect(() => paginate(items, -1, 20)).toThrow(RangeError)
    expect(() => paginate(items, 0, 0)).toThrow(RangeError)
    expect(() => paginate(items, 0, 500)).toThrow(RangeError)
  })
})
