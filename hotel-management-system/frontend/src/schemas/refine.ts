/**
 * Option for a cross-field `superRefine`: run it even when other fields have errors, so a form (and the mock API)
 * reports every broken rule at once, as the backend does, instead of revealing them one round at a time.
 * The rule is still skipped when one of the fields it reports on already failed, to avoid two messages for one field.
 */
export function unlessFailed(...fields: string[]) {
  return {
    when: (payload: { issues: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey> }> }) =>
      !payload.issues.some((issue) => fields.includes(String(issue.path?.[0]))),
  }
}
