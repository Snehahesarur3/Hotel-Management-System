import { Ban, CheckCircle2, CircleDollarSign, FileClock, FileCheck2, FileText, RotateCcw, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/common/Badge'
import type { BalanceState, InvoiceState } from '@/types/billing'

type Style = { tone: BadgeTone; icon: LucideIcon; label: string }

const INVOICE: Record<InvoiceState, Style> = {
  ESTIMATE: { tone: 'neutral', icon: FileText, label: 'Estimate' },
  INTERIM: { tone: 'info', icon: FileClock, label: 'Interim' },
  FINAL: { tone: 'success', icon: FileCheck2, label: 'Final' },
  VOID: { tone: 'danger', icon: Ban, label: 'Void' },
}

const BALANCE: Record<BalanceState, Style> = {
  DUE: { tone: 'warning', icon: CircleDollarSign, label: 'Due' },
  SETTLED: { tone: 'success', icon: CheckCircle2, label: 'Settled' },
  CREDIT: { tone: 'brand', icon: RotateCcw, label: 'In credit' },
}

function StyledBadge({ style }: { style: Style }) {
  const Icon = style.icon
  return (
    <Badge tone={style.tone} icon={<Icon className="size-3" aria-hidden />}>
      {style.label}
    </Badge>
  )
}

export const InvoiceStateBadge = ({ state }: { state: InvoiceState }) => <StyledBadge style={INVOICE[state]} />
export const BalanceBadge = ({ state }: { state: BalanceState }) => <StyledBadge style={BALANCE[state]} />
