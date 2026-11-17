import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { OrderStatus } from '@/types/enums'
import type { MenuItemInput, MenuItemView, MenuListQuery, OrderInput, OrderListQuery, OrderView } from '@/types/restaurant'
import { enumLabel, formatCurrency } from '@/utils/format'
import { useApiMutation } from './useApiMutation'

export const restaurantKeys = {
  all: ['restaurant'] as const,
  summary: () => [...restaurantKeys.all, 'summary'] as const,
  menu: (query: MenuListQuery) => [...restaurantKeys.all, 'menu', query] as const,
  orders: (query: OrderListQuery) => [...restaurantKeys.all, 'orders', query] as const,
}

/** Orders land on invoices and check-out bills. */
const ORDER_AFFECTED = [restaurantKeys.all, ['billing'], ['front-desk']]
const MENU_AFFECTED = [restaurantKeys.all]

export function useRestaurantSummary() {
  return useQuery({ queryKey: restaurantKeys.summary(), queryFn: () => api.restaurant.summary() })
}

export function useMenu(query: MenuListQuery) {
  return useQuery({ queryKey: restaurantKeys.menu(query), queryFn: () => api.restaurant.menu(query), placeholderData: keepPreviousData })
}

export function useOrders(query: OrderListQuery) {
  return useQuery({ queryKey: restaurantKeys.orders(query), queryFn: () => api.restaurant.orders(query), placeholderData: keepPreviousData })
}

interface Options<T> {
  onDone?: (result: T) => void
  onError?: (error: ApiError) => boolean | void
}

export function useSaveMenuItem({ onDone, onError }: Options<MenuItemView> = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id?: string; input: MenuItemInput }) =>
      id ? api.restaurant.updateMenuItem(id, input) : api.restaurant.createMenuItem(input),
    successMessage: (item, { id }) => `${item.name} ${id ? 'updated' : 'added to the menu'}`,
    invalidate: MENU_AFFECTED,
    onSuccess: (item) => onDone?.(item),
    onError,
  })
}

export function useSetAvailability() {
  return useApiMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => api.restaurant.setMenuItemAvailability(id, available),
    successMessage: (item) => `${item.name} is ${item.available ? 'available' : 'off the menu'}`,
    invalidate: MENU_AFFECTED,
  })
}

export function useDeleteMenuItem({ onDone }: { onDone?: () => void } = {}) {
  return useApiMutation({
    mutationFn: async (item: MenuItemView) => {
      await api.restaurant.removeMenuItem(item.id)
      return item
    },
    successMessage: (item) => `${item.name} deleted`,
    invalidate: MENU_AFFECTED,
    onSuccess: () => onDone?.(),
  })
}

export function useCreateOrder({ onDone, onError }: Options<OrderView> = {}) {
  return useApiMutation({
    mutationFn: (input: OrderInput) => api.restaurant.createOrder(input),
    successMessage: (o) => `${o.id} placed · ${formatCurrency(o.total)} charged to Room ${o.roomNumber}`,
    invalidate: ORDER_AFFECTED,
    onSuccess: (o) => onDone?.(o),
    onError,
  })
}

export function useUpdateOrderStatus({ onDone }: { onDone?: () => void } = {}) {
  return useApiMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => api.restaurant.updateOrderStatus(id, status),
    successMessage: (o) => `${o.id} ${enumLabel(o.status).toLowerCase()}`,
    invalidate: ORDER_AFFECTED,
    onSuccess: () => onDone?.(),
  })
}
