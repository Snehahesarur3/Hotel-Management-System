import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { basicAuthorization, sessionStore } from '@/auth/session'
import { httpClient } from './client'
import { httpServices } from './index'

/** Replaces the network with a function of the request, recording what was sent. */
let sent: InternalAxiosRequestConfig[] = []
const originalAdapter = httpClient.defaults.adapter

function respond(handler: (config: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config)
    const { status, data } = handler(config)
    const response = { status, statusText: String(status), data, headers: {}, config }
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response)
    return response
  }
  httpClient.defaults.adapter = adapter
}

const ADMIN = basicAuthorization('admin', 'admin123')

beforeEach(() => {
  sent = []
})

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter
})

describe('HTTP authentication', () => {
  it('signs in with HTTP Basic against /auth/me', async () => {
    sessionStore.end('signed-out')
    respond(() => ({ status: 200, data: { username: 'admin', roles: ['ADMIN'] } }))
    const session = await httpServices.auth.signIn(' admin ', 'admin123')
    expect(session).toEqual({ user: { username: 'admin', roles: ['ADMIN'] }, authorization: ADMIN })
    expect(sent[0]!.url).toBe('/auth/me')
    expect(AxiosHeaders.from(sent[0]!.headers).get('Authorization')).toBe(ADMIN)
  })

  it('reports wrong credentials clearly', async () => {
    sessionStore.end('signed-out')
    respond(() => ({ status: 401, data: { status: 401, message: 'Authentication required' } }))
    await expect(httpServices.auth.signIn('admin', 'nope')).rejects.toMatchObject({ status: 401, message: 'Incorrect username or password' })
  })

  it('sends the session credentials with every request', async () => {
    sessionStore.start({ user: { username: 'admin', roles: ['ADMIN'] }, authorization: ADMIN })
    respond(() => ({ status: 200, data: [1, 2, 3] }))
    await httpServices.rooms.floors()
    expect(AxiosHeaders.from(sent[0]!.headers).get('Authorization')).toBe(ADMIN)
  })

  it('ends the session when the API rejects its credentials', async () => {
    sessionStore.start({ user: { username: 'admin', roles: ['ADMIN'] }, authorization: ADMIN })
    respond(() => ({ status: 401, data: { status: 401, message: 'Authentication required' } }))
    await expect(httpServices.rooms.floors()).rejects.toMatchObject({ status: 401 })
    expect(sessionStore.get()).toBeNull()
    expect(sessionStore.lastSignOutReason()).toBe('expired')
  })

  it('keeps the session on 403 and passes the message on', async () => {
    sessionStore.start({ user: { username: 'reception', roles: ['RECEPTIONIST'] }, authorization: ADMIN })
    respond(() => ({ status: 403, data: { status: 403, message: 'You do not have permission to perform this action' } }))
    await expect(httpServices.reports.revenue({ from: '2026-01-01', to: '2026-01-31', groupBy: 'DAY' })).rejects.toMatchObject({
      status: 403,
      message: 'You do not have permission to perform this action',
    })
    expect(sessionStore.get()).not.toBeNull()
  })
})
