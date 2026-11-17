import { beforeEach, describe, expect, it } from 'vitest'
import { mockBillingService } from '@/mock/services/billing'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { ApiError } from '@/types/api'
import { addDays, todayISO } from '@/utils/date'
import { mockReportService as reports } from './reports'

const TODAY = todayISO()
const LAST_30 = { from: addDays(TODAY, -29), to: TODAY }

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected the call to fail')
}

describe('report service', () => {
  it('rejects invalid ranges with field errors', async () => {
    const reversed = await rejection(reports.payments({ from: TODAY, to: addDays(TODAY, -1) }))
    expect(reversed.status).toBe(400)
    expect(reversed.fieldErrors).toEqual({ to: 'The end date must be on or after the start date' })

    const tooLong = await rejection(reports.occupancy({ from: '2024-01-01', to: '2026-01-01' }))
    expect(tooLong.fieldErrors).toEqual({ to: 'Reports cover at most 731 days' })

    const notADate = await rejection(reports.guests({ from: '2026-02-30', to: '2026-03-01' }))
    expect(notADate.fieldErrors).toEqual({ from: 'Choose a valid start date' })

    const daily = await rejection(reports.revenue({ from: '2026-01-01', to: '2026-06-30', groupBy: 'DAY' }))
    expect(daily.fieldErrors).toEqual({ groupBy: 'Daily breakdowns cover at most 93 days' })
  })

  it('reflects new payments immediately', async () => {
    const before = await reports.revenue({ ...LAST_30, groupBy: 'DAY' })
    const due = getDatabase().reservations.find((r) => r.status === 'CHECKED_IN')!
    const invoice = await mockBillingService.invoice(due.id)
    await mockBillingService.recordPayment(due.id, { amount: Math.min(1000, invoice.balance), method: 'CASH' })
    const after = await reports.revenue({ ...LAST_30, groupBy: 'DAY' })
    expect(after.totals.net).toBe(before.totals.net + Math.min(1000, invoice.balance))
    expect(after.periods.at(-1)!.transactions).toBe(before.periods.at(-1)!.transactions + 1)
  })
})
