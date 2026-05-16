import { Loader2 } from 'lucide-react'
import React from 'react'

import { cn } from '@/shared/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
}) => {
    const variants = {
        primary: 'bg-[#E8E8E6] text-[#171615] hover:bg-white shadow-sm',
        secondary: 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C] border border-white/5',
        ghost: 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5',
        danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
        outline:
            'bg-transparent border border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white',
    }

    const sizes = {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-[13px]',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-9 w-9 p-0 flex items-center justify-center',
    }

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
        </button>
    )
}
