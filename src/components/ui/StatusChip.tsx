import { cn } from '@/lib/utils/cn'

export type DocStatus = 'draft' | 'under_review' | 'approved' | 'obsolete'

const STATUS_STYLE: Record<DocStatus, string> = {
  draft:        'bg-bg-inset text-ink-soft ring-line',
  under_review: 'bg-warning/10 text-warning ring-warning/30',
  approved:     'bg-success/10 text-success ring-success/30',
  obsolete:     'bg-bg-inset text-ink-faint ring-line line-through',
}

const STATUS_LABEL: Record<DocStatus, string> = {
  draft:        'Draft',
  under_review: 'Under review',
  approved:     'Approved',
  obsolete:     'Obsolete',
}

export function StatusChip({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <span className={cn('chip', STATUS_STYLE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}
