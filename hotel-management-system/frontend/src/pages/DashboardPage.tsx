import { useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryState } from '@/components/common/QueryState'
import { Skeleton } from '@/components/common/States'
import { BookingSourcesChart } from '@/components/dashboard/BookingSourcesChart'
import { HousekeepingStatusCard } from '@/components/dashboard/HousekeepingStatusCard'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { OccupancyTrendChart } from '@/components/dashboard/OccupancyTrendChart'
import { RecentReservationsTable } from '@/components/dashboard/RecentReservationsTable'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { RoomTypeDistribution } from '@/components/dashboard/RoomTypeDistribution'
import { StayList } from '@/components/dashboard/StayList'
import { dashboardKeys, useDashboardSummary, useOccupancySeries, useRevenueSeries } from '@/hooks/useDashboard'
import type { DashboardSummary } from '@/types/dashboard'
import { formatDate, formatMonth, formatShortDate, formatWeekday } from '@/utils/format'
import { cn } from '@/utils/cn'

function CardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <Card className="p-5" aria-hidden>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className={cn('mt-5 w-full', height)} />
    </Card>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading key figures">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />
      ))}
    </div>
  )
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const summary = useDashboardSummary()
  const revenue = useRevenueSeries()
  const occupancy = useOccupancySeries()
  const refreshing = summary.isFetching || revenue.isFetching || occupancy.isFetching

  /**
   * Sections fed by the summary query. Its error (with retry) is shown once, in the KPI area;
   * dependent sections show skeletons while loading and stay hidden on error.
   */
  const fromSummary = (render: (data: DashboardSummary) => ReactNode, skeleton: ReactNode = <CardSkeleton />) => {
    if (summary.isPending) return skeleton
    if (summary.isError) return null
    return render(summary.data)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={summary.data ? `Hotel performance as of ${formatDate(summary.data.asOf)}` : 'Hotel performance overview'}
        actions={
          <Button
            variant="secondary"
            onClick={() => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })}
            loading={refreshing}
            icon={<RefreshCw className="size-4" aria-hidden />}
          >
            Refresh
          </Button>
        }
      />

      {summary.isError ? (
        <Card>
          <QueryState query={summary}>{() => null}</QueryState>
        </Card>
      ) : (
        fromSummary((data) => <KpiGrid kpis={data.kpis} />, <KpiSkeleton />)
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QueryState query={revenue} loading={<CardSkeleton height="h-56" />}>
          {(data) => (
            <RevenueChart
              title="Weekly revenue"
              points={data.daily}
              axisLabel={formatWeekday}
              fullLabel={(d) => `${formatWeekday(d)}, ${formatShortDate(d)}`}
            />
          )}
        </QueryState>
        {/* Errors of the shared revenue query are reported once, by the weekly card. */}
        {!revenue.isError && (
          <QueryState query={revenue} loading={<CardSkeleton height="h-56" />}>
            {(data) => (
              <RevenueChart
                title="Monthly revenue"
                points={data.monthly}
                axisLabel={(m) => formatMonth(m)}
                fullLabel={(m) => formatMonth(m, { withYear: true })}
              />
            )}
          </QueryState>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={cn('min-w-0', !summary.isError && 'xl:col-span-2', summary.isError && 'xl:col-span-3')}>
          {occupancy.isError ? (
            <Card>
              <QueryState query={occupancy}>{() => null}</QueryState>
            </Card>
          ) : (
            <QueryState query={occupancy} loading={<CardSkeleton />}>
              {(data) => <OccupancyTrendChart nights={data.nights} />}
            </QueryState>
          )}
        </div>
        {fromSummary((data) => <RoomTypeDistribution roomTypes={data.roomTypes} />)}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {fromSummary((data) => <BookingSourcesChart sources={data.bookingSources} />)}
        {fromSummary((data) => <HousekeepingStatusCard housekeeping={data.housekeeping} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {fromSummary(
          (data) => (
            <StayList
              title="Today’s check-ins"
              subtitle={`${data.todaysCheckIns.length} arrivals today`}
              stays={data.todaysCheckIns}
              emptyTitle="No arrivals today"
              emptyIcon={LogIn}
            />
          ),
          <CardSkeleton height="h-40" />,
        )}
        {fromSummary(
          (data) => (
            <StayList
              title="Today’s check-outs"
              subtitle={`${data.todaysCheckOuts.length} departures today`}
              stays={data.todaysCheckOuts}
              emptyTitle="No departures today"
              emptyIcon={LogOut}
            />
          ),
          <CardSkeleton height="h-40" />,
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {fromSummary((data) => <RecentReservationsTable reservations={data.recentReservations} />)}
        </div>
        {fromSummary((data) => <RecentTransactions transactions={data.recentTransactions} />)}
      </div>
    </div>
  )
}
