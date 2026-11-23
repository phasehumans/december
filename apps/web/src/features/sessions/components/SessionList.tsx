import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useSessionListMutations } from '../hooks/useSessionListMutations'
import { useInfiniteSessions } from '../hooks/useSessions'

import { SessionListModals } from './SessionListModals'
import { SessionListView } from './SessionListView'

import type { DeleteModalState, RenameModalState } from '@/features/sessions/types'

import { useAppStore } from '@/app/store'
import { generationAPI } from '@/features/generation/api/generation'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

export type SortOption = 'newest' | 'oldest'

export const SessionList: React.FC<{
    onOpenProject: (projectId: string) => void
}> = ({ onOpenProject }) => {
    const navigate = useNavigate()
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const isAuthRestored = useAppStore((s) => s.isAuthRestored)

    useEffect(() => {
        if (isAuthRestored && !isAuthenticated) {
            navigate('/', { replace: true })
        }
    }, [isAuthRestored, isAuthenticated, navigate])

    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('newest')
    const [statusFilter, setStatusFilter] = useState<'all' | 'running'>('all')
    const queryClient = useQueryClient()

    const queryFilters = useMemo(() => {
        return {
            search: searchQuery.trim() || undefined,
            sortBy: 'updatedAt' as const,
            sortOrder: sortOption === 'newest' ? ('desc' as const) : ('asc' as const),
            // the server filters running sessions, so the filter also covers rows not loaded yet
            vmStatus: statusFilter === 'running' ? ('running' as const) : undefined,
        }
    }, [searchQuery, sortOption, statusFilter])

    const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInfiniteSessions(queryFilters)
    const sessions = useMemo(() => data?.pages.flatMap((page) => page.sessions) || [], [data])
    const errorMessage = error instanceof Error ? error.message : null
    const [renameModal, setRenameModal] = useState<RenameModalState>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        project: null,
    })
    const [openConfirmModal, setOpenConfirmModal] = useState<{
        isOpen: boolean
        project: any | null
    }>({
        isOpen: false,
        project: null,
    })
    const [tagsModal, setTagsModal] = useState<{
        isOpen: boolean
        project: any | null
    }>({
        isOpen: false,
        project: null,
    })
    const [actionError, setActionError] = useState<string | null>(null)
    const isInitialLoading = (isLoading && sessions.length === 0) || isSkeletonPreviewActive()

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null)
        if (menuOpenId) window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [menuOpenId])

    const { toggleArchiveMutation, renameMutation, deleteMutation, updateTagsMutation } =
        useSessionListMutations({
            setActionError,
            onRenameMutate: () => setRenameModal({ isOpen: false, project: null, value: '' }),
            onDeleteMutate: () => setDeleteModal({ isOpen: false, project: null }),
        })

    const runningCount = useMemo(() => {
        return sessions.filter((s) => s.vmStatus === 'RUNNING' || s.vmStatus === 'PROVISIONING')
            .length
    }, [sessions])

    const filteredAndSortedSessions = useMemo(() => {
        let result = [...sessions]

        // search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(
                (session) =>
                    (session.title || '').toLowerCase().includes(query) ||
                    (session.projectName || '').toLowerCase().includes(query) ||
                    (session.lastMessage || '').toLowerCase().includes(query)
            )
        }

        // status filter
        if (statusFilter === 'running') {
            result = result.filter(
                (session) => session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'
            )
        }

        // sort
        result.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime()
            const dateB = new Date(b.updatedAt || b.createdAt).getTime()
            return sortOption === 'newest' ? dateB - dateA : dateA - dateB
        })

        return result
    }, [sessions, searchQuery, sortOption, statusFilter])

    const handleStopSession = (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        generationAPI.stopSessionStream(id)
        void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }

    const toggleMenu = (id: string, event: React.MouseEvent) => {
        event.stopPropagation()
        setMenuOpenId((prev) => (prev === id ? null : id))
    }

    const closeMenu = useCallback(() => setMenuOpenId(null), [])

    const toggleArchiveFromMenu = (session: any, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        toggleArchiveMutation.mutate({ sessionId: session.id, isArchived: !session.isArchived })
    }

    const openModal = (event: React.MouseEvent | undefined, setter: () => void) => {
        event?.stopPropagation()
        setter()
        setMenuOpenId(null)
    }

    const openRenameModal = (session: any, event?: React.MouseEvent) =>
        openModal(event, () =>
            setRenameModal({ isOpen: true, project: session, value: session.title || '' })
        )

    const openDeleteModal = (session: any, event?: React.MouseEvent) =>
        openModal(event, () => setDeleteModal({ isOpen: true, project: session }))

    const openTagsModal = (session: any, event?: React.MouseEvent) =>
        openModal(event, () => setTagsModal({ isOpen: true, project: session }))

    const handleSaveTags = (tags: string[]) => {
        if (!tagsModal.project) return
        updateTagsMutation.mutate(
            { sessionId: tagsModal.project.id, tags },
            {
                onSuccess: () => {
                    setTagsModal({ isOpen: false, project: null })
                },
            }
        )
    }

    const handleRename = (event: React.FormEvent) => {
        event.preventDefault()
        if (!renameModal.project || !renameModal.value.trim()) return
        renameMutation.mutate({
            sessionId: renameModal.project.id,
            rename: renameModal.value.trim(),
        })
    }

    const handleDelete = () => {
        if (!deleteModal.project) return
        deleteMutation.mutate(deleteModal.project.id)
    }

    const handleOpenProjectClick = (id: string) => {
        onOpenProject(id)
    }

    const handleOpenConfirm = () => {
        if (openConfirmModal.project) {
            onOpenProject(openConfirmModal.project.id)
            setOpenConfirmModal({ isOpen: false, project: null })
        }
    }

    if (!isAuthRestored || !isAuthenticated) {
        return null
    }

    return (
        <div
            className="relative h-full w-full flex-1 overflow-y-auto bg-background font-sans no-scrollbar"
            onScroll={(e) => {
                const target = e.currentTarget
                if (
                    target.scrollHeight - target.scrollTop - target.clientHeight < 150 &&
                    hasNextPage &&
                    !isFetchingNextPage
                ) {
                    fetchNextPage()
                }
            }}
        >
            {/* the page heading below says Sessions, so the bar only holds the menu */}
            <MobileTopBar />
            <div className="relative z-10 mx-auto max-w-6xl px-3.5 sm:px-6 pb-8 pt-4 md:p-16">
                <SessionListView
                    projects={filteredAndSortedSessions}
                    onOpenProject={handleOpenProjectClick}
                    isInitialLoading={isInitialLoading}
                    errorMessage={errorMessage}
                    onRetry={() => void refetch()}
                    actionError={actionError}
                    menuOpenId={menuOpenId}
                    onToggleMenu={toggleMenu}
                    onCloseMenu={closeMenu}
                    onToggleArchiveFromMenu={toggleArchiveFromMenu}
                    onOpenRename={openRenameModal}
                    onOpenDelete={openDeleteModal}
                    onOpenTags={openTagsModal}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    hasUnfilteredProjects={
                        sessions.length > 0 || Boolean(searchQuery.trim()) || statusFilter !== 'all'
                    }
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    runningCount={runningCount}
                    onStopSession={handleStopSession}
                />
            </div>

            <SessionListModals
                renameModal={renameModal}
                deleteModal={deleteModal}
                openConfirmModal={openConfirmModal}
                tagsModal={tagsModal}
                isRenamePending={renameMutation.isPending}
                isDeletePending={deleteMutation.isPending}
                isTagsPending={updateTagsMutation.isPending}
                onCloseRename={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                onRenameChange={(nextValue) =>
                    setRenameModal((prev) => ({ ...prev, value: nextValue }))
                }
                onRenameSubmit={handleRename}
                onCloseDelete={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                onDeleteConfirm={handleDelete}
                onCloseOpenConfirm={() => setOpenConfirmModal({ isOpen: false, project: null })}
                onOpenConfirm={handleOpenConfirm}
                onCloseTags={() => setTagsModal({ isOpen: false, project: null })}
                onSaveTags={handleSaveTags}
            />
        </div>
    )
}
