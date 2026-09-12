import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, ArrowLeft, MoreHorizontal, Settings, Bell } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

import { notificationAPI, type Notification } from '@/features/notification/api/notification'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

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

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['notifications'],
        queryFn: ({ pageParam = 1 }) =>
            notificationAPI.getNotifications({ page: pageParam, limit: 20 }),
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pagination
            return page < totalPages ? page + 1 : undefined
        },
        initialPageParam: 1,
        enabled: isOpen,
    })

    const notifications = React.useMemo(
        () => data?.pages.flatMap((page) => page.notifications) || [],
        [data]
    )

    const markAsReadMutation = useMutation({
        mutationFn: notificationAPI.markAsRead,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] })
            await queryClient.cancelQueries({ queryKey: ['notifications-unread-count'] })

            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
                if (!old) return old
                if (Array.isArray(old)) {
                    return old.map((n: any) => (n.id === id ? { ...n, isRead: true } : n))
                }
                if (Array.isArray(old.pages)) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            notifications: page.notifications?.map((n: any) =>
                                n.id === id ? { ...n, isRead: true } : n
                            ),
                        })),
                    }
                }
                return old
            })

            queryClient.setQueryData(['notifications-unread-count'], (count: number | undefined) =>
                typeof count === 'number' ? Math.max(0, count - 1) : 0
            )
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: notificationAPI.deleteNotification,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] })
            await queryClient.cancelQueries({ queryKey: ['notifications-unread-count'] })

            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
                if (!old) return old
                if (Array.isArray(old)) {
                    return old.filter((n: any) => n.id !== id)
                }
                if (Array.isArray(old.pages)) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            notifications: page.notifications?.filter((n: any) => n.id !== id),
                        })),
                    }
                }
                return old
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
            setSelectedNotification(null)
        },
    })

    const deleteAllReadMutation = useMutation({
        mutationFn: notificationAPI.deleteAllRead,
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] })

            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
                if (!old) return old
                if (Array.isArray(old)) {
                    return old.filter((n: any) => !n.isRead)
                }
                if (Array.isArray(old.pages)) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            notifications: page.notifications?.filter((n: any) => !n.isRead),
                        })),
                    }
                }
                return old
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
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
            const popoverWidth = Math.min(260, window.innerWidth - 20)
            const left = Math.max(10, Math.min(rect.left, window.innerWidth - popoverWidth - 10))

            setPosition({
                bottom: window.innerHeight - rect.top + 12,
                left,
                width: popoverWidth,
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)

        return () => {
            window.removeEventListener('resize', updatePosition)
        }
    }, [anchorRef, isOpen])

    // reset selected notification and menu when popover closes
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

    // --- detail view ---
    if (selectedNotification) {
        return createPortal(
            <div
                ref={popoverRef}
                className="fixed z-[100] rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-lg p-1 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans"
                style={{
                    bottom: position.bottom,
                    left: Math.max(10, position.left),
                    width: position.width,
                    height: 290,
                }}
            >
                <div className="flex items-center gap-1 px-1 py-0.5 shrink-0">
                    <button
                        onClick={() => setSelectedNotification(null)}
                        className="text-[#CBCACA] hover:text-white transition-colors p-1 rounded-md hover:bg-[#252525] outline-none cursor-pointer"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="h-[1px] bg-[#2B2A29] mx-1 my-0.5 shrink-0" />

                <div
                    className="px-2 py-1.5 flex flex-col gap-2 overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                >
                    <div>
                        <h3 className="text-[12px] font-medium text-white leading-snug">
                            {selectedNotification.title}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9.5px] text-[#8F8E8D]">
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
                    <p className="text-[11px] text-[#CBCACA] leading-snug whitespace-pre-wrap mt-0.5">
                        {selectedNotification.message}
                    </p>
                    {selectedNotification.link && (
                        <a
                            href={selectedNotification.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#2E2D2C] bg-[#252525]/50 hover:bg-[#252525] rounded-lg text-[10.5px] font-medium text-[#CBCACA] hover:text-white transition-colors w-fit shadow-sm mt-1"
                        >
                            View Details →
                        </a>
                    )}
                </div>
            </div>,
            document.body
        )
    }

    // --- list view ---
    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-lg p-1 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans"
            style={{
                bottom: position.bottom,
                left: Math.max(10, position.left),
                width: position.width,
                height: 290,
            }}
        >
            <div className="flex items-center justify-between px-1.5 py-0.5 shrink-0 relative">
                <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-[#CBCACA]">Notifications</span>
                </div>
                {/* 3 dots menu button */}
                <div className="relative">
                    <button
                        ref={menuTriggerRef}
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsMenuOpen(!isMenuOpen)
                        }}
                        className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[#252525] text-[#8F8E8D] hover:text-[#CBCACA] transition-colors outline-none cursor-pointer group/dots"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%+8px)] z-50 hidden group-hover/dots:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2 py-0.5 rounded-md shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[10.5px] font-medium text-[#EDEDEF]">
                                More options
                            </span>
                        </div>
                    </button>
                    {isMenuOpen && (
                        <div
                            ref={menuRef}
                            className="absolute right-0 top-7 z-[110] w-[145px] rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                        >
                            <button
                                onClick={() => {
                                    onSettings?.()
                                    onClose()
                                    setIsMenuOpen(false)
                                }}
                                className="flex items-center gap-2.5 w-full px-2 py-1 rounded-lg hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[11.5px] cursor-pointer outline-none group"
                            >
                                <Settings
                                    className="w-3.5 h-3.5 text-[#CBCACA] group-hover:text-white transition-colors"
                                    strokeWidth={1.5}
                                />
                                <span>Settings</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    deleteAllReadMutation.mutate()
                                }}
                                className="flex items-center gap-2.5 w-full px-2 py-1 rounded-lg hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[11.5px] cursor-pointer outline-none group"
                            >
                                <Trash2
                                    className="w-3.5 h-3.5 text-[#CBCACA] group-hover:text-white transition-colors"
                                    strokeWidth={1.5}
                                />
                                <span>Delete all read</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 mb-0.5 shrink-0" />

            <div
                className="flex-1 overflow-y-auto animate-in fade-in duration-300"
                style={{ scrollbarWidth: 'none' }}
                onScroll={(e) => {
                    const target = e.currentTarget
                    if (
                        target.scrollHeight - target.scrollTop - target.clientHeight < 50 &&
                        hasNextPage &&
                        !isFetchingNextPage
                    ) {
                        fetchNextPage()
                    }
                }}
            >
                {isLoading || isSkeletonPreviewActive() ? (
                    <div className="flex flex-col gap-2 px-2 py-1.5 animate-in fade-in duration-150">
                        {[
                            {
                                titleW: 'w-[110px]',
                                descW: 'w-[140px]',
                                timeW: 'w-[44px]',
                                isUnread: true,
                            },
                            {
                                titleW: 'w-[130px]',
                                descW: 'w-[160px]',
                                timeW: 'w-[36px]',
                                isUnread: false,
                            },
                            {
                                titleW: 'w-[95px]',
                                descW: 'w-[120px]',
                                timeW: 'w-[40px]',
                                isUnread: false,
                            },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 py-1 px-0.5">
                                <Skeleton className="h-3 w-3 rounded-full bg-white/[0.05] shrink-0 mt-0.5" />
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <Skeleton
                                            className={`h-3 ${item.titleW} bg-white/[0.04] rounded`}
                                        />
                                        {item.isUnread && (
                                            <Skeleton className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0" />
                                        )}
                                    </div>
                                    <Skeleton
                                        className={`h-2.5 ${item.descW} bg-white/[0.025] rounded`}
                                    />
                                    <Skeleton
                                        className={`h-2 ${item.timeW} bg-white/[0.02] rounded`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[210px] px-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-xl bg-[#252525]/60 flex items-center justify-center mb-2.5 border border-[#2E2D2C]/60 shadow-sm">
                            <Bell className="w-4 h-4 text-[#D6D5D4]" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-[12px] font-medium text-white mb-1 tracking-tight">
                            No Notifications
                        </h3>
                        <p className="text-[11px] text-[#8F8E8D] leading-[1.35] max-w-[170px]">
                            You're all caught up. New notifications will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5 px-0.5 pb-0.5">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative group/notif flex flex-col gap-0.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                    notification.isRead
                                        ? 'text-[#8F8E8D] hover:bg-[#252525]'
                                        : 'bg-transparent hover:bg-[#252525] text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1.5 pr-5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {!notification.isRead && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#87B2F4] shrink-0" />
                                        )}
                                        <span
                                            className={`text-[12px] font-medium truncate ${
                                                notification.isRead
                                                    ? 'text-[#CBCACA] group-hover/notif:text-white'
                                                    : 'text-white'
                                            }`}
                                        >
                                            {notification.title}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10.5px] text-[#8F8E8D] group-hover/notif:text-[#CBCACA] line-clamp-2 mt-[1px] leading-snug pr-3">
                                    {notification.message}
                                </p>
                                <span className="text-[9px] text-[#6F6E6D] group-hover/notif:text-[#8F8E8D] mt-[1px] leading-tight">
                                    {new Date(notification.createdAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>

                                {/* hover delete button */}
                                <button
                                    type="button"
                                    aria-label="Delete notification"
                                    title="Delete notification"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        deleteMutation.mutate(notification.id)
                                    }}
                                    className="absolute top-1.5 right-1.5 p-1 rounded-md text-[#8F8E8D] hover:text-white hover:bg-white/[0.08] opacity-0 group-hover/notif:opacity-100 transition-all duration-150 outline-none cursor-pointer"
                                >
                                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                </button>
                            </div>
                        ))}
                        {isFetchingNextPage && (
                            <div className="flex items-center justify-center py-1.5">
                                <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
