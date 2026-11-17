import { describe, expect, it } from 'vitest'
import { guestInputSchema, maskIdNumber, type GuestFormValues } from './guest'

const valid: GuestFormValues = {
  fullName: "Rhea D'Costa",
  email: '  Rhea.DCosta@Example.com ',
  phone: '+91 90000 11111',
  address: '12 Altinho, Panaji, Goa',
  nationality: 'Indian',
  idProofType: 'NATIONAL_ID',
  idProofNumber: '1234 5678 9012',
}

const create = guestInputSchema({ requireIdNumber: true })
const update = guestInputSchema({ requireIdNumber: false })
const errorsOf = (values: Partial<GuestFormValues>, schema = create) => {
  const result = schema.safeParse({ ...valid, ...values })
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('guestInputSchema', () => {
  it('reports the ID number together with other errors, like the backend', () => {
    expect(errorsOf({ fullName: 'R', idProofType: 'VOTER_ID', idProofNumber: 'AB1' })).toEqual({
      fullName: 'Enter the full name',
      idProofNumber: 'Expected 3 letters followed by 7 digits',
    })
    expect(errorsOf({ idProofType: undefined, idProofNumber: '' })).toEqual({
      idProofType: 'Select an ID proof type',
      idProofNumber: 'Enter the ID number',
    })
  })

  it('normalises email and ID number', () => {
    const parsed = create.parse(valid)
    expect(parsed.email).toBe('rhea.dcosta@example.com')
    expect(parsed.idProofNumber).toBe('123456789012')
  })

  it('validates names, emails and phone numbers', () => {
    expect(errorsOf({ fullName: 'R' })).toHaveProperty('fullName', 'Enter the full name')
    expect(errorsOf({ fullName: 'R2D2 Unit' })).toHaveProperty('fullName')
    expect(errorsOf({ fullName: 'José Müller-Ørsted' })).toEqual({})
    expect(errorsOf({ email: 'not-an-email' })).toHaveProperty('email', 'Enter a valid email address')
    expect(errorsOf({ phone: '12345' })).toHaveProperty('phone')
    expect(errorsOf({ phone: '+44 7700 900123' })).toEqual({})
  })

  it('checks the ID number format for each document type', () => {
    expect(errorsOf({ idProofNumber: '1234' })).toEqual({ idProofNumber: 'Expected 12 digits' })
    expect(errorsOf({ idProofType: 'PASSPORT', idProofNumber: 'n1234567' })).toEqual({})
    expect(errorsOf({ idProofType: 'VOTER_ID', idProofNumber: 'ABC1234567' })).toEqual({})
    expect(errorsOf({ idProofType: 'VOTER_ID', idProofNumber: '1234567890' })).toHaveProperty('idProofNumber')
  })

  it('requires the ID number when creating but not when updating', () => {
    expect(errorsOf({ idProofNumber: '' })).toEqual({ idProofNumber: 'Enter the ID number' })
    expect(errorsOf({ idProofNumber: '' }, update)).toEqual({})
  })
})

describe('maskIdNumber', () => {
  it('keeps only the last four characters', () => {
    expect(maskIdNumber('PASSPORT', 'n1234567')).toBe('XXXXX4567')
    expect(maskIdNumber('NATIONAL_ID', '1234 5678 9012')).toBe('XXXX-XXXX-9012')
  })
})
