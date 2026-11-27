import { useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { useAppStore } from '@/app/store'
import { generationAPI } from '@/features/generation/api/generation'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import { useGitlabConnection } from '@/features/profile/hooks/useGitlabConnection'
import { PullRequestListRow } from '@/features/pullrequests/components/PullRequestListRow'
import { useInfinitePullRequests } from '@/features/pullrequests/hooks/usePullRequests'
import {
    GIT_HOST_LABELS,
    pullRequestRowAsSession,
    toPullRequestRows,
    type PullRequestRow,
} from '@/features/pullrequests/lib/pullRequests'
import {
    activePullRequestFilters,
    pullRequestsViewParams,
    readPullRequestsView,
    writePullRequestsView,
    type PullRequestsView,
} from '@/features/pullrequests/lib/pullRequestsView'
import {
    ListEmptyState,
    ListErrorState,
    ListRowsSkeleton,
    ListSearchInput,
    ListSwitch,
    ListToolbar,
    listActionButtonClass,
} from '@/features/sessions/components/ListParts'
import { useArchiveConfirm } from '@/features/sessions/components/SessionArchiveModal'
import { SessionDeleteModal } from '@/features/sessions/components/SessionDeleteModal'
import { ArchivedUndoLine } from '@/features/sessions/components/SessionListView'
import { SessionTagsModal } from '@/features/sessions/components/SessionTagsModal'
import { ViewMenu } from '@/features/sessions/components/ViewMenu'
import { ARCHIVE_UNDO_MS } from '@/features/sessions/hooks/useSessionActions'
import { useSessionListMutations } from '@/features/sessions/hooks/useSessionListMutations'
import { useSessionCounts, useSessionFacets } from '@/features/sessions/hooks/useSessions'
import {
    SESSIONS_SORT_OPTIONS,
    shortRepoName,
    withPicked,
} from '@/features/sessions/lib/sessionsView'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

/** ms after the last key before the search goes to the server */
const SEARCH_DELAY_MS = 250

/** the archive dialog line here: an open pull request leaves this list (D1-b) */
const ARCHIVE_LINE =
    'It leaves this list while the pull request is open. Unarchive it on the Sessions page.'

interface PullRequestsPageProps {
    onOpenProject: (sessionId: string) => void
}

/** pull requests that December opened, across all sessions */
export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({ onOpenProject }) => {
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)

    const github = useGithubConnection(isAuthenticated)
    const gitlab = useGitlabConnection(isAuthenticated)
    // the All | Open switch next to search
    const [onlyOpen, setOnlyOpen] = React.useState(false)
    // the sort and filter menu. saved in the browser, like the Sessions page
    const [view, setView] = React.useState<PullRequestsView>(readPullRequestsView)
    const [query, setQuery] = React.useState('')
    // the server search waits until typing stops, so each letter does not send a request
    const [serverSearch, setServerSearch] = React.useState('')
    React.useEffect(() => {
        const timer = setTimeout(() => setServerSearch(query.trim()), SEARCH_DELAY_MS)
        return () => clearTimeout(timer)
    }, [query])

    // the server filters, sorts and pages, so the view also covers rows not loaded yet
    const params = React.useMemo(
        () => pullRequestsViewParams(view, onlyOpen, serverSearch),
        [view, onlyOpen, serverSearch]
    )
    const {
        data,
        isLoading,
        isPlaceholderData,
        error,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
    } = useInfinitePullRequests(params)
    // a sort, filter or search is waiting for its rows: the old rows stay on screen
    const isSwitching = isPlaceholderData || query.trim() !== serverSearch

    const changeView = (next: Partial<PullRequestsView>) => {
        const merged = { ...view, ...next }
        setView(merged)
        writePullRequestsView(merged)
        // Merged or Closed with the switch on Open would always be empty
        if (merged.merged || merged.closed) setOnlyOpen(false)
    }
    const pickOnlyOpen = (isOn: boolean) => {
        setOnlyOpen(isOn)
        if (isOn && (view.merged || view.closed)) {
            const withoutStates = { ...view, merged: false, closed: false }
            setView(withoutStates)
            writePullRequestsView(withoutStates)
        }
    }

    const rows = React.useMemo(
        () => toPullRequestRows(data?.pages.flatMap((page) => page.pullRequests) || []),
        [data]
    )
    // every open pull request of the user, not only the loaded rows (archived left out).
    // the first page brings the count read with its rows, so the switch agrees with them
    // after the server reads new states from the host; the counts query is the fallback
    const { data: counts } = useSessionCounts()
    const countsClient = useQueryClient()
    const listOpenCount = data?.pages[0]?.openCount
    const openCount = listOpenCount ?? counts?.openPullRequests
    const countsOpen = counts?.openPullRequests
    React.useEffect(() => {
        // the shared counts (the sidebar, Home) are behind the list: read them again
        if (listOpenCount != null && countsOpen != null && listOpenCount !== countsOpen) {
            void countsClient.invalidateQueries({ queryKey: ['sessions', 'counts'], exact: true })
        }
    }, [listOpenCount, countsOpen, countsClient])
    // every repository and tag of the sessions that opened a pull request, also from
    // rows that are not loaded
    const { data: facets } = useSessionFacets({ hasPr: true })
    const activeFilters = activePullRequestFilters(view)
    const filtersOn = onlyOpen || activeFilters.length > 0
    const clearFilters = () => {
        changeView({ merged: false, closed: false, repo: null, tag: null })
        setOnlyOpen(false)
    }
    // a filter or a search is on, or its rows are on the way: an empty list then means
    // "none found", not "none yet"
    const isNarrowed = filtersOn || Boolean(query.trim()) || isSwitching
    // with Newest or Oldest the row shows the created time, like the Sessions rows
    const showCreated = view.sort !== 'updated'

    const openSession = (sessionId: string) => {
        // the session opens on its pull request view
        requestWorkspaceTab('pull_requests')
        onOpenProject(sessionId)
    }

    // the row menu and its dialogs, the same as the Sessions page rows
    const queryClient = useQueryClient()
    const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null)
    const closeMenu = React.useCallback(() => setMenuOpenId(null), [])
    const toggleMenu = (sessionId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        setMenuOpenId((open) => (open === sessionId ? null : sessionId))
    }
    const [actionError, setActionError] = React.useState<string | null>(null)
    const [deleteRow, setDeleteRow] = React.useState<PullRequestRow | null>(null)
    const [tagsRow, setTagsRow] = React.useState<PullRequestRow | null>(null)
    const { confirmArchive, archiveModal } = useArchiveConfirm(ARCHIVE_LINE)
    const { toggleArchiveMutation, deleteMutation, updateTagsMutation } = useSessionListMutations({
        setActionError,
        // there is no rename on this page
        onRenameMutate: () => undefined,
        onDeleteMutate: () => setDeleteRow(null),
    })

    // an archived open pull request leaves the list: "Archived · Undo" holds its place for
    // a few seconds (D2). a merged or closed row stays, and its menu then says Unarchive
    const [archivedUndo, setArchivedUndo] = React.useState<{
        row: PullRequestRow
        index: number
    } | null>(null)
    const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(
        () => () => {
            if (undoTimer.current) clearTimeout(undoTimer.current)
        },
        []
    )
    const clearUndo = () => {
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = null
        setArchivedUndo(null)
    }

    const toggleArchive = (row: PullRequestRow, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        if (row.isArchived) {
            toggleArchiveMutation.mutate({ sessionId: row.sessionId, isArchived: false })
            return
        }
        confirmArchive(() => {
            const leavesList = row.state === 'open' || row.state === 'draft'
            toggleArchiveMutation.mutate(
                { sessionId: row.sessionId, isArchived: true },
                // a failed archive keeps the row: the undo line goes, the error shows
                { onError: () => clearUndo() }
            )
            if (!leavesList) return
            if (undoTimer.current) clearTimeout(undoTimer.current)
            const index = rows.findIndex((r) => r.sessionId === row.sessionId)
            setArchivedUndo({ row, index: Math.max(0, index) })
            undoTimer.current = setTimeout(() => setArchivedUndo(null), ARCHIVE_UNDO_MS)
        })
    }
    const undoArchive = () => {
        if (!archivedUndo) return
        toggleArchiveMutation.mutate({ sessionId: archivedUndo.row.sessionId, isArchived: false })
        clearUndo()
    }

    const openTags = (row: PullRequestRow, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        setTagsRow(row)
    }
    const openDelete = (row: PullRequestRow, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        setDeleteRow(row)
    }
    const stopSession = (sessionId: string, event?: React.MouseEvent) => {
        event?.stopPropagation()
        setMenuOpenId(null)
        generationAPI.stopSessionStream(sessionId)
        void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }

    // the archived open row is out of the list while its undo line shows
    const shownRows = archivedUndo
        ? rows.filter((row) => row.sessionId !== archivedUndo.row.sessionId)
        : rows
    const undoAt = archivedUndo ? Math.min(archivedUndo.index, shownRows.length) : -1
    const undoLine = <ArchivedUndoLine onUndo={undoArchive} />

    // a user with GitLab connected has a host: only a user with neither is asked to connect.
    // it goes by the filters and the search box, not by rows on the way: a new sort keeps
    // this state on screen while its rows load, instead of a short "No pull requests found"
    const needsGithub =
        github.isReady &&
        gitlab.isReady &&
        !github.isConnected &&
        !gitlab.isConnected &&
        rows.length === 0 &&
        !filtersOn &&
        !query.trim()

    const scrollRef = React.useRef<HTMLDivElement>(null)
    // near the end of the loaded rows: the next 30 load. a failed page waits for a scroll,
    // so it is not asked again in a loop
    const loadMoreIfNearEnd = React.useCallback(() => {
        const target = scrollRef.current
        if (
            target &&
            target.scrollHeight - target.scrollTop - target.clientHeight < 150 &&
            hasNextPage &&
            !isFetchingNextPage &&
            !isPlaceholderData
        ) {
            void fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage])
    // on a tall screen the first rows can fit with no scroll bar, so no scroll comes: the
    // next page loads when the rows end on screen
    React.useEffect(() => {
        if (!isFetchNextPageError) loadMoreIfNearEnd()
    }, [data, isFetchNextPageError, loadMoreIfNearEnd])

    return (
        <div
            ref={scrollRef}
            className="relative h-full w-full flex-1 overflow-y-auto bg-background font-sans no-scrollbar"
            onScroll={loadMoreIfNearEnd}
        >
            {/* the page heading below says Pull requests, so the bar only holds the menu */}
            <MobileTopBar />

            <div className="relative z-10 mx-auto max-w-6xl px-3.5 sm:px-6 pb-8 pt-4 md:p-16 flex flex-col">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-1">
                            Pull requests
                        </h1>
                        <p className="text-[13px] text-[#7B7A79]">
                            View all pull requests opened from your sessions.
                        </p>
                    </div>
                    {/* a failed archive, delete or tag save, like the Sessions page */}
                    {actionError && (
                        <div className="mt-1 flex justify-end">
                            <ErrorAlert message={actionError} />
                        </div>
                    )}
                </div>

                <ListToolbar
                    search={
                        <ListSearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search pull requests..."
                        />
                    }
                >
                    <ListSwitch
                        onLabel="Open"
                        isOn={onlyOpen}
                        onChange={pickOnlyOpen}
                        count={openCount}
                    />

                    <div className="flex-1" />

                    <ViewMenu
                        sorts={SESSIONS_SORT_OPTIONS}
                        sort={view.sort}
                        onSort={(sort) => changeView({ sort })}
                        activeFilters={activeFilters}
                        toggles={[
                            {
                                key: 'merged',
                                label: 'Merged',
                                checked: view.merged,
                                onToggle: () => changeView({ merged: !view.merged }),
                            },
                            {
                                key: 'closed',
                                label: 'Closed',
                                checked: view.closed,
                                onToggle: () => changeView({ closed: !view.closed }),
                            },
                        ]}
                        lists={[
                            {
                                key: 'repo',
                                label: 'Repository',
                                value: view.repo,
                                options: withPicked(facets?.repos ?? [], view.repo).map((repo) => ({
                                    value: repo,
                                    label: shortRepoName(repo),
                                })),
                                onPick: (repo) => changeView({ repo }),
                            },
                            {
                                key: 'tag',
                                label: 'Tag',
                                value: view.tag,
                                options: withPicked(facets?.tags ?? [], view.tag).map((tag) => ({
                                    value: tag,
                                    label: tag,
                                })),
                                onPick: (tag) => changeView({ tag }),
                            },
                        ]}
                    />
                </ListToolbar>

                {/* ?skeleton shows the loading rows, like the Sessions page */}
                {isLoading || isSkeletonPreviewActive() ? (
                    <ListRowsSkeleton rows={4} />
                ) : error && rows.length === 0 ? (
                    <ListErrorState
                        message="Could not load pull requests"
                        onRetry={() => void refetch()}
                    />
                ) : needsGithub ? (
                    <ListEmptyState art="connect" title="Connect GitHub to see pull requests">
                        <a href={github.connectUrl} className={listActionButtonClass}>
                            Connect GitHub
                        </a>
                    </ListEmptyState>
                ) : shownRows.length === 0 && !archivedUndo ? (
                    <ListEmptyState
                        art={isNarrowed ? 'noResults' : 'pullRequests'}
                        title={isNarrowed ? 'No pull requests found' : 'No pull requests yet'}
                    >
                        {filtersOn && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className={listActionButtonClass}
                            >
                                Clear filters
                            </button>
                        )}
                    </ListEmptyState>
                ) : (
                    <div
                        aria-busy={isSwitching || undefined}
                        className={cn(
                            'flex flex-col gap-1 pb-4 transition-opacity',
                            // dims only when the rows take a moment, like the Sessions page
                            isSwitching
                                ? 'opacity-50 duration-200 delay-200'
                                : 'opacity-100 duration-150'
                        )}
                    >
                        {shownRows.map((row, index) => (
                            <React.Fragment key={row.sessionId}>
                                {undoAt === index && undoLine}
                                <PullRequestListRow
                                    row={row}
                                    isMenuOpen={menuOpenId === row.sessionId}
                                    onOpen={openSession}
                                    onToggleMenu={toggleMenu}
                                    onCloseMenu={closeMenu}
                                    onToggleArchive={toggleArchive}
                                    onTags={openTags}
                                    onDelete={openDelete}
                                    onStop={stopSession}
                                    showCreated={showCreated}
                                />
                            </React.Fragment>
                        ))}
                        {undoAt >= shownRows.length && undoLine}
                    </div>
                )}
            </div>

            <SessionDeleteModal
                isOpen={deleteRow !== null}
                isPending={deleteMutation.isPending}
                description={
                    deleteRow
                        ? `Its sandbox stops. The pull request on ${GIT_HOST_LABELS[deleteRow.gitProvider]} stays. You cannot undo this.`
                        : undefined
                }
                onClose={() => setDeleteRow(null)}
                onConfirm={() => {
                    if (deleteRow) deleteMutation.mutate(deleteRow.sessionId)
                }}
            />
            <SessionTagsModal
                isOpen={tagsRow !== null}
                session={tagsRow ? pullRequestRowAsSession(tagsRow) : null}
                isPending={updateTagsMutation.isPending}
                onClose={() => setTagsRow(null)}
                onSave={(tags) => {
                    if (!tagsRow) return
                    updateTagsMutation.mutate(
                        { sessionId: tagsRow.sessionId, tags },
                        { onSuccess: () => setTagsRow(null) }
                    )
                }}
            />
            {archiveModal}
        </div>
    )
}
