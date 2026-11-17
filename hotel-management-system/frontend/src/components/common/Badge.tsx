import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-soft text-ink-muted',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  brand: 'bg-brand-50 text-brand-700',
}

interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
