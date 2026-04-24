import type { ReactNode } from 'react'

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  children: ReactNode
  variant?: Variant
  className?: string
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-300/50 dark:border-slate-600/50',
  primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
