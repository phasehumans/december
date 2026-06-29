import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Trash2, ArrowLeft, MoreHorizontal, Settings } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

import { notificationAPI, type Notification } from '@/features/notification/api/notification'
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
    onSettings,
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

    const deleteAllReadMutation = useMutation({
        mutationFn: notificationAPI.deleteAllRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            setIsMenuOpen(false)
        },
    })

    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const menuTriggerRef = useRef<HTMLButtonElement | null>(null)

    React.useLayoutEffect(() => {
        if (!isOpen || !anchorRef.current || typeof window === 'undefined') {
            return
        }

        const updatePosition = () => {
            const anchor = anchorRef.current
            if (!anchor) return

            const rect = anchor.getBoundingClientRect()

            setPosition({
                bottom: window.innerHeight - rect.top + 12,
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

    // Reset selected notification and menu when popover closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedNotification(null)
            setIsMenuOpen(false)
        }
    }, [isOpen])

    useEffect(() => {
        if (!isMenuOpen) return

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node | null
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                menuTriggerRef.current &&
                !menuTriggerRef.current.contains(target)
            ) {
                setIsMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideClick)
        document.addEventListener('touchstart', handleOutsideClick)
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick)
            document.removeEventListener('touchstart', handleOutsideClick)
        }
    }, [isMenuOpen])

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
        return createPortal(
            <div
                ref={popoverRef}
                className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans"
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
                        className="text-[#CBCACA] hover:text-white transition-colors p-1.5 rounded-xl hover:bg-[#252525] outline-none"
                    >
                        <ArrowLeft className="w-[15px] h-[15px]" />
                    </button>
                    <span className="text-[14px] text-[#CBCACA] font-medium">Back</span>
                </div>

                <div className="h-[1px] bg-[#2B2A29] mx-1 my-1 shrink-0" />

                <div
                    className="px-3 py-3 flex flex-col gap-3 overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                >
                    <div>
                        <h3 className="text-[15px] font-semibold text-white leading-snug">
                            {selectedNotification.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[#8F8E8D]">
                                {new Date(selectedNotification.createdAt).toLocaleString(
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
                    <p className="text-[13.5px] text-[#CBCACA] leading-relaxed whitespace-pre-wrap mt-1">
                        {selectedNotification.message}
                    </p>
                    {selectedNotification.link && (
                        <a
                            href={selectedNotification.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2D2C] bg-[#252525]/50 hover:bg-[#252525] rounded-xl text-[12px] font-medium text-[#CBCACA] hover:text-white transition-colors w-fit shadow-sm mt-2"
                        >
                            View Details →
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
            className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans"
            style={{
                bottom: position.bottom,
                left: Math.max(10, position.left),
                width: position.width,
                height: 320,
            }}
        >
            <div className="flex items-center justify-between px-3 py-1.5 shrink-0 relative">
                <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-medium text-[#CBCACA]">Notifications</span>
                </div>
                {/* 3 Dots Menu Button */}
                <div className="relative">
                    <button
                        ref={menuTriggerRef}
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsMenuOpen(!isMenuOpen)
                        }}
                        className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#252525] text-[#8F8E8D] hover:text-[#CBCACA] transition-colors outline-none cursor-pointer"
                        title="More options"
                    >
                        <MoreHorizontal className="w-[15px] h-[15px]" />
                    </button>
                    {isMenuOpen && (
                        <div
                            ref={menuRef}
                            className="absolute right-[-144px] top-8 z-[110] w-[180px] rounded-2xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-2 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                        >
                            <button
                                onClick={() => {
                                    onSettings?.()
                                    onClose()
                                    setIsMenuOpen(false)
                                }}
                                className="flex items-center gap-3 w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[14px] cursor-pointer outline-none group"
                            >
                                <Settings
                                    className="w-[18px] h-[18px] text-[#CBCACA] group-hover:text-white transition-colors"
                                    strokeWidth={1.5}
                                />
                                <span>Settings</span>
                            </button>
                            <button
                                onClick={() => {
                                    deleteAllReadMutation.mutate()
                                }}
                                className="flex items-center gap-3 w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[14px] cursor-pointer outline-none group"
                            >
                                <Trash2
                                    className="w-[18px] h-[18px] text-[#CBCACA] group-hover:text-white transition-colors"
                                    strokeWidth={1.5}
                                />
                                <span>Delete all read</span>
                            </button>
                        </div>
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
                    <div className="flex flex-col items-center justify-center h-[240px] px-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Inbox className="w-10 h-10 text-[#4E4D4C] mb-4" strokeWidth={1.5} />
                        <p className="text-[13px] font-medium text-[#7B7A79] leading-snug">
                            Your notifications will
                            <br />
                            appear here
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5 px-1 pb-1">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative group/notif flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                    notification.isRead
                                        ? 'text-[#8F8E8D] hover:bg-[#252525]'
                                        : 'bg-[#252525]/30 hover:bg-[#252525]/60 text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 pr-6">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {!notification.isRead && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                        )}
                                        <span
                                            className={`text-[13.5px] font-medium truncate ${
                                                notification.isRead
                                                    ? 'text-[#CBCACA] group-hover/notif:text-white'
                                                    : 'text-white'
                                            }`}
                                        >
                                            {notification.title}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[12px] text-[#8F8E8D] group-hover/notif:text-[#CBCACA] line-clamp-2 mt-0.5 leading-relaxed pr-4">
                                    {notification.message}
                                </p>
                                <span className="text-[10px] text-[#6F6E6D] group-hover/notif:text-[#8F8E8D] mt-1">
                                    {new Date(notification.createdAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>

                                {/* Hover Delete Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteMutation.mutate(notification.id)
                                    }}
                                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[#2A2A2A] border border-[#3A3A3A] text-[#969593] hover:text-white hover:border-white/20 opacity-0 group-hover/notif:opacity-100 transition-all duration-200 hover:bg-white/[0.06] outline-none shadow-sm"
                                    title="Delete notification"
                                >
                                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
