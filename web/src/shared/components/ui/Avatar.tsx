import React from 'react'
import { cn } from '@/shared/lib/utils'
import { Icons } from './Icons'

interface AvatarProps {
    src?: string
    fallback?: string
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', className }) => {
    const sizes = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
    }

    return (
        <div
            className={cn(
                'relative rounded-full bg-[#27272A] flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-white/5',
                sizes[size],
                className
            )}
        >
            {src ? (
                <img src={src} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
                <div className="flex items-center justify-center w-full h-full text-[#71717A]">
                    {fallback ? (
                        <span className="font-medium">{fallback.slice(0, 2).toUpperCase()}</span>
                    ) : (
                        <Icons.User className="w-[65%] h-[65%]" />
                    )}
                </div>
            )}
        </div>
    )
}


