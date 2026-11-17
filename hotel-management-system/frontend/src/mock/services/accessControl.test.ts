import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/api'
import { resetDatabase } from '@/mock/db'
import { signInAs, signOut } from '@/test/auth'
import { ApiError } from '@/types/api'
import { ACCESS_RULES, FORBIDDEN_MESSAGE, UNAUTHENTICATED_MESSAGE } from './accessControl'
import { INVALID_CREDENTIALS_MESSAGE, mockAuthService } from './auth'
import { mockServices } from './index'

async function failure(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call()
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Expected the call to fail')
}

beforeEach(() => {
  resetDatabase()
})

describe('mock access control', () => {
  it('has a rule for every guarded service method', () => {
    for (const [moduleName, rules] of Object.entries(ACCESS_RULES)) {
      const methods = Object.keys(mockServices[moduleName as keyof typeof ACCESS_RULES]).sort()
      expect(Object.keys(rules).sort(), moduleName).toEqual(methods)
    }
  })

  it('answers 401 when nobody is signed in, like the API', async () => {
    signOut()
    const error = await failure(() => api.rooms.list())
    expect(error).toMatchObject({ status: 401, message: UNAUTHENTICATED_MESSAGE })
    // Health stays public.
    await expect(api.system.health()).resolves.toMatchObject({ status: 'UP' })
  })

  it('answers 403 outside the role and lets permitted calls through', async () => {
    signInAs('HOUSEKEEPING')
    expect(await failure(() => api.reports.revenue({ from: '2026-01-01', to: '2026-01-31', groupBy: 'DAY' }))).toMatchObject({
      status: 403,
      message: FORBIDDEN_MESSAGE,
    })
    expect(await failure(() => api.guests.list())).toMatchObject({ status: 403 })
    await expect(api.housekeeping.list()).resolves.toHaveProperty('content')
    await expect(api.inventory.summary()).resolves.toHaveProperty('totalItems')
  })

  it('checks discounts by the request body', async () => {
    signInAs('RECEPTIONIST')
    const invoices = await api.billing.invoices({ size: 100 })
    const editable = invoices.content.find((i) => i.state === 'INTERIM')!
    expect(
      await failure(() => api.billing.addAdjustment(editable.reservationId, { kind: 'DISCOUNT', description: 'Loyalty', percent: 10 })),
    ).toMatchObject({ status: 403 })
    await expect(
      api.billing.addAdjustment(editable.reservationId, { kind: 'EXTRA', description: 'Airport pickup', amount: 1200, gstPercent: 18 }),
    ).resolves.toHaveProperty('reservationId', editable.reservationId)

    signInAs('MANAGER')
    await expect(
      api.billing.addAdjustment(editable.reservationId, { kind: 'DISCOUNT', description: 'Loyalty', percent: 10 }),
    ).resolves.toHaveProperty('reservationId', editable.reservationId)
  })
})

describe('mock sign-in', () => {
  it('accepts the demo accounts, case-insensitively, without returning a credential', async () => {
    await expect(mockAuthService.signIn(' Reception ', 'reception123')).resolves.toEqual({
      user: { username: 'reception', roles: ['RECEPTIONIST'] },
      authorization: null,
    })
  })

  it('rejects a wrong password or unknown user with the same message', async () => {
    expect(await failure(() => mockAuthService.signIn('admin', 'nope'))).toMatchObject({ status: 401, message: INVALID_CREDENTIALS_MESSAGE })
    expect(await failure(() => mockAuthService.signIn('ghost', 'admin123'))).toMatchObject({ status: 401, message: INVALID_CREDENTIALS_MESSAGE })
  })
})
