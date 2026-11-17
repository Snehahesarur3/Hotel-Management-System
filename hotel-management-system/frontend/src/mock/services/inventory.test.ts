import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { InventoryItemInput } from '@/types/inventory'
import { todayISO } from '@/utils/date'
import { mockInventoryService as inventory } from './inventory'

const towel: InventoryItemInput = {
  name: 'Pool Towel (Blue)',
  category: 'LINEN',
  unit: 'pcs',
  quantity: 50,
  minStockLevel: 40,
  unitCost: 380,
  supplier: { name: 'Coastal Linen Co.', contactPerson: 'Rita Fernandes', phone: '+91 90000 70011', email: 'orders@coastallinen.example' },
}
const item = (id: string) => getDatabase().inventory.find((i) => i.id === id)!

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('stock list', () => {
  it('lists items by category with stock status and value', async () => {
    const page = await inventory.list({ size: 50 })
    expect(page.totalElements).toBe(30)
    expect(page.content[0]).toMatchObject({ category: 'LINEN', name: 'Bath Towel (White)' })
    expect(page.content.find((i) => i.id === 'INV-0013')).toMatchObject({ stockStatus: 'LOW', shortfall: 12, stockValue: expect.any(Number) })
    expect((await inventory.list({ stock: 'LOW', size: 50 })).content.map((i) => i.id).sort()).toEqual(['INV-0004', 'INV-0008', 'INV-0013', 'INV-0018', 'INV-0025'])
    expect((await inventory.list({ supplier: 'BrightCare Supplies' })).totalElements).toBe(5)
  })

  it('summarises stock and orders the reorder list by urgency', async () => {
    const summary = await inventory.summary()
    expect(summary).toMatchObject({ totalItems: 30, lowCount: 5, outCount: 0 })
    expect(summary.reorder.map((i) => i.id)).toEqual(['INV-0025', 'INV-0013', 'INV-0004', 'INV-0018', 'INV-0008'])
    expect(summary.stockValue).toBeGreaterThan(0)
  })

  it('derives suppliers from items', async () => {
    const suppliers = await inventory.suppliers()
    expect(suppliers).toHaveLength(6)
    expect(suppliers.find((s) => s.name === 'Coastal Linen Co.')).toMatchObject({ itemCount: 5, lowCount: 1, categories: ['LINEN'] })
  })
})

describe('stock movements', () => {
  it('receives stock, updates cost and restock date, and records the movement', async () => {
    const after = await inventory.stockIn('INV-0013', { quantity: 20, reason: 'Purchase order received', unitCost: 260 })
    expect(after).toMatchObject({ quantity: 28, unitCost: 260, stockStatus: 'IN_STOCK', lastRestocked: todayISO() })
    expect(await inventory.movements('INV-0013')).toEqual([
      expect.objectContaining({ type: 'STOCK_IN', quantity: 20, balanceAfter: 28, reason: 'Purchase order received' }),
    ])
  })

  it('issues stock but never more than is on hand', async () => {
    await expect(inventory.stockOut('INV-0025', { quantity: 5, reason: 'Issued to maintenance' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { quantity: 'Only 4 packs in stock' },
    })
    expect((await inventory.stockOut('INV-0025', { quantity: 4, reason: 'Issued to maintenance' })).stockStatus).toBe('OUT')
    expect((await inventory.summary()).outCount).toBe(1)
    await expect(inventory.stockOut('INV-0025', { quantity: 1, reason: 'x' })).rejects.toMatchObject({
      fieldErrors: { reason: 'Give a reason' },
    })
  })

  it('lists movements newest first', async () => {
    await inventory.stockOut('INV-0001', { quantity: 10, reason: 'Issued to housekeeping' })
    await inventory.stockIn('INV-0001', { quantity: 30, reason: 'Purchase order received' })
    expect((await inventory.movements('INV-0001')).map((m) => m.balanceAfter)).toEqual([340, 310])
  })
})

describe('items', () => {
  it('creates items with an opening-stock movement and unique names', async () => {
    const created = await inventory.create(towel)
    expect(created).toMatchObject({ id: 'INV-0031', quantity: 50, lastRestocked: todayISO() })
    expect(await inventory.movements(created.id)).toEqual([expect.objectContaining({ reason: 'Opening stock', balanceAfter: 50 })])
    await expect(inventory.create({ ...towel, name: 'bath towel (white)' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { name: '“Bath Towel (White)” is already in inventory (INV-0001)' },
    })
  })

  it('never changes quantity on edit', async () => {
    const { id: _id, lastRestocked: _l, ...rest } = item('INV-0001')
    void [_id, _l]
    const updated = await inventory.update('INV-0001', { ...rest, quantity: 9999, minStockLevel: 250 })
    expect(updated).toMatchObject({ quantity: 320, minStockLevel: 250 })
  })

  it('deletes only items with no stock and no history', async () => {
    await expect(inventory.remove('INV-0001')).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/still has 320 pcs in stock/) })
    const withHistory = await inventory.create(towel)
    await inventory.stockOut(withHistory.id, { quantity: 50, reason: 'Damaged or expired' })
    await expect(inventory.remove(withHistory.id)).rejects.toMatchObject({ message: expect.stringMatching(/2 stock movements on record/) })
    const empty = await inventory.create({ ...towel, name: 'Spare Towel', quantity: 0 })
    await inventory.remove(empty.id)
    expect(getDatabase().inventory.some((i) => i.id === empty.id)).toBe(false)
  })
})
