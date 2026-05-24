import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Inbox,
    Trash2,
    ArrowLeft,
    Loader2,
    Info,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { notificationAPI, Notification } from '@/features/notification/api/notification'
import { Skeleton } from '@/shared/components/ui/Skeleton'

interface NotificationsPopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
    onSettings?: () => void
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
    isOpen,
    anchorRef,
    onClose,
}) => {
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const [position, setPosition] = useState<{
        bottom: number
        left: number
        width: number
    } | null>(null)

    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

    const queryClient = useQueryClient()

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: notificationAPI.getNotifications,
        enabled: isOpen,
    })

    const markAsReadMutation = useMutation({
        mutationFn: notificationAPI.markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: notificationAPI.deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            setSelectedNotification(null)
        },
    })

    React.useLayoutEffect(() => {
        if (!isOpen || !anchorRef.current || typeof window === 'undefined') {
            return
        }

        const updatePosition = () => {
            const anchor = anchorRef.current
            if (!anchor) return

            const rect = anchor.getBoundingClientRect()

            setPosition({
                bottom: window.innerHeight - rect.top + 8,
                left: rect.left - 250,
                width: 280,
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)

        return () => {
            window.removeEventListener('resize', updatePosition)
        }
    }, [anchorRef, isOpen])

    // Reset selected notification when popover closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedNotification(null)
        }
    }, [isOpen])

    React.useEffect(() => {
        if (!isOpen) return

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null
            if (
                (target && popoverRef.current?.contains(target)) ||
                (target && anchorRef.current?.contains(target))
            ) {
                return
            }
            onClose()
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (selectedNotification) {
                    setSelectedNotification(null)
                } else {
                    onClose()
                }
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [anchorRef, isOpen, onClose, selectedNotification])

    if (!isOpen || !position || typeof document === 'undefined') {
        return null
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id)
        }
        setSelectedNotification(notification)
    }

    // --- Detail View ---
    if (selectedNotification) {
        const typeColors: Record<string, string> = {
            INFO: 'bg-white/[0.04] border-white/[0.08] text-[#D6D5C9]',
            WARNING: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            SUCCESS: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            ERROR: 'bg-red-500/10 border-red-500/20 text-red-400',
        }
        const badgeColor = typeColors[selectedNotification.type] || typeColors.INFO

        return createPortal(
            <div
                ref={popoverRef}
                className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1E1D1C] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col"
                style={{
                    bottom: position.bottom,
                    left: Math.max(10, position.left),
                    width: position.width,
                    height: 320,
                }}
            >
                <div className="flex items-center gap-2 px-2 py-1.5 shrink-0">
                    <button
                        onClick={() => setSelectedNotification(null)}
                        className="text-[#969593] hover:text-[#CBCACA] transition-colors p-1 rounded hover:bg-[#252422] outline-none"
                    >
                        <ArrowLeft className="w-[15px] h-[15px]" />
                    </button>
                    <span className="text-[13px] text-[#969593]">Back</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => deleteMutation.mutate(selectedNotification.id)}
                        disabled={deleteMutation.isPending}
                        className="text-[#969593] hover:text-red-400 transition-colors p-1 rounded hover:bg-[#252422] outline-none disabled:opacity-50"
                        title="Delete notification"
                    >
                        {deleteMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="w-[14px] h-[14px]" />
                        )}
                    </button>
                </div>

                <div className="h-[1px] bg-[#2B2A29] mx-1 my-1 shrink-0" />

                <div
                    className="px-3 py-3 flex flex-col gap-2 overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                >
                    <h3 className="text-[14px] font-medium text-[#E8E8E8] leading-snug">
                        {selectedNotification.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span
                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md border ${badgeColor}`}
                        >
                            {selectedNotification.type}
                        </span>
                        <span className="text-[10px] text-[#6F6E6D]">
                            {new Date(selectedNotification.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                    <p className="text-[13px] text-[#A3A3A3] leading-relaxed whitespace-pre-wrap mt-2">
                        {selectedNotification.message}
                    </p>
                    {selectedNotification.link && (
                        <a
                            href={selectedNotification.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-[#D6D5C9]/85 hover:text-[#D6D5C9] hover:underline mt-2 font-medium"
                        >
                            View link →
                        </a>
                    )}
                </div>
            </div>,
            document.body
        )
    }

    // --- List View ---
    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1E1D1C] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            style={{
                bottom: position.bottom,
                left: Math.max(10, position.left),
                width: position.width,
                height: 320,
            }}
        >
            <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-medium text-[#CBCACA]">Notifications</span>
                    {notifications.some((n: any) => !n.isRead) && (
                        <span className="w-1.5 h-1.5 bg-[#D6D5C9] rounded-full animate-pulse" />
                    )}
                </div>
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 mb-1 shrink-0" />

            <div
                className="flex-1 overflow-y-auto animate-in fade-in duration-300"
                style={{ scrollbarWidth: 'none' }}
            >
                {isLoading ? (
                    <div className="flex flex-col gap-3 px-3 py-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-2.5 py-2 px-1">
                                <Skeleton className="h-3.5 w-3.5 rounded-full bg-white/[0.06] shrink-0 mt-0.5 animate-pulse" />
                                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-3.5 w-[120px] bg-white/[0.06] animate-pulse" />
                                        {i === 1 && (
                                            <Skeleton className="h-1.5 w-1.5 rounded-full bg-white/20" />
                                        )}
                                    </div>
                                    <Skeleton className="h-3 w-[180px] bg-white/[0.04] animate-pulse" />
                                    <Skeleton className="h-2 w-[50px] bg-white/[0.04] animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="relative mb-3.5 flex h-10 w-10 items-center justify-center rounded-full border border-[#2E2D2C] bg-gradient-to-b from-[#2E2D2C]/60 to-transparent text-[#969593] shadow-inner">
                            <Inbox className="w-5 h-5" />
                        </div>
                        <p className="text-[13px] font-medium text-[#E8E8E8] leading-none">
                            No notifications yet
                        </p>
                        <p className="mt-2 text-[11px] text-[#6F6E6D] max-w-[200px] leading-relaxed">
                            We'll let you know when something needs your attention.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5 px-1 pb-1">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                    notification.isRead
                                        ? 'text-[#8F8E8D] hover:bg-[#252422]/40'
                                        : 'bg-[#252422]/20 hover:bg-[#252422]/60 text-[#E8E8E8]'
                                }`}
                            >
                                <div className="mt-0.5 shrink-0">
                                    {notification.type === 'SUCCESS' && (
                                        <CheckCircle2 className="w-[14px] h-[14px] text-emerald-400/80" />
                                    )}
                                    {notification.type === 'WARNING' && (
                                        <AlertTriangle className="w-[14px] h-[14px] text-amber-400/80" />
                                    )}
                                    {notification.type === 'ERROR' && (
                                        <XCircle className="w-[14px] h-[14px] text-red-400/80" />
                                    )}
                                    {notification.type === 'INFO' && (
                                        <Info className="w-[14px] h-[14px] text-neutral-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between gap-2 w-full">
                                        <span
                                            className={`text-[13px] font-medium truncate ${
                                                notification.isRead
                                                    ? 'text-[#CAC9C9]'
                                                    : 'text-white'
                                            }`}
                                        >
                                            {notification.title}
                                        </span>
                                        {!notification.isRead && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#D6D5C9] shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-[12px] text-[#8F8E8D] line-clamp-2 mt-0.5 leading-relaxed">
                                        {notification.message}
                                    </p>
                                    <span className="text-[10px] text-[#6F6E6D] mt-1">
                                        {new Date(notification.createdAt).toLocaleString(
                                            undefined,
                                            {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            }
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
