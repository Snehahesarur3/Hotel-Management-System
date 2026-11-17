import { z } from 'zod'
import { unlessFailed } from './refine'
import { ID_PROOF_TYPES, type IdProofType } from '@/types/enums'

/** Suggestions for the nationality field (any value is accepted). */
export const COMMON_NATIONALITIES = [
  'Indian',
  'American',
  'Australian',
  'British',
  'Canadian',
  'Chinese',
  'Emirati',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Singaporean',
  'Sri Lankan',
] as const

/** Accepted formats per document type (spaces and dashes are ignored). */
export const ID_PROOF_RULES: Record<IdProofType, { pattern: RegExp; hint: string }> = {
  PASSPORT: { pattern: /^[A-Z0-9]{6,9}$/, hint: '6–9 letters or digits' },
  NATIONAL_ID: { pattern: /^\d{12}$/, hint: '12 digits' },
  DRIVING_LICENSE: { pattern: /^[A-Z0-9]{10,16}$/, hint: '10–16 letters or digits' },
  VOTER_ID: { pattern: /^[A-Z]{3}\d{7}$/, hint: '3 letters followed by 7 digits' },
}

export function normalizeIdNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

/**
 * Masks an identity number so only the last 4 characters are kept, e.g.
 * PASSPORT "N1234567" -> "XXXXX4567", others -> "XXXX-XXXX-4567".
 * Applied by the API before storing: full document numbers are never persisted or returned.
 */
export function maskIdNumber(type: IdProofType, value: string): string {
  const last4 = normalizeIdNumber(value).slice(-4)
  return type === 'PASSPORT' ? `XXXXX${last4}` : `XXXX-XXXX-${last4}`
}

export const NAME = /^[\p{L}][\p{L} .'-]*$/u
export const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/

/**
 * Guest validation shared by the form and the mock service.
 * `requireIdNumber`: true when creating; on update an empty ID number keeps the stored (masked) one.
 */
export function guestInputSchema({ requireIdNumber }: { requireIdNumber: boolean }) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, 'Enter the full name')
        .max(80, 'At most 80 characters')
        .regex(NAME, 'Use letters, spaces, apostrophes, dots or hyphens'),
      email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(120)),
      phone: z
        .string()
        .trim()
        .regex(PHONE, 'Enter a valid phone number, e.g. +91 98450 12345')
        .refine((p) => p.replace(/\D/g, '').length >= 7, 'Enter a valid phone number, e.g. +91 98450 12345'),
      address: z.string().trim().min(5, 'Enter the address').max(200, 'At most 200 characters'),
      nationality: z.string().trim().min(2, 'Enter the nationality').max(40, 'At most 40 characters'),
      idProofType: z.enum(ID_PROOF_TYPES, { error: 'Select an ID proof type' }),
      idProofNumber: z
        .string()
        .optional()
        .transform((v) => (v ? normalizeIdNumber(v) : '')),
    })
    .superRefine(
      (guest, ctx) => {
        if (!guest.idProofNumber) {
          if (requireIdNumber) ctx.addIssue({ code: 'custom', path: ['idProofNumber'], message: 'Enter the ID number' })
          return
        }
        // The format depends on the type; it is checked once a valid type is chosen.
        const rule = ID_PROOF_RULES[guest.idProofType] as (typeof ID_PROOF_RULES)[IdProofType] | undefined
        if (rule && !rule.pattern.test(guest.idProofNumber)) {
          ctx.addIssue({ code: 'custom', path: ['idProofNumber'], message: `Expected ${rule.hint}` })
        }
      },
      // Report the ID number together with the other fields' errors (as the backend does), not only once they are fixed.
      unlessFailed('idProofNumber'),
    )
}

export type GuestFormValues = z.input<ReturnType<typeof guestInputSchema>>
