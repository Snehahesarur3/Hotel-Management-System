import { LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROLE_LABELS } from '@/auth/permissions'
import { sessionStore } from '@/auth/session'
import { useCurrentUser } from '@/auth/useAuth'

/** Signed-in user and the sign-out action, in the top bar. */
export function UserMenu() {
  const user = useCurrentUser()
  if (!user) return null
  const name = user.username.charAt(0).toUpperCase() + user.username.slice(1)
  const roles = user.roles.map((r) => ROLE_LABELS[r]).join(', ')

  const signOut = () => {
    sessionStore.end('signed-out')
    toast.success('Signed out')
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700" aria-hidden>
        {user.username.slice(0, 2).toUpperCase()}
      </span>
      <div className="hidden leading-tight sm:block">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-subtle">{roles}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="rounded-full p-1.5 text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
        aria-label={`Sign out ${user.username}`}
        title="Sign out"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  )
}
