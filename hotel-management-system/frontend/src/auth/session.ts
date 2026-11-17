import type { UserRole } from '@/types/enums'

/** The signed-in user, as returned by GET /api/auth/me (and by the mock sign-in). */
export interface CurrentUser {
  username: string
  roles: UserRole[]
}

export interface Session {
  user: CurrentUser
  /**
   * HTTP Basic credentials ("Basic base64(user:password)") sent with every API request; null in mock mode.
   * DEVELOPMENT ONLY: keeping a reusable credential in sessionStorage is acceptable for demo accounts,
   * not for real users. A production build would use short-lived tokens from an identity provider instead.
   */
  authorization: string | null
}

/** Why the session ended, so the sign-in page can explain it. */
export type SignOutReason = 'signed-out' | 'expired'

const STORAGE_KEY = 'hms.session'

type Listener = () => void
const listeners = new Set<Listener>()

let current: Session | null = read()
let lastReason: SignOutReason | null = null

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    return parsed?.user?.username && Array.isArray(parsed.user.roles) ? parsed : null
  } catch {
    return null
  }
}

function write(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked (private mode, quota): the session still lives in memory for this page.
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

/**
 * The browser's sign-in state. Kept in sessionStorage so it survives a reload but ends with the tab.
 * Plain module state (not React) because the HTTP client needs it outside components.
 */
export const sessionStore = {
  get: (): Session | null => current,
  lastSignOutReason: (): SignOutReason | null => lastReason,
  start(session: Session) {
    current = session
    lastReason = null
    write(session)
    emit()
  },
  end(reason: SignOutReason) {
    if (!current) return
    current = null
    lastReason = reason
    write(null)
    emit()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Re-reads storage (tests clear it between cases). */
  reload() {
    current = read()
    lastReason = null
    emit()
  },
}

/** "Basic base64(username:password)", UTF-8 safe. */
export function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return `Basic ${btoa(binary)}`
}
