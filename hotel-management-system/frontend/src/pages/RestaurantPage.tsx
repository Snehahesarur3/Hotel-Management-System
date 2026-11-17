import { ChefHat, ClipboardList, Leaf, Pencil, Plus, ShoppingBag, Trash2, UtensilsCrossed, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TextInput } from '@/components/common/FormControls'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/common/Tabs'
import { MenuItemFormModal } from '@/components/restaurant/MenuItemFormModal'
import { OrderFormModal } from '@/components/restaurant/OrderFormModal'
import { useListParams } from '@/hooks/useListParams'
import { useDeleteMenuItem, useMenu, useOrders, useRestaurantSummary, useSetAvailability, useUpdateOrderStatus } from '@/hooks/useRestaurant'
import type { PageResponse } from '@/types/api'
import { invoiceNumberFor } from '@/types/billing'
import { MENU_CATEGORIES, ORDER_STATUSES, type MenuCategory, type OrderStatus } from '@/types/enums'
import type { MenuItemView, MenuListQuery, MenuSortField, OrderListQuery, OrderSortField, OrderView } from '@/types/restaurant'
import { cn } from '@/utils/cn'
import { enumLabel, formatCurrency, formatDateTime } from '@/utils/format'
import { ModuleLink } from '@/components/common/ModuleLink'

const TABS = [
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
] as const
type TabKey = (typeof TABS)[number]['key']
const PAGE_SIZE = 15
/** A hotel menu is short: show it on one page in most cases. */
const MENU_PAGE_SIZE = 25
const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
  value && (values as readonly string[]).includes(value) ? (value as T) : undefined

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

function useClampPage(data: PageResponse<unknown> | undefined, isPlaceholder: boolean, page: number, setPage: (p: number) => void) {
  const lastPage = data && data.totalPages > 0 ? data.totalPages - 1 : 0
  const outOfRange = Boolean(data && !isPlaceholder && page > lastPage)
  useEffect(() => {
    if (outOfRange) setPage(lastPage)
  }, [outOfRange, lastPage, setPage])
}

export function RestaurantPage() {
  const can = useCan()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabKey = searchParams.get('tab') === 'menu' ? 'menu' : 'orders'
  const summary = useRestaurantSummary()
  const [ordering, setOrdering] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemView | 'new' | null>(null)
  const s = summary.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant"
        description="Room service and restaurant orders, charged to guest bills, and the menu."
        actions={
          <>
            {can('restaurant.menu') && (
              <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditingItem('new')}>
                Add dish
              </Button>
            )}
            {can('restaurant.orders') && (
              <Button icon={<ShoppingBag className="size-4" aria-hidden />} onClick={() => setOrdering(true)}>
                New order
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Open orders" value={s.open} icon={ChefHat} hint={`${s.placed} placed · ${s.preparing} preparing`} />
            <StatCard label="Orders today" value={s.ordersToday} icon={ClipboardList} hint="Excluding cancelled" />
            <StatCard label="Sales today" value={formatCurrency(s.salesToday, { whole: true })} icon={Wallet} hint="Before GST, excluding cancelled" />
            <StatCard label="Menu available" value={`${s.availableItems} / ${s.totalItems}`} icon={UtensilsCrossed} hint="Dishes that can be ordered" />
          </>
        ) : summary.isError ? null : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
        )}
      </div>

      <Card>
        <Tabs label="Restaurant lists" idPrefix="restaurant" tabs={TABS} value={tab} onChange={(key) => setSearchParams(key === 'orders' ? {} : { tab: key })}>
          {tab === 'orders' ? <OrdersTab /> : <MenuTab onEdit={setEditingItem} />}
        </Tabs>
      </Card>

      <OrderFormModal open={ordering} onClose={() => setOrdering(false)} />
      <MenuItemFormModal open={editingItem !== null} item={editingItem === 'new' ? undefined : (editingItem ?? undefined)} onClose={() => setEditingItem(null)} />
    </div>
  )
}

// ------------------------------------------------------------------ orders

const ORDER_FILTERS = ['status', 'date'] as const
const ORDER_SORTS: readonly OrderSortField[] = ['orderedAt', 'total', 'status', 'roomNumber']
const NEXT_STEPS: Partial<Record<OrderStatus, Array<{ status: OrderStatus; label: string }>>> = {
  PLACED: [{ status: 'PREPARING', label: 'Start preparing' }],
  PREPARING: [
    { status: 'SERVED', label: 'Served' },
    { status: 'DELIVERED', label: 'Delivered' },
  ],
}

function OrdersTab() {
  const canOrder = useCan()('restaurant.orders')
  const { params, update, clear } = useListParams(ORDER_FILTERS, ORDER_SORTS)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.filters.date ?? '') ? params.filters.date : undefined
  const query: OrderListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    status: oneOf<OrderStatus>(ORDER_STATUSES, params.filters.status),
    date,
  }
  const orders = useOrders(query)
  const advance = useUpdateOrderStatus()
  const [cancelling, setCancelling] = useState<OrderView | null>(null)
  const cancel = useUpdateOrderStatus({ onDone: () => setCancelling(null) })
  const filtersActive = Boolean(query.search || query.status || query.date)
  useClampPage(orders.data, orders.isPlaceholderData, params.page, (page) => update({ page }))
  const busy = advance.isPending ? advance.variables : undefined

  const columns: Column<OrderView>[] = [
    {
      key: 'order',
      header: 'Order',
      sortField: 'orderedAt',
      render: (o) => (
        <div>
          <span className="font-medium">{o.id}</span>
          <p className="text-xs text-ink-muted">{formatDateTime(o.orderedAt)}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room / guest',
      sortField: 'roomNumber',
      render: (o) => (
        <div>
          <span>
            Room {o.roomNumber} · {o.guestName}
          </span>
          <p className="text-xs">
            <ModuleLink to={`/billing/invoices/${o.reservationId}`} className="text-brand-700 hover:underline">
              {invoiceNumberFor(o.reservationId)}
            </ModuleLink>
          </p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (o) => (
        <span className="block max-w-xs text-ink-muted whitespace-normal">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortField: 'total',
      align: 'right',
      render: (o) => <span className={cn('tabular-nums', o.status === 'CANCELLED' && 'text-ink-subtle line-through')}>{formatCurrency(o.total)}</span>,
    },
    { key: 'status', header: 'Status', sortField: 'status', render: (o) => <StatusBadge kind="order" status={o.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canOrder,
      render: (o) => {
        const steps = NEXT_STEPS[o.status]
        if (!steps) return null
        if (o.locked) return <span className="text-xs text-ink-subtle">Invoice final</span>
        return (
          <div className="flex justify-end gap-1">
            {steps.map((step) => (
              <Button
                key={step.status}
                size="sm"
                variant="secondary"
                loading={busy?.id === o.id && busy.status === step.status}
                onClick={() => advance.mutate({ id: o.id, status: step.status })}
                aria-label={`${step.label}: ${o.id}`}
              >
                {step.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setCancelling(o)} aria-label={`Cancel ${o.id}`}>
              Cancel
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label="Search orders" placeholder="Order, guest, room or dish…" value={params.search} onSearch={(search) => update({ search })} className="sm:w-64" />
        <FilterSelect
          label="Filter by order status"
          allLabel="All statuses"
          value={query.status ?? ''}
          options={ORDER_STATUSES.map((v) => ({ value: v, label: enumLabel(v) }))}
          onChange={(value) => update({ filters: { status: value } })}
        />
        <TextInput type="date" aria-label="Order date" value={date ?? ''} onChange={(e) => update({ filters: { date: e.target.value } })} className="sm:w-40" />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
            Clear filters
          </Button>
        )}
      </div>
      {orders.isPending ? (
        <div className="px-5 pb-5">
          <LoadingState label="Loading orders" rows={8} />
        </div>
      ) : orders.isError ? (
        <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} retrying={orders.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Orders"
            columns={columns}
            rows={orders.data.content}
            rowKey={(o) => o.id}
            sort={params.sort}
            onSortChange={(sort) => update({ sort: sort as OrderListQuery['sort'] | null })}
            busy={orders.isPlaceholderData}
            emptyTitle={filtersActive ? 'No orders match your filters' : 'No orders yet'}
          />
          <Pagination
            className="border-t border-line"
            page={orders.data.page}
            size={orders.data.size}
            totalElements={orders.data.totalElements}
            totalPages={orders.data.totalPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        title={cancelling ? `Cancel ${cancelling.id}?` : 'Cancel order?'}
        message={
          cancelling && (
            <p>
              Room {cancelling.roomNumber} · {formatCurrency(cancelling.total)}. The order is kept on record as Cancelled and removed from the guest’s bill.
            </p>
          )
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate({ id: cancelling.id, status: 'CANCELLED' }, { onError: () => setCancelling(null) })}
        onCancel={() => setCancelling(null)}
      />
    </>
  )
}

// ------------------------------------------------------------------ menu

const MENU_FILTERS = ['category', 'diet', 'availability'] as const
const MENU_SORTS: readonly MenuSortField[] = ['name', 'category', 'price', 'timesOrdered']

function MenuTab({ onEdit }: { onEdit: (item: MenuItemView) => void }) {
  const canEditMenu = useCan()('restaurant.menu')
  const [, setSearchParams] = useSearchParams()
  const { params, update } = useListParams(MENU_FILTERS, MENU_SORTS)
  const { diet, availability } = params.filters
  const query: MenuListQuery = {
    page: params.page,
    size: MENU_PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    category: oneOf<MenuCategory>(MENU_CATEGORIES, params.filters.category),
    vegetarian: diet === 'veg' ? true : diet === 'non-veg' ? false : undefined,
    available: availability === 'available' ? true : availability === 'unavailable' ? false : undefined,
  }
  const menu = useMenu(query)
  const toggle = useSetAvailability()
  const [deleting, setDeleting] = useState<MenuItemView | null>(null)
  const remove = useDeleteMenuItem({ onDone: () => setDeleting(null) })
  const filtersActive = Boolean(query.search || query.category || diet || availability)
  // Clearing keeps ?tab=menu.
  const clear = () => setSearchParams({ tab: 'menu' }, { replace: true })
  useClampPage(menu.data, menu.isPlaceholderData, params.page, (page) => update({ page }))

  const columns: Column<MenuItemView>[] = [
    {
      key: 'name',
      header: 'Dish',
      sortField: 'name',
      render: (m) => (
        <span className="flex items-center gap-1.5 font-medium">
          {m.name}
          {m.isVegetarian && <Leaf className="size-3.5 text-success" aria-label="Vegetarian" />}
        </span>
      ),
    },
    { key: 'category', header: 'Course', sortField: 'category', render: (m) => enumLabel(m.category) },
    { key: 'price', header: 'Price', sortField: 'price', align: 'right', render: (m) => formatCurrency(m.price) },
    { key: 'ordered', header: 'Orders', sortField: 'timesOrdered', align: 'right', hideOnMobile: true, render: (m) => m.timesOrdered },
    {
      key: 'available',
      header: 'Available',
      render: (m) => (
        <button
          type="button"
          role="switch"
          aria-checked={m.available}
          aria-label={`${m.name} available`}
          disabled={!canEditMenu || (toggle.isPending && toggle.variables?.id === m.id)}
          onClick={() => toggle.mutate({ id: m.id, available: !m.available })}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60',
            m.available ? 'bg-success' : 'bg-line',
          )}
        >
          <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', m.available ? 'translate-x-4.5' : 'translate-x-0.5')} />
        </button>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canEditMenu,
      render: (m) => (
        <div className="flex justify-end gap-1">
          <button type="button" className={iconButton} onClick={() => onEdit(m)} aria-label={`Edit ${m.name}`}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setDeleting(m)} aria-label={`Delete ${m.name}`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label="Search menu" placeholder="Search dishes…" value={params.search} onSearch={(search) => update({ search })} className="sm:w-56" />
        <FilterSelect
          label="Filter by course"
          allLabel="All courses"
          value={query.category ?? ''}
          options={MENU_CATEGORIES.map((v) => ({ value: v, label: enumLabel(v) }))}
          onChange={(value) => update({ filters: { category: value } })}
          className="sm:w-40"
        />
        <FilterSelect
          label="Filter by diet"
          allLabel="Veg & non-veg"
          value={diet ?? ''}
          options={[
            { value: 'veg', label: 'Vegetarian' },
            { value: 'non-veg', label: 'Non-vegetarian' },
          ]}
          onChange={(value) => update({ filters: { diet: value } })}
          className="sm:w-40"
        />
        <FilterSelect
          label="Filter by availability"
          allLabel="Any availability"
          value={availability ?? ''}
          options={[
            { value: 'available', label: 'Available' },
            { value: 'unavailable', label: 'Unavailable' },
          ]}
          onChange={(value) => update({ filters: { availability: value } })}
          className="sm:w-40"
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
            Clear filters
          </Button>
        )}
      </div>
      {menu.isPending ? (
        <div className="px-5 pb-5">
          <LoadingState label="Loading menu" rows={8} />
        </div>
      ) : menu.isError ? (
        <ErrorState message={menu.error.message} onRetry={() => void menu.refetch()} retrying={menu.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Menu"
            columns={columns}
            rows={menu.data.content}
            rowKey={(m) => m.id}
            sort={params.sort}
            onSortChange={(sort) => update({ sort: sort as MenuListQuery['sort'] | null })}
            busy={menu.isPlaceholderData}
            emptyTitle={filtersActive ? 'No dishes match your filters' : 'The menu is empty'}
          />
          <Pagination
            className="border-t border-line"
            page={menu.data.page}
            size={menu.data.size}
            totalElements={menu.data.totalElements}
            totalPages={menu.data.totalPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete dish?'}
        message={
          <>
            <p>This removes the dish from the menu permanently.</p>
            <p className="mt-2 text-xs text-ink-subtle">Dishes that appear on orders can’t be deleted. Switch them to unavailable instead.</p>
          </>
        }
        confirmLabel="Delete dish"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting, { onError: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
