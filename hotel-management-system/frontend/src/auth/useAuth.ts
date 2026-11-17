import { useCallback, useSyncExternalStore } from 'react'
import { hasPermission, type Permission } from './permissions'
import { sessionStore, type CurrentUser } from './session'

/** The signed-in user, or null. Re-renders on sign-in, sign-out and session expiry. */
export function useCurrentUser(): CurrentUser | null {
  return useSyncExternalStore(sessionStore.subscribe, () => sessionStore.get()?.user ?? null)
}

/**
 * Permission check for the signed-in user: `const can = useCan(); can('rooms.manage') && <Button …/>`.
 * Hiding an action is a convenience; the API (or the mock access rules) still enforces it.
 */
export function useCan(): (permission: Permission) => boolean {
  const user = useCurrentUser()
  return useCallback((permission: Permission) => hasPermission(user?.roles, permission), [user])
}
