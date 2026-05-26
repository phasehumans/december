import { X } from 'lucide-react'
import React, { useState } from 'react'

import { cn } from '@/shared/lib/utils'

interface ErrorAlertProps {
    message: string | null | undefined
    className?: string
    onClear?: () => void
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, className, onClear }) => {
    const [isDismissed, setIsDismissed] = useState(false)

    if (!message || isDismissed) return null

    const handleDismiss = () => {
        setIsDismissed(true)
        if (onClear) {
            onClear()
        }
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-300 font-medium animate-in fade-in duration-200',
                className
            )}
        >
            <span className="truncate max-w-[280px]">{message}</span>
            <button
                onClick={handleDismiss}
                className="shrink-0 p-0.5 rounded-full text-red-400/60 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                title="Dismiss"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}
