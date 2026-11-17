import type { AuthService } from '@/api/types'
import { DEV_USERS } from '@/auth/devUsers'
import { mockCall } from '@/mock/latency'
import { ApiError } from '@/types/api'

export const INVALID_CREDENTIALS_MESSAGE = 'Incorrect username or password'

/**
 * Mock-mode sign-in against the DEVELOPMENT-ONLY demo accounts (src/auth/devUsers.ts).
 * Usernames are case-insensitive, like the backend's in-memory user store. No credential is kept.
 */
export const mockAuthService: AuthService = {
  signIn: (username, password) =>
    mockCall(() => {
      const user = DEV_USERS.find((u) => u.username === username.trim().toLowerCase())
      if (!user || user.password !== password) throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE)
      return { user: { username: user.username, roles: [user.role] }, authorization: null }
    }),
}
