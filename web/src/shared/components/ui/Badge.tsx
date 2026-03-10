import React from 'react'
import { cn } from '@/shared/lib/utils'

interface BadgeProps {
    children: React.ReactNode
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'neutral'
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
        success: 'bg-green-500/10 text-green-400 border border-green-500/20',
        warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
        neutral: 'bg-surface text-neutral-400 border border-white/5',
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
