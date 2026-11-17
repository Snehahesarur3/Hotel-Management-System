import { DEV_USERS } from '@/auth/devUsers'
import { sessionStore } from '@/auth/session'
import type { UserRole } from '@/types/enums'

/** Starts a mock-mode session for the demo user with this role (tests only). */
export function signInAs(role: UserRole) {
  const user = DEV_USERS.find((u) => u.role === role)!
  sessionStore.start({ user: { username: user.username, roles: [role] }, authorization: null })
}

export function signOut() {
  sessionStore.end('signed-out')
}
