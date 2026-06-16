import React from 'react'

import { cn } from '@/shared/lib/utils'

interface BadgeProps {
    children: React.ReactNode
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'neutral' | 'error' | 'danger'
    className?: string
    onClick?: () => void
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    className,
    onClick,
}) => {
    const variants = {
        default: 'bg-white/10 text-white',
        outline: 'border border-white/10 text-neutral-400',
        success: 'bg-white/[0.08] text-white border border-white/15',
        warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
        neutral: 'bg-surface text-neutral-400 border border-white/5',
        error: 'bg-red-500/10 text-red-400 border border-red-500/20',
        danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider',
                variants[variant],
                onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
                className
            )}
        >
            {children}
        </div>
    )
}
