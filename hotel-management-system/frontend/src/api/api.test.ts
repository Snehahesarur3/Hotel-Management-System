import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { __internal } from '@/api/config'
import { toApiError } from '@/api/http/client'
import { toQueryParams } from '@/api/http/query'
import { ApiError } from '@/types/api'

describe('api config parsing', () => {
  it('parses the mock flag strictly with a fallback', () => {
    expect(__internal.parseBoolean('true', false)).toBe(true)
    expect(__internal.parseBoolean(' TRUE ', false)).toBe(true)
    expect(__internal.parseBoolean('false', true)).toBe(false)
    expect(__internal.parseBoolean('', true)).toBe(true)
    expect(__internal.parseBoolean(undefined, false)).toBe(false)
  })

  it('parses latency as a non-negative integer', () => {
    expect(__internal.parseNonNegativeInt('250', 300)).toBe(250)
    expect(__internal.parseNonNegativeInt('-5', 300)).toBe(300)
    expect(__internal.parseNonNegativeInt('abc', 300)).toBe(300)
  })
})

describe('toApiError', () => {
  const config = { headers: new AxiosHeaders() }

  it('maps backend validation errors including field errors', () => {
    const axiosError = new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config,
      data: { status: 400, message: 'Validation failed', fieldErrors: { roomNumber: 'must not be blank' } },
    })

    const error = toApiError(axiosError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('Validation failed')
    expect(error.fieldErrors).toEqual({ roomNumber: 'must not be blank' })
  })

  it('maps network failures to status 0 with a helpful message', () => {
    const error = toApiError(new AxiosError('Network Error', 'ERR_NETWORK', config))
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/backend is running/)
  })
})

describe('toQueryParams', () => {
  it('serialises paging, search, sort and filters for the Spring Boot API', () => {
    const params = toQueryParams({
      page: 0,
      size: 20,
      search: '  suite ',
      sort: { field: 'pricePerNight', direction: 'desc' },
      floor: 2,
      status: ['AVAILABLE', 'RESERVED'],
      type: undefined,
      guest: '',
    })
    expect(params.toString()).toBe('page=0&size=20&search=suite&sort=pricePerNight%2Cdesc&floor=2&status=AVAILABLE&status=RESERVED')
  })

  it('returns no parameters for an empty query', () => {
    expect(toQueryParams().toString()).toBe('')
  })
})
