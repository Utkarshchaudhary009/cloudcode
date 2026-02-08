'use client'

import { cn } from '@/lib/utils'

type TaskStatus = 'processing' | 'completed' | 'error' | 'stopped' | 'queued'

interface StatusBadgeProps {
    status: TaskStatus | string
    className?: string
    showDot?: boolean
    size?: 'sm' | 'md'
}

const statusConfig: Record<TaskStatus, { label: string; dotClass: string; badgeClass: string }> = {
    processing: {
        label: 'Running',
        dotClass: 'bg-success animate-pulse',
        badgeClass: 'bg-success/10 text-success border-success/20',
    },
    completed: {
        label: 'Completed',
        dotClass: 'bg-success',
        badgeClass: 'bg-success/10 text-success border-success/20',
    },
    error: {
        label: 'Failed',
        dotClass: 'bg-error',
        badgeClass: 'bg-error/10 text-error border-error/20',
    },
    stopped: {
        label: 'Stopped',
        dotClass: 'bg-warning',
        badgeClass: 'bg-warning/10 text-warning border-warning/20',
    },
    queued: {
        label: 'Queued',
        dotClass: 'bg-info',
        badgeClass: 'bg-info/10 text-info border-info/20',
    },
}

export function StatusBadge({ status, className, showDot = true, size = 'sm' }: StatusBadgeProps) {
    const config = statusConfig[status as TaskStatus] || {
        label: status,
        dotClass: 'bg-muted-foreground',
        badgeClass: 'bg-muted text-muted-foreground border-border',
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-medium',
                size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                config.badgeClass,
                className
            )}
        >
            {showDot && (
                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dotClass)} />
            )}
            {config.label}
        </span>
    )
}

// Export status dot separately for use in compact views
export function StatusDot({ status, className }: { status: TaskStatus | string; className?: string }) {
    const config = statusConfig[status as TaskStatus] || {
        dotClass: 'bg-muted-foreground',
    }

    return (
        <span
            className={cn('h-2 w-2 rounded-full flex-shrink-0', config.dotClass, className)}
            title={statusConfig[status as TaskStatus]?.label || status}
        />
    )
}
