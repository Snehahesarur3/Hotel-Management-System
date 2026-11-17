import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        className="py-16"
        icon={SearchX}
        title="Page not found"
        description="The page you requested does not exist. Use the navigation to find what you need."
        action={
          <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Go to dashboard
          </Link>
        }
      />
    </Card>
  )
}
