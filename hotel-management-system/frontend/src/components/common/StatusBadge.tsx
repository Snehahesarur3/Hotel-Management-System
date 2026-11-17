import {
  Ban,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  Clock,
  DoorOpen,
  LogIn,
  LogOut,
  RotateCcw,
  Sparkles,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type {
  BookingStatus,
  EmploymentStatus,
  HousekeepingStatus,
  OrderStatus,
  PaymentStatus,
  RoomStatus,
} from '@/types/enums'
import { enumLabel } from '@/utils/format'
import { Badge, type BadgeTone } from './Badge'

type Style = { tone: BadgeTone; icon: LucideIcon }

/** Status -> tone + icon. Colour never carries meaning alone: every badge shows an icon and a label. */
const STYLES = {
  room: {
    AVAILABLE: { tone: 'success', icon: DoorOpen },
    OCCUPIED: { tone: 'info', icon: BedDouble },
    RESERVED: { tone: 'brand', icon: CalendarCheck },
    CLEANING: { tone: 'warning', icon: Sparkles },
    MAINTENANCE: { tone: 'danger', icon: Wrench },
  } satisfies Record<RoomStatus, Style>,
  booking: {
    PENDING: { tone: 'warning', icon: Clock },
    CONFIRMED: { tone: 'brand', icon: CalendarCheck },
    CHECKED_IN: { tone: 'success', icon: LogIn },
    CHECKED_OUT: { tone: 'neutral', icon: LogOut },
    CANCELLED: { tone: 'danger', icon: Ban },
  } satisfies Record<BookingStatus, Style>,
  payment: {
    PENDING: { tone: 'warning', icon: Clock },
    COMPLETED: { tone: 'success', icon: CheckCircle2 },
    FAILED: { tone: 'danger', icon: XCircle },
    REFUNDED: { tone: 'neutral', icon: RotateCcw },
  } satisfies Record<PaymentStatus, Style>,
  housekeeping: {
    PENDING: { tone: 'warning', icon: Clock },
    IN_PROGRESS: { tone: 'info', icon: CircleDashed },
    COMPLETED: { tone: 'success', icon: CheckCircle2 },
  } satisfies Record<HousekeepingStatus, Style>,
  order: {
    PLACED: { tone: 'neutral', icon: Clock },
    PREPARING: { tone: 'warning', icon: CircleDashed },
    SERVED: { tone: 'success', icon: CheckCircle2 },
    DELIVERED: { tone: 'success', icon: CheckCircle2 },
    CANCELLED: { tone: 'danger', icon: Ban },
  } satisfies Record<OrderStatus, Style>,
  employment: {
    ACTIVE: { tone: 'success', icon: CheckCircle2 },
    ON_LEAVE: { tone: 'warning', icon: Clock },
    INACTIVE: { tone: 'neutral', icon: Ban },
  } satisfies Record<EmploymentStatus, Style>,
} as const

type StatusKinds = typeof STYLES
export type StatusKind = keyof StatusKinds

interface StatusBadgeProps<K extends StatusKind> {
  kind: K
  status: keyof StatusKinds[K] & string
}

export function StatusBadge<K extends StatusKind>({ kind, status }: StatusBadgeProps<K>) {
  const style = (STYLES[kind] as Record<string, Style>)[status] ?? { tone: 'neutral', icon: CircleDashed }
  const Icon = style.icon
  return (
    <Badge tone={style.tone} icon={<Icon className="size-3" aria-hidden />}>
      {enumLabel(status)}
    </Badge>
  )
}
