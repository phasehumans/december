import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Info } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: number
    message: string
    type: ToastType
}

let toastCount = 0
let addToastFn: (message: string, type: ToastType) => void = () => {}

export const toast = {
    success: (message: string) => addToastFn(message, 'success'),
    error: (message: string) => addToastFn(message, 'error'),
    info: (message: string) => addToastFn(message, 'info'),
}

export const ToastProvider: React.FC = () => {
    const [toasts, setToasts] = useState<Toast[]>([])

    useEffect(() => {
        addToastFn = (message: string, type: ToastType) => {
            const id = ++toastCount
            setToasts((prev) => [...prev, { id, message, type }])
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id))
            }, 3000)
        }
    }, [])

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map((t) => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: -20, scale: 0.5, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, scale: 0.9, filter: 'blur(2px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="bg-[#1C1C1C] border border-[#333] shadow-xl rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5 overflow-hidden whitespace-nowrap pointer-events-auto"
                    >
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#252525]">
                            {t.type === 'success' && (
                                <Check className="w-3.5 h-3.5 text-[#87B2F4]" strokeWidth={3} />
                            )}
                            {t.type === 'error' && (
                                <X className="w-3.5 h-3.5 text-red-400" strokeWidth={3} />
                            )}
                            {t.type === 'info' && (
                                <Info className="w-3.5 h-3.5 text-[#A1A1AA]" strokeWidth={3} />
                            )}
                        </div>
                        <span className="text-[13px] font-medium text-[#EDEDEF]">{t.message}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
