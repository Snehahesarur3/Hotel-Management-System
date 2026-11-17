import type { InventoryService } from '@/api/types'
import { applyListQuery, nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { inventoryItemSchema, stockInSchema, stockOutSchema } from '@/schemas/inventory'
import { ApiError } from '@/types/api'
import type { InventoryItem, StockMovement } from '@/types/domain'
import { INVENTORY_CATEGORIES, type StockMovementType } from '@/types/enums'
import type {
  InventoryItemInput,
  InventoryItemView,
  InventoryListQuery,
  InventorySummary,
  StockInInput,
  StockOutInput,
  StockStatus,
  SupplierView,
} from '@/types/inventory'
import { nowISODateTime, todayISO } from '@/utils/date'
import { roundMoney, sumMoney } from '@/utils/money'

/**
 * Mock implementation of /api/inventory.
 * - Quantities change only through stock movements (stock-in / stock-out), each recorded with a reason and the
 *   resulting balance; editing an item never changes its quantity.
 * - Stock-out cannot exceed the stock on hand.
 * - LOW = at or below the reorder level; OUT = nothing left.
 * - Item names are unique (ignoring case); only items with no stock and no movement history can be deleted.
 */

const statusOf = (item: InventoryItem): StockStatus =>
  item.quantity === 0 ? 'OUT' : item.quantity <= item.minStockLevel ? 'LOW' : 'IN_STOCK'

const toView = (item: InventoryItem): InventoryItemView => ({
  ...item,
  stockStatus: statusOf(item),
  stockValue: roundMoney(item.quantity * item.unitCost),
  shortfall: Math.max(0, item.minStockLevel - item.quantity),
})

/** Lower = more urgent: share of the reorder level that is in stock. */
const urgency = (item: InventoryItem) => (item.minStockLevel === 0 ? 1 : item.quantity / item.minStockLevel)

function findItem(db: MockDatabase, id: string): InventoryItem {
  const item = db.inventory.find((i) => i.id === id)
  if (!item) throw new ApiError(404, `Inventory item with id '${id}' was not found`)
  return item
}

function assertNameAvailable(db: MockDatabase, name: string, exceptId?: string) {
  const clash = db.inventory.find((i) => i.name.toLowerCase() === name.toLowerCase() && i.id !== exceptId)
  if (clash) {
    const message = `“${clash.name}” is already in inventory (${clash.id})`
    throw new ApiError(409, message, { name: message })
  }
}

// ------------------------------------------------------------------ queries

function list(query: InventoryListQuery = {}) {
  const db = getDatabase()
  const { category, stock, supplier } = query
  return applyListQuery(
    db.inventory.map(toView),
    query,
    {
      searchFields: (i) => [i.id, i.name, i.supplier.name, i.supplier.contactPerson, i.unit],
      filter: (i) =>
        (!category || i.category === category) &&
        (!supplier || i.supplier.name === supplier) &&
        (!stock || (stock === 'OUT' ? i.stockStatus === 'OUT' : i.stockStatus !== 'IN_STOCK')),
      sortAccessors: { category: (i) => INVENTORY_CATEGORIES.indexOf(i.category) },
      defaultSort: (a, b) => INVENTORY_CATEGORIES.indexOf(a.category) - INVENTORY_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name),
    },
  )
}

function summary(): InventorySummary {
  const items = getDatabase().inventory.map(toView)
  const reorder = items.filter((i) => i.stockStatus !== 'IN_STOCK').sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name))
  return {
    totalItems: items.length,
    lowCount: reorder.length,
    outCount: items.filter((i) => i.stockStatus === 'OUT').length,
    stockValue: sumMoney(items.map((i) => i.stockValue)),
    reorder,
  }
}

function suppliers(): SupplierView[] {
  const byName = new Map<string, SupplierView>()
  for (const item of getDatabase().inventory) {
    const entry = byName.get(item.supplier.name) ?? { ...item.supplier, itemCount: 0, lowCount: 0, categories: [] }
    entry.itemCount += 1
    if (statusOf(item) !== 'IN_STOCK') entry.lowCount += 1
    if (!entry.categories.includes(item.category)) entry.categories.push(item.category)
    byName.set(item.supplier.name, entry)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function movements(itemId: string): StockMovement[] {
  const db = getDatabase()
  findItem(db, itemId)
  return db.stockMovements.filter((m) => m.itemId === itemId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
}

// ------------------------------------------------------------------ commands

function recordMovement(draft: MockDatabase, item: InventoryItem, type: StockMovementType, quantity: number, reason: string) {
  const movement: StockMovement = {
    id: nextId(draft.stockMovements.map((m) => m.id), 'STK'),
    itemId: item.id,
    type,
    quantity,
    reason,
    balanceAfter: item.quantity,
    createdAt: nowISODateTime(),
  }
  draft.stockMovements.push(movement)
}

function create(raw: InventoryItemInput): InventoryItemView {
  const db = getDatabase()
  const input = parseOrThrow(inventoryItemSchema, raw)
  assertNameAvailable(db, input.name)
  return mutateDatabase((draft) => {
    const item: InventoryItem = { ...input, id: nextId(draft.inventory.map((i) => i.id), 'INV'), lastRestocked: todayISO() }
    draft.inventory.push(item)
    if (item.quantity > 0) recordMovement(draft, item, 'STOCK_IN', item.quantity, 'Opening stock')
    return toView(item)
  })
}

function update(id: string, raw: InventoryItemInput): InventoryItemView {
  const db = getDatabase()
  const existing = findItem(db, id)
  // Quantity is managed by movements; the stored value wins over whatever the client sends.
  const input = parseOrThrow(inventoryItemSchema, { ...raw, quantity: existing.quantity })
  assertNameAvailable(db, input.name, id)
  return mutateDatabase((draft) => {
    const index = draft.inventory.findIndex((i) => i.id === id)
    const item: InventoryItem = { ...input, id, lastRestocked: existing.lastRestocked }
    draft.inventory[index] = item
    return toView(item)
  })
}

function stockIn(id: string, raw: StockInInput): InventoryItemView {
  const db = getDatabase()
  findItem(db, id)
  const { quantity, reason, unitCost } = parseOrThrow(stockInSchema, raw)
  return mutateDatabase((draft) => {
    const item = draft.inventory.find((i) => i.id === id)!
    item.quantity += quantity
    if (unitCost !== undefined) item.unitCost = unitCost
    item.lastRestocked = todayISO()
    recordMovement(draft, item, 'STOCK_IN', quantity, reason)
    return toView(item)
  })
}

function stockOut(id: string, raw: StockOutInput): InventoryItemView {
  const db = getDatabase()
  const existing = findItem(db, id)
  const { quantity, reason } = parseOrThrow(stockOutSchema, raw)
  if (quantity > existing.quantity) {
    const message = `Only ${existing.quantity} ${existing.unit} in stock`
    throw new ApiError(409, message, { quantity: message })
  }
  return mutateDatabase((draft) => {
    const item = draft.inventory.find((i) => i.id === id)!
    item.quantity -= quantity
    recordMovement(draft, item, 'STOCK_OUT', quantity, reason)
    return toView(item)
  })
}

function remove(id: string): void {
  const db = getDatabase()
  const item = findItem(db, id)
  if (item.quantity > 0) {
    throw new ApiError(409, `${item.name} still has ${item.quantity} ${item.unit} in stock. Stock it out before deleting.`)
  }
  const history = db.stockMovements.filter((m) => m.itemId === id).length
  if (history > 0) {
    throw new ApiError(409, `${item.name} has ${history} stock movement${history === 1 ? '' : 's'} on record and cannot be deleted.`)
  }
  mutateDatabase((draft) => {
    draft.inventory = draft.inventory.filter((i) => i.id !== id)
  })
}

export const mockInventoryService: InventoryService = {
  list: (query) => mockCall(() => list(query)),
  summary: () => mockCall(summary),
  suppliers: () => mockCall(suppliers),
  movements: (id) => mockCall(() => movements(id)),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  stockIn: (id, input) => mockCall(() => stockIn(id, input)),
  stockOut: (id, input) => mockCall(() => stockOut(id, input)),
  remove: (id) => mockCall(() => remove(id)),
}
