import React from 'react'

import { cn } from '@/shared/lib/utils'

export interface TooltipProps {
    children: React.ReactNode
    content: React.ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    align?: 'start' | 'center' | 'end'
    className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({
    children,
    content,
    position = 'bottom',
    align = 'center',
    className,
}) => {
    let positionClasses = ''

    if (position === 'bottom') {
        positionClasses = 'top-[calc(100%+6px)]'
        if (align === 'center') positionClasses += ' left-1/2 -translate-x-1/2'
        if (align === 'start') positionClasses += ' left-0'
        if (align === 'end') positionClasses += ' right-0'
    } else if (position === 'top') {
        positionClasses = 'bottom-[calc(100%+6px)]'
        if (align === 'center') positionClasses += ' left-1/2 -translate-x-1/2'
        if (align === 'start') positionClasses += ' left-0'
        if (align === 'end') positionClasses += ' right-0'
    } else if (position === 'left') {
        positionClasses = 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2'
    } else if (position === 'right') {
        positionClasses = 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2'
    }

    return (
        <div className={cn('relative group/generic-tooltip inline-flex', className)}>
            {children}
            <div
                className={cn(
                    'absolute z-[100] hidden group-hover/generic-tooltip:flex items-center gap-1.5',
                    'bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap',
                    'animate-in fade-in zoom-in-95 duration-150 pointer-events-none',
                    positionClasses
                )}
            >
                {typeof content === 'string' ? (
                    <span className="text-[12px] font-medium text-[#EDEDEF]">{content}</span>
                ) : (
                    content
                )}
            </div>
        </div>
    )
}
