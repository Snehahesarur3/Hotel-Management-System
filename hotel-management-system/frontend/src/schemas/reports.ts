import { z } from 'zod'
import { REPORT_GROUPINGS, type ReportRange } from '@/types/reports'
import { diffDays } from '@/utils/date'

/** Longest range any report covers (two years). */
export const MAX_REPORT_DAYS = 731
/** Longest range that can be broken down day by day. */
export const MAX_DAILY_DAYS = 93

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date in yyyy-MM-dd form (rejects 2026-02-30). */
const isoDate = (label: string) =>
  z
    .string({ error: `Choose the ${label}` })
    .regex(ISO_DATE, `Choose the ${label}`)
    .refine((value) => {
      const [y, m, d] = value.split('-').map(Number)
      const date = new Date(Date.UTC(y!, m! - 1, d!))
      return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
    }, `Choose a valid ${label}`)

/** Days covered by an inclusive range. */
export const rangeDays = (range: ReportRange) => diffDays(range.from, range.to) + 1

const rangeShape = { from: isoDate('start date'), to: isoDate('end date') }

function checkRange(range: ReportRange, ctx: z.RefinementCtx) {
  if (!ISO_DATE.test(range.from) || !ISO_DATE.test(range.to)) return
  if (range.to < range.from) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end date must be on or after the start date' })
  } else if (rangeDays(range) > MAX_REPORT_DAYS) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: `Reports cover at most ${MAX_REPORT_DAYS} days` })
  }
}

/** Date range of every report. Shared by the filter form and the mock service. */
export const reportRangeSchema = z.object(rangeShape).superRefine(checkRange)

export const revenueReportQuerySchema = z
  .object({ ...rangeShape, groupBy: z.enum(REPORT_GROUPINGS, { error: 'Choose daily, monthly or yearly' }) })
  .superRefine((query, ctx) => {
    checkRange(query, ctx)
    if (query.groupBy === 'DAY' && ISO_DATE.test(query.from) && ISO_DATE.test(query.to) && rangeDays(query) > MAX_DAILY_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['groupBy'], message: `Daily breakdowns cover at most ${MAX_DAILY_DAYS} days` })
    }
  })

export type ReportRangeFormValues = z.input<typeof reportRangeSchema>
