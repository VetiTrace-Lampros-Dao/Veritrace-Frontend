import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-2)] text-[var(--text-2)] border border-[var(--border)]',
        arb: 'bg-[var(--arb-bg)] text-[var(--accent)] border border-[var(--arb-border)]',
        success: 'bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]',
        warning: 'bg-[rgba(255,155,0,0.1)] text-[var(--warning-text)] border border-[rgba(255,155,0,0.25)]',
        danger: 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]',
        info: 'bg-[rgba(var(--accent-rgb),0.08)] text-[var(--accent)] border border-[var(--arb-border)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({ className, variant, children, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props}>{children}</span>
}
