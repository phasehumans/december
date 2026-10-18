import { createContext, useContext, useRef, useState, useCallback } from 'react'

import { DEFAULT_DURATION } from './types'

import type { ToastOptions } from './types'
import type { ReactNode } from 'react'

export type ToastContextValue = {
    currentToast: ToastOptions | null
    show: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
    const value = useContext(ToastContext)
    if (!value) {
        throw new Error('useToast must be used within a ToastProvider')
    }

    return value
}

type ToastProviderProps = {
    children: ReactNode
    onToast?: (options: ToastOptions) => void
}

export function ToastProvider({ children, onToast }: ToastProviderProps) {
    const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null)
    const timeoutHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearCurrentTimeout = useCallback(() => {
        if (timeoutHandleRef.current) {
            clearTimeout(timeoutHandleRef.current)
            timeoutHandleRef.current = null
        }
    }, [])

    const show = useCallback(
        (options: ToastOptions) => {
            const duration = options.duration ?? DEFAULT_DURATION

            clearCurrentTimeout()

            const toastObj = {
                variant: options.variant ?? 'info',
                ...options,
                duration,
            }

            setCurrentToast(toastObj)
            if (onToast) {
                onToast(toastObj)
            }

            timeoutHandleRef.current = setTimeout(() => {
                setCurrentToast(null)
            }, duration)
        },
        [clearCurrentTimeout, onToast]
    )

    const value: ToastContextValue = {
        currentToast,
        show,
    }

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}
