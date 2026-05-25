import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
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
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                    'flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] backdrop-blur-md px-4 py-3 text-red-200 shadow-lg shadow-red-950/20 max-w-xl w-full',
                    className
                )}
            >
                <div className="mt-0.5 shrink-0">
                    <AlertCircle className="h-4.5 w-4.5 text-red-400" />
                </div>
                <div className="flex-1 text-[13px] leading-relaxed font-medium select-text break-words">
                    {message}
                </div>
                <button
                    onClick={handleDismiss}
                    className="shrink-0 p-0.5 -mt-0.5 -mr-1 rounded-md text-red-400/70 hover:text-red-200 hover:bg-red-500/10 transition-all active:scale-95"
                    title="Dismiss"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
