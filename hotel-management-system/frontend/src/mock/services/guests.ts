import type { GuestService } from '@/api/types'
import { applyListQuery, collection } from '@/mock/collection'
import { completedRevenue, nightsOf, toReservationSummary } from '@/mock/calculations/dashboard'
import { getDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { guestInputSchema, maskIdNumber } from '@/schemas/guest'
import { ApiError } from '@/types/api'
import type { Guest } from '@/types/domain'
import type { GuestHistory, GuestInput, GuestListQuery, GuestSummary } from '@/types/guest'
import { todayISO } from '@/utils/date'

/**
 * Mock implementation of /api/guests.
 * - Identity numbers are masked before storage (only the last 4 characters are kept).
 * - Email addresses are unique (case-insensitive).
 * - previousBookingCount / lastStay are derived from reservations, never stored.
 * - Guests with reservations cannot be deleted, so booking history stays intact.
 */
const guests = collection('guests', { resource: 'Guest', idPrefix: 'GST' })
const createSchema = guestInputSchema({ requireIdNumber: true })
const updateSchema = guestInputSchema({ requireIdNumber: false })

function summarize(db: MockDatabase, guest: Guest): GuestSummary {
  const stays = db.reservations.filter((r) => r.guestId === guest.id)
  const lastStay = stays
    .filter((r) => r.status !== 'CANCELLED')
    .map((r) => r.checkIn)
    .sort()
    .at(-1)
  return {
    ...guest,
    previousBookingCount: stays.filter((r) => r.status === 'CHECKED_OUT').length,
    lastStay: lastStay ?? null,
  }
}

function assertEmailAvailable(email: string, exceptId?: string) {
  const clash = guests.all().find((g) => g.email.toLowerCase() === email.toLowerCase() && g.id !== exceptId)
  if (clash) {
    const message = `This email is already registered to ${clash.fullName}`
    throw new ApiError(409, message, { email: message })
  }
}

function list(query: GuestListQuery = {}) {
  const db = getDatabase()
  const nationality = query.nationality?.toLowerCase()
  return applyListQuery(
    db.guests.map((g) => summarize(db, g)),
    query,
    {
      searchFields: (g) => [g.fullName, g.email, g.phone, g.id, g.nationality, g.address],
      filter: (g) => !nationality || g.nationality.toLowerCase() === nationality,
      defaultSort: (a, b) => a.fullName.localeCompare(b.fullName),
    },
  )
}

function history(id: string): GuestHistory {
  guests.get(id)
  const db = getDatabase()
  const today = todayISO()
  const reservations = db.reservations.filter((r) => r.guestId === id)
  const reservationIds = new Set(reservations.map((r) => r.id))
  const completed = reservations.filter((r) => r.status === 'CHECKED_OUT')
  return {
    stats: {
      totalReservations: reservations.length,
      completedStays: completed.length,
      upcomingStays: reservations.filter((r) => (r.status === 'CONFIRMED' || r.status === 'PENDING') && r.checkIn >= today).length,
      cancelled: reservations.filter((r) => r.status === 'CANCELLED').length,
      nightsStayed: completed.reduce((sum, r) => sum + nightsOf(r), 0),
      totalSpent: completedRevenue(db.payments, (p) => reservationIds.has(p.reservationId)),
    },
    reservations: [...reservations]
      // Most recent check-in first; same-day stays ordered by booking time, newest first.
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn) || b.createdAt.localeCompare(a.createdAt))
      .map((r) => toReservationSummary(db, r)),
  }
}

function create(raw: GuestInput): GuestSummary {
  const { idProofNumber, ...input } = parseOrThrow(createSchema, raw)
  assertEmailAvailable(input.email)
  const created = guests.insert({
    ...input,
    idProofNumber: maskIdNumber(input.idProofType, idProofNumber),
    registrationDate: todayISO(),
  })
  return summarize(getDatabase(), created)
}

function update(id: string, raw: GuestInput): GuestSummary {
  const existing = guests.get(id)
  const { idProofNumber, ...input } = parseOrThrow(updateSchema, raw)
  assertEmailAvailable(input.email, id)
  if (!idProofNumber && input.idProofType !== existing.idProofType) {
    const message = 'Enter the number of the new ID document'
    throw new ApiError(400, 'Validation failed', { idProofNumber: message })
  }
  const updated = guests.update(id, {
    ...input,
    idProofNumber: idProofNumber ? maskIdNumber(input.idProofType, idProofNumber) : existing.idProofNumber,
  })
  return summarize(getDatabase(), updated)
}

function remove(id: string): void {
  const guest = guests.get(id)
  const count = getDatabase().reservations.filter((r) => r.guestId === id).length
  if (count > 0) {
    throw new ApiError(
      409,
      `${guest.fullName} has ${count} reservation${count > 1 ? 's' : ''} and cannot be deleted. Guest records with booking history are kept.`,
    )
  }
  guests.remove(id)
}

export const mockGuestService: GuestService = {
  list: (query) => mockCall(() => list(query)),
  get: (id) => mockCall(() => summarize(getDatabase(), guests.get(id))),
  nationalities: () => mockCall(() => [...new Set(guests.all().map((g) => g.nationality))].sort()),
  history: (id) => mockCall(() => history(id)),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  remove: (id) => mockCall(() => remove(id)),
}
