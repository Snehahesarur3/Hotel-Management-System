import { useQueryClient } from '@tanstack/react-query'
import { BedDouble, CalendarRange, CreditCard, IndianRupee, RefreshCw, Users } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/common/PageHeader'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { Tabs, type TabItem } from '@/components/common/Tabs'
import { GuestReportView } from '@/components/reports/GuestReportView'
import { OccupancyReportView } from '@/components/reports/OccupancyReportView'
import { PaymentReportView } from '@/components/reports/PaymentReportView'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { ReservationReportView } from '@/components/reports/ReservationReportView'
import { RevenueReportView } from '@/components/reports/RevenueReportView'
import { reportKeys } from '@/hooks/useReports'
import { MAX_DAILY_DAYS, rangeDays, reportRangeSchema } from '@/schemas/reports'
import { REPORT_GROUPINGS, type ReportGrouping, type ReportRange } from '@/types/reports'
import { todayISO } from '@/utils/date'
import { DEFAULT_RANGE_PRESET, presetRange } from '@/utils/dateRange'

const TABS = [
  { key: 'revenue', label: 'Revenue', icon: IndianRupee },
  { key: 'occupancy', label: 'Occupancy', icon: BedDouble },
  { key: 'reservations', label: 'Reservations', icon: CalendarRange },
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'payments', label: 'Payments', icon: CreditCard },
] as const satisfies ReadonlyArray<TabItem<string>>
type ReportTab = (typeof TABS)[number]['key']

const GROUPING_LABELS: Record<ReportGrouping, string> = { DAY: 'Daily', MONTH: 'Monthly', YEAR: 'Yearly' }

/**
 * Reports & Analytics. The report, date range and revenue grouping live in the URL
 * (?tab=revenue&from=2026-10-13&to=2026-11-11&group=MONTH), so any view can be bookmarked or shared.
 * Invalid or missing values fall back to the last 30 days.
 */
export function ReportsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayISO()

  const tab: ReportTab = TABS.find((t) => t.key === searchParams.get('tab'))?.key ?? 'revenue'
  const range = useMemo<ReportRange>(() => {
    const parsed = reportRangeSchema.safeParse({ from: searchParams.get('from'), to: searchParams.get('to') })
    return parsed.success ? parsed.data : presetRange(DEFAULT_RANGE_PRESET, today)
  }, [searchParams, today])
  const requestedGroup = REPORT_GROUPINGS.find((g) => g === searchParams.get('group')) ?? 'DAY'
  const dailyAllowed = rangeDays(range) <= MAX_DAILY_DAYS
  const groupBy: ReportGrouping = requestedGroup === 'DAY' && !dailyAllowed ? 'MONTH' : requestedGroup
  const revenueQuery = useMemo(() => ({ ...range, groupBy }), [range, groupBy])

  const update = useCallback(
    (changes: Record<string, string>) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) next.set(key, value)
          return next
        },
        { replace: true },
      ),
    [setSearchParams],
  )

  // Only the visible report is fetched; the header's Refresh spinner follows it.
  const refreshing = queryClient.isFetching({ queryKey: reportKeys.all }) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Revenue, occupancy, reservation, guest and payment reports, calculated from live data for the dates you choose."
        actions={
          <Button
            variant="secondary"
            onClick={() => void queryClient.invalidateQueries({ queryKey: reportKeys.all })}
            loading={refreshing}
            icon={<RefreshCw className="size-4" aria-hidden />}
          >
            Refresh
          </Button>
        }
      />

      <ReportFilters range={range} today={today} onChange={(r) => update({ from: r.from, to: r.to })}>
        {tab === 'revenue' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink" aria-hidden>
              Group revenue by
            </span>
            <SegmentedControl
              label="Group revenue by"
              value={groupBy}
              onChange={(g) => update({ group: g })}
              options={REPORT_GROUPINGS.map((g) => ({
                value: g,
                label: GROUPING_LABELS[g],
                disabled: g === 'DAY' && !dailyAllowed,
                title: g === 'DAY' && !dailyAllowed ? `Daily figures cover at most ${MAX_DAILY_DAYS} days` : undefined,
              }))}
            />
          </div>
        )}
      </ReportFilters>

      <Tabs label="Reports" idPrefix="reports" tabs={TABS} value={tab} onChange={(key) => update({ tab: key })}>
        <div className="pt-6">
          {tab === 'revenue' && <RevenueReportView query={revenueQuery} />}
          {tab === 'occupancy' && <OccupancyReportView range={range} />}
          {tab === 'reservations' && <ReservationReportView range={range} />}
          {tab === 'guests' && <GuestReportView range={range} />}
          {tab === 'payments' && <PaymentReportView range={range} />}
        </div>
      </Tabs>
    </div>
  )
}
