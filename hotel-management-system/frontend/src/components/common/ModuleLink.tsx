import { Link, type LinkProps } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { permissionForPath } from '@/routes/navigation'

/** Link styling classes dropped when the link renders as plain text. */
const isInteractive = (cls: string) => cls.startsWith('hover:') || cls.startsWith('text-brand-')

/**
 * A link into another module that only links when the signed-in user may open the target.
 * Otherwise it shows the same text without a link, instead of leading to "You don't have access".
 */
export function ModuleLink({ to, className, children, ...props }: LinkProps & { to: string }) {
  const can = useCan()
  const permission = permissionForPath(to)
  if (!permission || can(permission)) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    )
  }
  const plain = className?.split(/\s+/).filter((cls) => cls && !isInteractive(cls)).join(' ')
  return <span className={plain}>{children}</span>
}
