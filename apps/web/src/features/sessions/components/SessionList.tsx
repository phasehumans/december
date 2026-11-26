import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { ARCHIVE_UNDO_MS } from '../hooks/useSessionActions'
import { useSessionListMutations } from '../hooks/useSessionListMutations'
import {
    useInfiniteSessions,
    useSessionCounts,
    useSessionFacets,
    useSessions,
} from '../hooks/useSessions'

import { useArchiveConfirm } from './SessionArchiveModal'
import { SessionListModals } from './SessionListModals'
import { SessionListView } from './SessionListView'

import type { DeleteModalState, RenameModalState } from '@/features/sessions/types'

import { useAppStore } from '@/app/store'
import { generationAPI } from '@/features/generation/api/generation'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import {
    applySessionsView,
    readSessionsView,
    sessionsViewFilters,
    withPicked,
    writeSessionsView,
    type SessionsView,
} from '@/features/sessions/lib/sessionsView'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

/** ms after the last key before the search goes to the server */
const SEARCH_DELAY_MS = 250

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
    // the server search waits until typing stops, so each letter does not send a request
    const [serverSearch, setServerSearch] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => setServerSearch(searchQuery.trim()), SEARCH_DELAY_MS)
        return () => clearTimeout(timer)
    }, [searchQuery])
    // the sort and filter menu. saved in the browser, like the sidebar Recent list
    const [view, setView] = useState<SessionsView>(readSessionsView)
    const changeView = (next: Partial<SessionsView>) => {
        const merged = { ...view, ...next }
        setView(merged)
        writeSessionsView(merged)
    }
    const [statusFilter, setStatusFilter] = useState<'all' | 'running'>('all')
    const queryClient = useQueryClient()

    const queryFilters = useMemo(() => {
        return {
            search: serverSearch || undefined,
            // the server sorts and filters, so the view also covers rows not loaded yet
            ...sessionsViewFilters(view),
            vmStatus: statusFilter === 'running' ? ('running' as const) : undefined,
        }
    }, [serverSearch, view, statusFilter])

    const {
        data,
        isLoading,
        isPlaceholderData,
        error,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteSessions(queryFilters)
    // a sort, filter or search is waiting for its rows: the old rows stay on screen
    const isSwitching = isPlaceholderData || searchQuery.trim() !== serverSearch
    // pages are read by offset: a row that moved while the user scrolled can come twice
    const sessions = useMemo(() => {
        const seen = new Set<string>()
        return (data?.pages.flatMap((page) => page.sessions) || []).filter((session) => {
            if (seen.has(session.id)) return false
            seen.add(session.id)
            return true
        })
    }, [data])
    const errorMessage = error instanceof Error ? error.message : null

    // every repository and tag of the user fills the menu lists, also from sessions that
    // are not loaded. the server filters by them (#641)
    const { data: facets } = useSessionFacets()
    const repoOptions = withPicked(facets?.repos ?? [], view.repo)
    const tagOptions = withPicked(facets?.tags ?? [], view.tag)

    const filtersOn =
        view.hasPr ||
        view.needsAnswer ||
        view.archived ||
        Boolean(view.repo) ||
        Boolean(view.tag) ||
        statusFilter !== 'all'
    const clearFilters = () => {
        changeView({ hasPr: false, needsAnswer: false, archived: false, repo: null, tag: null })
        setStatusFilter('all')
    }

    // archived sessions stay out of the list. when nothing else exists, the empty list
    // offers the archived view instead of only "No sessions yet"
    const isPlainListEmpty =
        !isLoading &&
        !isSwitching &&
        !error &&
        sessions.length === 0 &&
        !searchQuery.trim() &&
        !filtersOn
    const { data: archivedProbe } = useSessions(
        { isArchived: true, limit: 1 },
        { enabled: isPlainListEmpty }
    )
    const hasOnlyArchived = isPlainListEmpty && (archivedProbe?.sessions.length ?? 0) > 0
    const [renameModal, setRenameModal] = useState<RenameModalState>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        project: null,
    })
    const { confirmArchive, archiveModal } = useArchiveConfirm()
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

    const {
        toggleArchiveMutation,
        togglePinMutation,
        renameMutation,
        deleteMutation,
        updateTagsMutation,
    } = useSessionListMutations({
        setActionError,
        onRenameMutate: () => setRenameModal({ isOpen: false, project: null, value: '' }),
        onDeleteMutate: () => setDeleteModal({ isOpen: false, project: null }),
    })

    // every running session of the user, not only the loaded rows (archived left out)
    const { data: counts } = useSessionCounts()
    const runningCount = counts?.running

    const filteredAndSortedSessions = useMemo(() => {
        // the view again on loaded rows, so an archive or a new tag shows at once
        let result = applySessionsView(sessions, view)

        // no search here: the server matches the title and every message, the rows only
        // carry the newest message

        // status filter
        if (statusFilter === 'running') {
            result = result.filter(
                (session) => session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'
            )
        }

        return result
    }, [sessions, view, statusFilter])

    // the rows shown before a switch. while the new rows load, a filter that the old rows
    // do not match (Archived, say) keeps these on screen, instead of "No sessions found"
    // for a moment
    const [lastShown, setLastShown] = useState<typeof filteredAndSortedSessions>([])
    if (!isSwitching && lastShown !== filteredAndSortedSessions) {
        setLastShown(filteredAndSortedSessions)
    }
    const shownSessions =
        isSwitching && filteredAndSortedSessions.length === 0
            ? lastShown
            : filteredAndSortedSessions

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

    // archive leaves "Archived · Undo" in place of the row for a few seconds, like the
    // sidebar Recent list (A1). unarchive in the Archived view leaves no line
    const [archivedUndo, setArchivedUndo] = useState<{ session: any; index: number } | null>(null)
    const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(
        () => () => {
            if (undoTimer.current) clearTimeout(undoTimer.current)
        },
        []
    )

    const toggleArchiveFromMenu = (session: any, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        if (session.isArchived) {
            toggleArchiveMutation.mutate({ sessionId: session.id, isArchived: false })
            return
        }
        // asks first; the undo line still shows after the archive
        confirmArchive(() => {
            toggleArchiveMutation.mutate({ sessionId: session.id, isArchived: true })
            if (undoTimer.current) clearTimeout(undoTimer.current)
            const index = shownSessions.findIndex((s) => s.id === session.id)
            setArchivedUndo({ session, index: Math.max(0, index) })
            undoTimer.current = setTimeout(() => setArchivedUndo(null), ARCHIVE_UNDO_MS)
        })
    }

    const undoArchive = () => {
        if (!archivedUndo) return
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = null
        toggleArchiveMutation.mutate({
            sessionId: archivedUndo.session.id,
            isArchived: false,
            restorePinnedAt: archivedUndo.session.pinnedAt,
        })
        setArchivedUndo(null)
    }

    // where the line goes: where the row was, once the row has left the list
    const undoAt =
        archivedUndo && !shownSessions.some((s) => s.id === archivedUndo.session.id)
            ? Math.min(archivedUndo.index, shownSessions.length)
            : -1

    const togglePinFromMenu = (session: any, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        togglePinMutation.mutate({ sessionId: session.id, isPinned: !session.isPinned })
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
                    !isFetchingNextPage &&
                    !isPlaceholderData
                ) {
                    fetchNextPage()
                }
            }}
        >
            {/* the page heading below says Sessions, so the bar only holds the menu */}
            <MobileTopBar />
            <div className="relative z-10 mx-auto max-w-6xl px-3.5 sm:px-6 pb-8 pt-4 md:p-16">
                <SessionListView
                    projects={shownSessions}
                    onOpenProject={handleOpenProjectClick}
                    isInitialLoading={isInitialLoading}
                    isRefreshing={isSwitching}
                    errorMessage={errorMessage}
                    onRetry={() => void refetch()}
                    actionError={actionError}
                    menuOpenId={menuOpenId}
                    onToggleMenu={toggleMenu}
                    onCloseMenu={closeMenu}
                    onToggleArchiveFromMenu={toggleArchiveFromMenu}
                    archivedUndo={undoAt >= 0 ? { index: undoAt, onUndo: undoArchive } : null}
                    onTogglePinFromMenu={togglePinFromMenu}
                    onOpenRename={openRenameModal}
                    onOpenDelete={openDeleteModal}
                    onOpenTags={openTagsModal}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    view={view}
                    onViewChange={changeView}
                    repoOptions={repoOptions}
                    tagOptions={tagOptions}
                    filtersOn={filtersOn}
                    onClearFilters={clearFilters}
                    onShowArchived={
                        hasOnlyArchived ? () => changeView({ archived: true }) : undefined
                    }
                    hasUnfilteredProjects={
                        // while a switch loads it is not known yet, so "No sessions yet"
                        // does not flash when a search is cleared
                        sessions.length > 0 ||
                        Boolean(searchQuery.trim()) ||
                        filtersOn ||
                        isSwitching
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
                onCloseTags={() => setTagsModal({ isOpen: false, project: null })}
                onSaveTags={handleSaveTags}
            />
            {archiveModal}
        </div>
    )
}
