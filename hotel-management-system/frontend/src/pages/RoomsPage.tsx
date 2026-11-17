import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DeleteRoomDialog } from '@/components/rooms/DeleteRoomDialog'
import { RoomFormModal } from '@/components/rooms/RoomFormModal'
import { useListParams } from '@/hooks/useListParams'
import { useRoomFloors, useRoomList } from '@/hooks/useRooms'
import type { Room } from '@/types/domain'
import { ROOM_STATUSES, ROOM_TYPES, type RoomStatus, type RoomType } from '@/types/enums'
import type { RoomListQuery, RoomSortField } from '@/types/room'
import { enumLabel, formatCurrency } from '@/utils/format'

const FILTER_KEYS = ['floor', 'type', 'status'] as const
const SORT_FIELDS: readonly RoomSortField[] = ['roomNumber', 'floor', 'type', 'capacity', 'pricePerNight', 'status']
const PAGE_SIZE = 15

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

export function RoomsPage() {
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  const can = useCan()
  const canManage = can('rooms.manage')
  const { floor, type, status } = params.filters
  const query: RoomListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    floor: floor ? Number(floor) : undefined,
    type: (ROOM_TYPES as readonly string[]).includes(type ?? '') ? (type as RoomType) : undefined,
    status: (ROOM_STATUSES as readonly string[]).includes(status ?? '') ? (status as RoomStatus) : undefined,
  }
  const rooms = useRoomList(query)
  const floors = useRoomFloors()

  const [formRoom, setFormRoom] = useState<Room | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)
  const filtersActive = Boolean(params.search || floor || type || status)

  // If the current page disappeared (e.g. after a delete or narrower filter), go to the last one.
  const lastPage = rooms.data && rooms.data.totalPages > 0 ? rooms.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(rooms.data && !rooms.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const columns: Column<Room>[] = [
    {
      key: 'room',
      header: 'Room',
      sortField: 'roomNumber',
      render: (r) => (
        <Link to={`/rooms/${r.id}`} className="font-semibold text-brand-700 hover:underline">
          {r.roomNumber}
        </Link>
      ),
    },
    { key: 'type', header: 'Type', sortField: 'type', render: (r) => enumLabel(r.type) },
    { key: 'floor', header: 'Floor', sortField: 'floor', align: 'right', hideOnMobile: true, render: (r) => r.floor },
    { key: 'capacity', header: 'Guests', sortField: 'capacity', align: 'right', hideOnMobile: true, render: (r) => r.capacity },
    {
      key: 'price',
      header: 'Price / night',
      sortField: 'pricePerNight',
      align: 'right',
      render: (r) => formatCurrency(r.pricePerNight, { whole: true }),
    },
    {
      key: 'amenities',
      header: 'Amenities',
      hideOnMobile: true,
      render: (r) => (
        <span className="text-ink-muted" title={r.amenities.join(', ')}>
          {r.amenities.slice(0, 2).join(', ')}
          {r.amenities.length > 2 && <span className="text-ink-subtle"> +{r.amenities.length - 2}</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortField: 'status', render: (r) => <StatusBadge kind="room" status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canManage,
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button type="button" className={iconButton} onClick={() => setFormRoom(r)} aria-label={`Edit room ${r.roomNumber}`}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${iconButton} hover:text-danger`}
            onClick={() => setDeleting(r)}
            aria-label={`Delete room ${r.roomNumber}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Room inventory, tariffs, amenities and status."
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setFormRoom('new')}>
              Add room
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            label="Search rooms"
            placeholder="Search number, type, amenity…"
            value={params.search}
            onSearch={(search) => update({ search })}
            className="sm:w-72"
          />
          <FilterSelect
            label="Filter by floor"
            allLabel="All floors"
            value={floor ?? ''}
            options={(floors.data ?? []).map((f) => ({ value: String(f), label: `Floor ${f}` }))}
            onChange={(value) => update({ filters: { floor: value } })}
            className="sm:w-36"
          />
          <FilterSelect
            label="Filter by room type"
            allLabel="All types"
            value={query.type ?? ''}
            options={ROOM_TYPES.map((t) => ({ value: t, label: enumLabel(t) }))}
            onChange={(value) => update({ filters: { type: value } })}
          />
          <FilterSelect
            label="Filter by availability"
            allLabel="Any status"
            value={query.status ?? ''}
            options={ROOM_STATUSES.map((s) => ({ value: s, label: enumLabel(s) }))}
            onChange={(value) => update({ filters: { status: value } })}
          />
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
              Clear filters
            </Button>
          )}
        </div>

        {rooms.isPending ? (
          <div className="px-5 pb-5">
            <LoadingState label="Loading rooms" rows={8} />
          </div>
        ) : rooms.isError ? (
          <ErrorState message={rooms.error.message} onRetry={() => void rooms.refetch()} retrying={rooms.isFetching} />
        ) : (
          <>
            <DataTable
              caption="Rooms"
              columns={columns}
              rows={rooms.data.content}
              rowKey={(r) => r.id}
              sort={params.sort}
              onSortChange={(sort) => update({ sort: sort as RoomListQuery['sort'] | null })}
              busy={rooms.isPlaceholderData}
              emptyTitle={filtersActive ? 'No rooms match your filters' : 'No rooms yet'}
              emptyDescription={filtersActive ? 'Try a different search or clear the filters.' : 'Add the first room to get started.'}
              emptyAction={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  canManage && (
                    <Button size="sm" onClick={() => setFormRoom('new')}>
                      Add room
                    </Button>
                  )
                )
              }
            />
            <Pagination
              className="border-t border-line"
              page={rooms.data.page}
              size={rooms.data.size}
              totalElements={rooms.data.totalElements}
              totalPages={rooms.data.totalPages}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Card>

      <RoomFormModal open={formRoom !== null} room={formRoom === 'new' ? undefined : (formRoom ?? undefined)} onClose={() => setFormRoom(null)} />
      <DeleteRoomDialog room={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
