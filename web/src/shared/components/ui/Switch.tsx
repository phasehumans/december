import React from 'react'
import { cn } from '@/shared/lib/utils'

interface SwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
}

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onCheckedChange,
    disabled = false,
    className,
}) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => {
                if (!disabled) {
                    onCheckedChange(!checked)
                }
            }}
            className={cn(
                'w-9 h-5 rounded-full transition-colors duration-200 ease-in-out relative border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                checked ? 'bg-white' : 'bg-surface border-white/10',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            <div
                className={cn(
                    'w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 ease-in-out absolute top-[2px] left-[2px]',
                    checked ? 'translate-x-4 bg-black' : 'translate-x-0 bg-neutral-500'
                )}
            />
        </button>
    )
}


