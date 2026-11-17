import type { ListQuery } from './api'
import type { InventoryItem, StockMovement, Supplier } from './domain'
import type { InventoryCategory } from './enums'

/** Stock state: OUT at zero, LOW at or below the reorder level. */
export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT'

export interface InventoryItemView extends InventoryItem {
  stockStatus: StockStatus
  /** quantity x unitCost */
  stockValue: number
  /** How many units are needed to get back to the reorder level (0 when above it). */
  shortfall: number
}

/**
 * Body of POST /api/inventory/items (with `quantity` = opening stock) and PUT /api/inventory/items/{id}
 * (`quantity` ignored: stock only changes through movements).
 */
export type InventoryItemInput = Omit<InventoryItem, 'id' | 'lastRestocked'>

export type InventorySortField = 'name' | 'category' | 'quantity' | 'unitCost' | 'stockValue' | 'lastRestocked'

/** GET /api/inventory/items?search=&category=&stock=&supplier=&page=&size=&sort= */
export type InventoryListQuery = ListQuery<InventorySortField> & {
  category?: InventoryCategory
  /** LOW includes OUT (everything that needs reordering). */
  stock?: 'LOW' | 'OUT'
  supplier?: string
}

/** POST /api/inventory/items/{id}/stock-in */
export interface StockInInput {
  quantity: number
  reason: string
  /** Optional new unit cost from the supplier invoice. */
  unitCost?: number
}

/** POST /api/inventory/items/{id}/stock-out */
export interface StockOutInput {
  quantity: number
  reason: string
}

/** GET /api/inventory/summary */
export interface InventorySummary {
  totalItems: number
  lowCount: number
  outCount: number
  stockValue: number
  /** Items that need reordering, most urgent (lowest stock relative to reorder level) first. */
  reorder: InventoryItemView[]
}

/** GET /api/inventory/suppliers: derived from item supplier details. */
export interface SupplierView extends Supplier {
  itemCount: number
  lowCount: number
  categories: InventoryCategory[]
}

export type { StockMovement }

/** Reasons offered in the forms (free text is also accepted). */
export const STOCK_IN_REASONS = ['Purchase order received', 'Returned to store', 'Stock count correction'] as const
export const STOCK_OUT_REASONS = ['Issued to housekeeping', 'Issued to kitchen', 'Issued to maintenance', 'Damaged or expired', 'Stock count correction'] as const
