import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROLE_LABELS } from '@/auth/permissions'
import { useCurrentUser } from '@/auth/useAuth'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'

/** Shown when a signed-in user opens a page their role cannot use (e.g. a link shared by a colleague). */
export function NoAccessPage() {
  const user = useCurrentUser()
  const roles = user?.roles.map((r) => ROLE_LABELS[r]).join(', ')
  return (
    <Card>
      <EmptyState
        className="py-16"
        icon={ShieldX}
        title="You don’t have access to this page"
        description={
          user
            ? `You are signed in as ${user.username} (${roles}). Ask a manager if you need this module.`
            : 'Sign in with an account that can use this module.'
        }
        action={
          <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Go to dashboard
          </Link>
        }
      />
    </Card>
  )
}
