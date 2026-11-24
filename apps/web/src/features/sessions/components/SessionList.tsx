import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useSessionListMutations } from '../hooks/useSessionListMutations'
import { useInfiniteSessions, useSessions } from '../hooks/useSessions'

import { SessionListModals } from './SessionListModals'
import { SessionListView } from './SessionListView'

import type { DeleteModalState, RenameModalState } from '@/features/sessions/types'

import { useAppStore } from '@/app/store'
import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { generationAPI } from '@/features/generation/api/generation'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import {
    SERVER_FILTERS_REPO_AND_TAG,
    applySessionsView,
    collectSessionFacets,
    readSessionsView,
    sessionsViewFilters,
    writeSessionsView,
    type SessionsView,
} from '@/features/sessions/lib/sessionsView'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

/** ms after the last key before the search goes to the server */
const SEARCH_DELAY_MS = 250

/** a saved value stays in the list even before a session with it has loaded */
const withPicked = (values: string[], picked: string | null) =>
    picked && !values.includes(picked) ? [...values, picked].sort() : values

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
    // the list API is not ready for the Repository and Tag filters (see sessionsView.ts),
    // so these two rows of the menu only show with the preview flag (?demo) and then
    // filter the rows that are loaded
    const [canFilterRepoAndTag] = useState(
        () => SERVER_FILTERS_REPO_AND_TAG || isConnectionsDemoActive()
    )
    // the sort and filter menu. saved in the browser, like the sidebar Recent list
    const [view, setView] = useState<SessionsView>(() => {
        const saved = readSessionsView()
        return canFilterRepoAndTag ? saved : { ...saved, repo: null, tag: null }
    })
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
    const sessions = useMemo(() => data?.pages.flatMap((page) => page.sessions) || [], [data])
    const errorMessage = error instanceof Error ? error.message : null

    // repositories and tags seen so far fill the menu lists. kept across filter changes,
    // so a list does not shrink to the one value that is picked
    const [facets, setFacets] = useState<{ repos: string[]; tags: string[] }>({
        repos: [],
        tags: [],
    })
    const nextFacets = collectSessionFacets(sessions, facets)
    if (nextFacets !== facets) setFacets(nextFacets)
    const repoOptions = canFilterRepoAndTag ? withPicked(facets.repos, view.repo) : []
    const tagOptions = canFilterRepoAndTag ? withPicked(facets.tags, view.tag) : []

    const filtersOn =
        view.hasPr ||
        view.archived ||
        Boolean(view.repo) ||
        Boolean(view.tag) ||
        statusFilter !== 'all'
    const clearFilters = () => {
        changeView({ hasPr: false, archived: false, repo: null, tag: null })
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
        // the view again on loaded rows, so an archive or a new tag shows at once
        let result = applySessionsView(sessions, view)

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

        return result
    }, [sessions, searchQuery, view, statusFilter])

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
