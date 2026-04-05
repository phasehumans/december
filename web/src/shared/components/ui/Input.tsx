import React from 'react'

import { cn } from '@/shared/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    leftIcon,
    rightIcon,
    ...props
}) => {
    return (
        <div className="w-full space-y-1.5">
            {label && (
                <label className="block text-xs font-medium text-neutral-400 ml-1">{label}</label>
            )}
            <div className="relative group">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none group-focus-within:text-neutral-300 transition-colors">
                        {leftIcon}
                    </div>
                )}
                <input
                    className={cn(
                        'w-full bg-[#242323] border border-transparent focus:border-white/10 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium',
                        props.disabled && 'opacity-50 cursor-not-allowed',
                        leftIcon ? 'pl-9' : 'px-3',
                        rightIcon ? 'pr-9' : 'px-3',
                        'h-10',
                        className
                    )}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
        </div>
    )
}
