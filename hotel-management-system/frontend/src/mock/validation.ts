import type { z } from 'zod'
import { ApiError } from '@/types/api'

/** Minimal view of zod's internal schema definition, used to find which fields are text, lists or nested objects. */
interface SchemaDef {
  type: string
  shape?: Record<string, { _zod: { def: SchemaDef } }>
  in?: { _zod: { def: SchemaDef } }
  innerType?: { _zod: { def: SchemaDef } }
}

const defOf = (schema: unknown): SchemaDef | undefined => (schema as { _zod?: { def: SchemaDef } })?._zod?.def

/** Follows pipes (transforms, coercions) to the schema that first sees the input. Optional fields stay optional. */
function inputDef(def: SchemaDef | undefined): SchemaDef | undefined {
  let current = def
  while (current?.type === 'pipe') current = current.in?._zod.def
  return current
}

/**
 * Treats a required field that is missing from the body like an empty one, as the backend does
 * (it reads a missing field as null and reports the field's "Enter …" message), so a client that leaves
 * a field out gets the form's message rather than zod's generic "expected string, received undefined".
 * Only text, list and nested-object fields are filled; others keep their own "required" messages.
 */
export function withMissingFieldsEmpty(schema: unknown, input: unknown): unknown {
  const def = inputDef(defOf(schema))
  if (def?.type !== 'object' || !def.shape || typeof input !== 'object' || input === null || Array.isArray(input)) return input
  const filled: Record<string, unknown> = { ...(input as Record<string, unknown>) }
  for (const [key, field] of Object.entries(def.shape)) {
    const fieldDef = inputDef(field._zod.def)
    if (filled[key] === undefined) {
      if (fieldDef?.type === 'string') filled[key] = ''
      else if (fieldDef?.type === 'array') filled[key] = []
      else if (fieldDef?.type === 'object') filled[key] = withMissingFieldsEmpty(field, {})
    } else if (fieldDef?.type === 'object') {
      filled[key] = withMissingFieldsEmpty(field, filled[key])
    }
  }
  return filled
}

/**
 * Server-side validation for mock services: parses `input` with the same schema the forms use
 * and throws a 400 ApiError with per-field messages, exactly like the backend's validation errors.
 */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(withMissingFieldsEmpty(schema, input))
  if (result.success) return result.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path.length ? issue.path.map(String).join('.') : '_form'
    fieldErrors[field] ??= issue.message
  }
  throw new ApiError(400, 'Validation failed', fieldErrors)
}
