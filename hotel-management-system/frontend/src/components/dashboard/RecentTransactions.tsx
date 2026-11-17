import { Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { TransactionSummary } from '@/types/dashboard'
import { enumLabel, formatCurrency, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'

export function RecentTransactions({ transactions }: { transactions: TransactionSummary[] }) {
  return (
    <Card>
      <CardHeader title="Recent transactions" subtitle="Latest payments recorded" />
      {transactions.length === 0 ? (
        <EmptyState title="No payments recorded" icon={Receipt} />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{t.guestName}</p>
                <p className="truncate text-xs text-ink-muted">
                  {enumLabel(t.method)} · {formatDateTime(t.paymentDate)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    t.status === 'COMPLETED' ? 'text-ink' : 'text-ink-subtle line-through decoration-ink-subtle/60',
                  )}
                >
                  {formatCurrency(t.amount)}
                </span>
                <StatusBadge kind="payment" status={t.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
