import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, History, IndianRupee, PackageX, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card, CardHeader } from '@/components/common/Card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { Tabs } from '@/components/common/Tabs'
import { InventoryItemFormModal } from '@/components/inventory/InventoryItemFormModal'
import { MovementHistoryDialog, StockMovementDialog } from '@/components/inventory/StockDialogs'
import { useDeleteInventoryItem, useInventoryList, useInventorySummary, useSuppliers } from '@/hooks/useInventory'
import { useListParams } from '@/hooks/useListParams'
import { INVENTORY_CATEGORIES, type InventoryCategory } from '@/types/enums'
import type { InventoryItemView, InventoryListQuery, InventorySortField, StockStatus, SupplierView } from '@/types/inventory'
import { cn } from '@/utils/cn'
import { enumLabel, formatCurrency, formatDate } from '@/utils/format'

const TABS = [
  { key: 'items', label: 'Stock', icon: Boxes },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
] as const
type TabKey = (typeof TABS)[number]['key']
const FILTER_KEYS = ['category', 'stock', 'supplier'] as const
const SORT_FIELDS: readonly InventorySortField[] = ['name', 'category', 'quantity', 'unitCost', 'stockValue', 'lastRestocked']
const PAGE_SIZE = 15

const STOCK_BADGE: Record<StockStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  IN_STOCK: { tone: 'success', label: 'In stock' },
  LOW: { tone: 'warning', label: 'Low' },
  OUT: { tone: 'danger', label: 'Out of stock' },
}

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

type Movement = { item: InventoryItemView; direction: 'in' | 'out' }

export function InventoryPage() {
  // Everyone who sees inventory may receive and issue stock; only management edits the item list.
  const canManage = useCan()('inventory.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabKey = searchParams.get('tab') === 'suppliers' ? 'suppliers' : 'items'
  const summary = useInventorySummary()
  const [formItem, setFormItem] = useState<InventoryItemView | 'new' | null>(null)
  const [moving, setMoving] = useState<Movement | null>(null)
  const s = summary.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels, stock-in and stock-out, reorder alerts and suppliers."
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setFormItem('new')}>
              Add item
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Items tracked" value={s.totalItems} icon={Boxes} hint={`${INVENTORY_CATEGORIES.length} categories`} />
            <StatCard label="Need reordering" value={s.lowCount} icon={AlertTriangle} hint="At or below reorder level" />
            <StatCard label="Out of stock" value={s.outCount} icon={PackageX} hint="Nothing left on hand" />
            <StatCard label="Stock value" value={formatCurrency(s.stockValue, { whole: true })} icon={IndianRupee} hint="Quantity × unit cost" />
          </>
        ) : summary.isError ? null : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
        )}
      </div>

      {s && s.reorder.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" aria-hidden /> Low-stock alerts
              </span>
            }
            subtitle="Most urgent first. Receive stock to clear an alert."
          />
          <ul className="divide-y divide-line border-t border-line">
            {s.reorder.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    {item.quantity} of {item.minStockLevel} {item.unit} · {item.supplier.name} · {item.supplier.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STOCK_BADGE[item.stockStatus].tone}>{STOCK_BADGE[item.stockStatus].label}</Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowDownToLine className="size-3.5" aria-hidden />}
                    onClick={() => setMoving({ item, direction: 'in' })}
                    aria-label={`Stock in ${item.name}`}
                  >
                    Stock in
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <Tabs label="Inventory lists" idPrefix="inventory" tabs={TABS} value={tab} onChange={(key) => setSearchParams(key === 'items' ? {} : { tab: key })}>
          {tab === 'items' ? (
            <ItemsTab onEdit={setFormItem} onMove={setMoving} />
          ) : (
            <SuppliersTab onShowItems={(supplier) => setSearchParams({ supplier })} />
          )}
        </Tabs>
      </Card>

      <InventoryItemFormModal open={formItem !== null} item={formItem === 'new' ? undefined : (formItem ?? undefined)} onClose={() => setFormItem(null)} />
      <StockMovementDialog target={moving} onClose={() => setMoving(null)} />
    </div>
  )
}

function ItemsTab({ onEdit, onMove }: { onEdit: (item: InventoryItemView) => void; onMove: (m: Movement) => void }) {
  const canManage = useCan()('inventory.manage')
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  const category = params.filters.category
  const stock = params.filters.stock
  const query: InventoryListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    category: (INVENTORY_CATEGORIES as readonly string[]).includes(category ?? '') ? (category as InventoryCategory) : undefined,
    stock: stock === 'LOW' || stock === 'OUT' ? stock : undefined,
    supplier: params.filters.supplier || undefined,
  }
  const items = useInventoryList(query)
  const [history, setHistory] = useState<InventoryItemView | null>(null)
  const [deleting, setDeleting] = useState<InventoryItemView | null>(null)
  const remove = useDeleteInventoryItem({ onDone: () => setDeleting(null) })
  const filtersActive = Boolean(query.search || query.category || query.stock || query.supplier)

  const lastPage = items.data && items.data.totalPages > 0 ? items.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(items.data && !items.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const columns: Column<InventoryItemView>[] = [
    {
      key: 'name',
      header: 'Item',
      sortField: 'name',
      render: (i) => (
        <div>
          <span className="font-medium">{i.name}</span>
          <p className="text-xs text-ink-muted">
            {i.id} · {enumLabel(i.category)}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'On hand',
      sortField: 'quantity',
      render: (i) => {
        // Level relative to twice the reorder point, so "comfortably stocked" fills the bar.
        const level = i.minStockLevel === 0 ? 100 : Math.min(100, Math.round((i.quantity / (i.minStockLevel * 2)) * 100))
        return (
          <div className="min-w-32">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium tabular-nums">
                {i.quantity} <span className="text-xs font-normal text-ink-muted">{i.unit}</span>
              </span>
              <Badge tone={STOCK_BADGE[i.stockStatus].tone}>{STOCK_BADGE[i.stockStatus].label}</Badge>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-canvas" aria-hidden>
              <div
                className={cn('h-full rounded-full', i.stockStatus === 'IN_STOCK' ? 'bg-success' : i.stockStatus === 'LOW' ? 'bg-warning' : 'bg-danger')}
                style={{ width: `${level}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">Reorder at {i.minStockLevel}</p>
          </div>
        )
      },
    },
    { key: 'cost', header: 'Unit cost', sortField: 'unitCost', align: 'right', hideOnMobile: true, render: (i) => formatCurrency(i.unitCost) },
    { key: 'value', header: 'Value', sortField: 'stockValue', align: 'right', hideOnMobile: true, render: (i) => formatCurrency(i.stockValue, { whole: true }) },
    {
      key: 'supplier',
      header: 'Supplier',
      hideOnMobile: true,
      render: (i) => (
        <div>
          <span>{i.supplier.name}</span>
          <p className="text-xs text-ink-muted">Restocked {formatDate(i.lastRestocked)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (i) => (
        <div className="flex justify-end gap-1">
          <button type="button" className={iconButton} onClick={() => onMove({ item: i, direction: 'in' })} aria-label={`Stock in ${i.name}`} title="Stock in">
            <ArrowDownToLine className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(iconButton, 'disabled:cursor-not-allowed disabled:opacity-40')}
            onClick={() => onMove({ item: i, direction: 'out' })}
            disabled={i.quantity === 0}
            aria-label={`Stock out ${i.name}`}
            title="Stock out"
          >
            <ArrowUpFromLine className="size-4" aria-hidden />
          </button>
          <button type="button" className={iconButton} onClick={() => setHistory(i)} aria-label={`Stock history of ${i.name}`} title="History">
            <History className="size-4" aria-hidden />
          </button>
          {canManage && (
            <>
              <button type="button" className={iconButton} onClick={() => onEdit(i)} aria-label={`Edit ${i.name}`} title="Edit">
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setDeleting(i)} aria-label={`Delete ${i.name}`} title="Delete">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label="Search inventory" placeholder="Item, supplier or ID…" value={params.search} onSearch={(search) => update({ search })} className="sm:w-64" />
        <FilterSelect
          label="Filter by category"
          allLabel="All categories"
          value={query.category ?? ''}
          options={INVENTORY_CATEGORIES.map((c) => ({ value: c, label: enumLabel(c) }))}
          onChange={(value) => update({ filters: { category: value } })}
        />
        <FilterSelect
          label="Filter by stock level"
          allLabel="All stock levels"
          value={query.stock ?? ''}
          options={[
            { value: 'LOW', label: 'Low stock' },
            { value: 'OUT', label: 'Out of stock' },
          ]}
          onChange={(value) => update({ filters: { stock: value } })}
        />
        {query.supplier && (
          <Badge tone="brand">
            Supplier: {query.supplier}
          </Badge>
        )}
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
            Clear filters
          </Button>
        )}
      </div>
      {items.isPending ? (
        <div className="px-5 pb-5">
          <LoadingState label="Loading inventory" rows={8} />
        </div>
      ) : items.isError ? (
        <ErrorState message={items.error.message} onRetry={() => void items.refetch()} retrying={items.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Inventory"
            columns={columns}
            rows={items.data.content}
            rowKey={(i) => i.id}
            sort={params.sort}
            onSortChange={(sort) => update({ sort: sort as InventoryListQuery['sort'] | null })}
            busy={items.isPlaceholderData}
            emptyTitle={filtersActive ? 'No items match your filters' : 'No inventory items yet'}
          />
          <Pagination
            className="border-t border-line"
            page={items.data.page}
            size={items.data.size}
            totalElements={items.data.totalElements}
            totalPages={items.data.totalPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
      <MovementHistoryDialog item={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete item?'}
        message={
          <>
            <p>This removes the item from inventory permanently.</p>
            <p className="mt-2 text-xs text-ink-subtle">Only items with no stock on hand and no movement history can be deleted.</p>
          </>
        }
        confirmLabel="Delete item"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting, { onError: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function SuppliersTab({ onShowItems }: { onShowItems: (supplier: string) => void }) {
  const suppliers = useSuppliers()
  if (suppliers.isPending) {
    return (
      <div className="p-5">
        <LoadingState label="Loading suppliers" rows={6} />
      </div>
    )
  }
  if (suppliers.isError) return <ErrorState message={suppliers.error.message} onRetry={() => void suppliers.refetch()} retrying={suppliers.isFetching} />

  const columns: Column<SupplierView>[] = [
    {
      key: 'name',
      header: 'Supplier',
      render: (s) => (
        <div>
          <span className="font-medium">{s.name}</span>
          <p className="text-xs text-ink-muted">{s.categories.map(enumLabel).join(', ')}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (s) => (
        <div>
          <span>{s.contactPerson}</span>
          <p className="text-xs">
            <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
              {s.phone}
            </a>
          </p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      hideOnMobile: true,
      render: (s) => (
        <a href={`mailto:${s.email}`} className="text-brand-700 hover:underline">
          {s.email}
        </a>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      render: (s) => (
        <button type="button" onClick={() => onShowItems(s.name)} className="font-medium text-brand-700 hover:underline" aria-label={`Show ${s.itemCount} items from ${s.name}`}>
          {s.itemCount}
        </button>
      ),
    },
    {
      key: 'low',
      header: 'To reorder',
      align: 'right',
      render: (s) => (s.lowCount > 0 ? <Badge tone="warning">{s.lowCount}</Badge> : <span className="text-ink-subtle">0</span>),
    },
  ]
  return (
    <>
      <p className="px-5 pt-4 pb-2 text-xs text-ink-muted">Suppliers come from item records; edit an item to change its supplier details.</p>
      <DataTable caption="Suppliers" columns={columns} rows={suppliers.data} rowKey={(s) => s.name} emptyTitle="No suppliers yet" />
    </>
  )
}
