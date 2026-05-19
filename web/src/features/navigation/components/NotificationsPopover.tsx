import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Trash2, ArrowLeft } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

import { notificationAPI, Notification } from '@/features/notification/api/notification'

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
                        className="text-[#969593] hover:text-red-400 transition-colors p-1 rounded hover:bg-[#252422] outline-none"
                        title="Delete notification"
                    >
                        <Trash2 className="w-[14px] h-[14px]" />
                    </button>
                </div>

                <div className="h-[1px] bg-[#2B2A29] mx-1 my-1 shrink-0" />

                <div
                    className="px-3 py-3 flex flex-col gap-2 overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                >
                    <h3 className="text-[14px] font-medium text-[#E8E8E8]">
                        {selectedNotification.title}
                    </h3>
                    <span className="text-[11px] text-[#6F6E6D]">
                        {new Date(selectedNotification.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                    <p className="text-[13px] text-[#A3A3A3] leading-relaxed whitespace-pre-wrap mt-1">
                        {selectedNotification.message}
                    </p>
                    {selectedNotification.link && (
                        <a
                            href={selectedNotification.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-blue-400/80 hover:text-blue-300 mt-1"
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
                <span className="text-[14px] font-medium text-[#CBCACA]">Notifications</span>
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 mb-1 shrink-0" />

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <p className="text-[13px] text-[#969593] animate-pulse">Loading...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center mt-6">
                        <div className="w-9 h-9 mb-2.5 rounded-xl border border-[#2E2D2C] flex items-center justify-center bg-[#252422]/50">
                            <Inbox className="w-4 h-4 text-[#969593]" />
                        </div>
                        <p className="text-[13px] text-[#969593] leading-snug">
                            No notifications yet
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5 px-1 pb-1">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                    notification.isRead
                                        ? 'opacity-50 hover:opacity-80 hover:bg-[#252422]'
                                        : 'hover:bg-[#252422]/60'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-medium text-[#E8E8E8] truncate">
                                        {notification.title}
                                    </span>
                                </div>
                                <p className="text-[12px] text-[#8F8E8D] line-clamp-2 mt-0.5">
                                    {notification.message}
                                </p>
                                <span className="text-[10px] text-[#6F6E6D] mt-1">
                                    {new Date(notification.createdAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
