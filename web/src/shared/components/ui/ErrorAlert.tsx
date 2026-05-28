import { X, AlertCircle } from 'lucide-react'
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
                'fixed top-6 right-6 z-[9999] inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-[#161214]/95 backdrop-blur-md px-3 py-1 text-[11px] text-red-300 font-medium shadow-lg shadow-black/40 animate-in fade-in slide-in-from-top-3 duration-200',
                className
            )}
        >
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="truncate max-w-[280px]">{message}</span>
            <button
                onClick={handleDismiss}
                className="shrink-0 ml-0.5 p-0.5 rounded-full text-red-400/60 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                title="Dismiss"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}
