import { X } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { useInbox } from '../hooks/useInbox'
import { useNotificationLive } from '../hooks/useNotificationLive'

import { useIsPhone } from '@/shared/lib/useIsPhone'

const SHOW_MS = 6000

// toast for a new mention, reply or agent question (K4): bottom right on desktop, top on
// phones, in the inbox popover's style. clicking it marks it read and opens its link.
export const NotificationToast: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
    const { toast, dismiss } = useNotificationLive(isAuthenticated)
    const { markAsRead } = useInbox(false)
    const isPhone = useIsPhone()
    const navigate = useNavigate()

    React.useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(dismiss, SHOW_MS)
        return () => window.clearTimeout(timer)
    }, [toast, dismiss])

    if (!toast || typeof document === 'undefined') return null

    const open = () => {
        if (!toast.isRead) markAsRead.mutate(toast.id)
        const link = toast.link
        dismiss()
        if (!link) return
        if (link.startsWith('/')) navigate(link)
        else window.open(link, '_blank', 'noopener,noreferrer')
    }

    return createPortal(
        <div
            role="status"
            aria-live="polite"
            className={
                isPhone
                    ? 'fixed z-[120] left-2 right-2 top-[calc(env(safe-area-inset-top,0px)+8px)] animate-in fade-in slide-in-from-top-2 duration-200'
                    : 'fixed z-[120] right-4 bottom-4 w-[300px] animate-in fade-in slide-in-from-bottom-2 duration-200'
            }
        >
            <div className="flex items-start gap-2 rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-lg pl-3 pr-1.5 py-2.5 font-sans">
                <button
                    type="button"
                    onClick={open}
                    className="flex-1 min-w-0 text-left outline-none cursor-pointer"
                >
                    <span className="block text-[12.5px] font-medium text-[#EDEDED] truncate">
                        {toast.title}
                    </span>
                    <span className="block text-[11.5px] text-[#8F8E8D] line-clamp-2 mt-0.5">
                        {toast.message}
                    </span>
                </button>
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={dismiss}
                    className="p-1 rounded-md text-[#6F6E6D] hover:text-[#CBCACA] hover:bg-white/[0.06] outline-none cursor-pointer"
                >
                    <X className="w-3 h-3" strokeWidth={2} />
                </button>
            </div>
        </div>,
        document.body
    )
}
