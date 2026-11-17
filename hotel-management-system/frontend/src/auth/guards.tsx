import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { NoAccessPage } from '@/pages/NoAccessPage'
import type { Permission } from './permissions'
import { useCan, useCurrentUser } from './useAuth'

/** Sends visitors who are not signed in to the sign-in page, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const { pathname, search } = useLocation()
  if (!user) {
    const next = pathname === '/' && !search ? '' : `?next=${encodeURIComponent(pathname + search)}`
    return <Navigate to={`/sign-in${next}`} replace />
  }
  return children
}

/** Layout route: renders its child routes only for users with the permission, otherwise explains why not. */
export function RequirePermission({ permission }: { permission: Permission }) {
  const can = useCan()
  return can(permission) ? <Outlet /> : <NoAccessPage />
}
