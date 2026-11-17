import {
  BedDouble,
  Building2,
  CalendarCheck,
  DoorOpen,
  IndianRupee,
  LogIn,
  LogOut,
  Percent,
} from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import type { DashboardKpis } from '@/types/dashboard'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format'

export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total rooms"
        value={formatNumber(kpis.totalRooms)}
        icon={Building2}
        hint={`${kpis.cleaningRooms} cleaning · ${kpis.maintenanceRooms} maintenance`}
      />
      <StatCard label="Available rooms" value={formatNumber(kpis.availableRooms)} icon={DoorOpen} hint="Ready to sell tonight" />
      <StatCard label="Occupied rooms" value={formatNumber(kpis.occupiedRooms)} icon={BedDouble} hint="Guests in-house" />
      <StatCard label="Reserved rooms" value={formatNumber(kpis.reservedRooms)} icon={CalendarCheck} hint="Held for today’s arrivals" />
      <StatCard label="Today’s check-ins" value={formatNumber(kpis.todaysCheckIns)} icon={LogIn} hint="Expected and arrived" />
      <StatCard label="Today’s check-outs" value={formatNumber(kpis.todaysCheckOuts)} icon={LogOut} hint="Due and departed" />
      <StatCard
        label="Total revenue"
        value={formatCurrency(kpis.totalRevenue, { whole: true })}
        icon={IndianRupee}
        hint={`${formatCurrency(kpis.revenueThisMonth, { whole: true })} this month`}
      />
      <StatCard
        label="Occupancy rate"
        value={formatPercent(kpis.occupancyRate)}
        icon={Percent}
        meter={kpis.occupancyRate}
        hint={`${kpis.occupiedRooms} of ${kpis.totalRooms} rooms occupied`}
      />
    </div>
  )
}
