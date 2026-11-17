import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { InventoryItemInput, InventoryItemView, InventoryListQuery, StockInInput, StockOutInput } from '@/types/inventory'
import { useApiMutation } from './useApiMutation'

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (query: InventoryListQuery) => [...inventoryKeys.all, 'list', query] as const,
  summary: () => [...inventoryKeys.all, 'summary'] as const,
  suppliers: () => [...inventoryKeys.all, 'suppliers'] as const,
  movements: (id: string) => [...inventoryKeys.all, 'movements', id] as const,
}

const AFFECTED = [inventoryKeys.all]

export function useInventoryList(query: InventoryListQuery) {
  return useQuery({ queryKey: inventoryKeys.list(query), queryFn: () => api.inventory.list(query), placeholderData: keepPreviousData })
}

export function useInventorySummary() {
  return useQuery({ queryKey: inventoryKeys.summary(), queryFn: () => api.inventory.summary() })
}

export function useSuppliers() {
  return useQuery({ queryKey: inventoryKeys.suppliers(), queryFn: () => api.inventory.suppliers() })
}

export function useStockMovements(itemId: string | null) {
  return useQuery({
    queryKey: inventoryKeys.movements(itemId ?? ''),
    queryFn: () => api.inventory.movements(itemId!),
    enabled: itemId !== null,
  })
}

interface Options {
  onDone?: (item: InventoryItemView) => void
  onError?: (error: ApiError) => boolean | void
}

export function useSaveInventoryItem({ onDone, onError }: Options = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id?: string; input: InventoryItemInput }) => (id ? api.inventory.update(id, input) : api.inventory.create(input)),
    successMessage: (item, { id }) => `${item.name} ${id ? 'updated' : 'added'}`,
    invalidate: AFFECTED,
    onSuccess: (item) => onDone?.(item),
    onError,
  })
}

export type StockMovementRequest =
  | { id: string; direction: 'in'; input: StockInInput }
  | { id: string; direction: 'out'; input: StockOutInput }

export function useStockMovement({ onDone, onError }: Options = {}) {
  return useApiMutation({
    mutationFn: (request: StockMovementRequest) =>
      request.direction === 'in' ? api.inventory.stockIn(request.id, request.input) : api.inventory.stockOut(request.id, request.input),
    successMessage: (item, request) =>
      `${request.direction === 'in' ? 'Received' : 'Issued'} ${request.input.quantity} ${item.unit} of ${item.name} · ${item.quantity} in stock`,
    invalidate: AFFECTED,
    onSuccess: (item) => onDone?.(item),
    onError,
  })
}

export function useDeleteInventoryItem({ onDone }: { onDone?: () => void } = {}) {
  return useApiMutation({
    mutationFn: async (item: InventoryItemView) => {
      await api.inventory.remove(item.id)
      return item
    },
    successMessage: (item) => `${item.name} deleted`,
    invalidate: AFFECTED,
    onSuccess: () => onDone?.(),
  })
}
