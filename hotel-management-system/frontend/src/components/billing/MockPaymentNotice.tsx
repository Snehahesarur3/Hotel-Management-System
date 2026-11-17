import { FlaskConical } from 'lucide-react'

/** Shown wherever money is taken or returned: payments here are simulated. */
export function MockPaymentNotice({ refund = false }: { refund?: boolean }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning" role="note">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Mock {refund ? 'refund' : 'payment'}: approved instantly with a test reference. No card, UPI or bank details are collected and no
      real transaction takes place.
    </p>
  )
}
