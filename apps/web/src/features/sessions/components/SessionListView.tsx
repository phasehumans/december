import React from 'react'

import {
    ListEmptyState,
    ListErrorState,
    ListSearchInput,
    ListSwitch,
    ListToolbar,
    listActionButtonClass,
} from './ListParts'
import { SessionListRow } from './SessionListRow'
import { SessionListSkeleton } from './SessionListSkeleton'
import { SessionsViewMenu } from './SessionsViewMenu'

import type { SessionsView } from '@/features/sessions/lib/sessionsView'

import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { cn } from '@/shared/lib/utils'

type RowAction = (session: any, event?: React.MouseEvent) => void

interface SessionListViewProps {
    projects: any[]
    onOpenProject: (projectId: string) => void
    isInitialLoading: boolean
    /** a sort, filter or search is loading: the rows on screen are the old ones */
    isRefreshing?: boolean
    /** the list itself could not load */
    errorMessage: string | null
    onRetry?: () => void
    /** a rename, archive or delete failed */
    actionError: string | null
    menuOpenId: string | null
    onToggleMenu: (id: string, event: React.MouseEvent) => void
    onCloseMenu: () => void
    onToggleArchiveFromMenu: RowAction
    onOpenRename: RowAction
    onOpenDelete: RowAction
    onOpenTags: RowAction
    searchQuery: string
    onSearchChange: (query: string) => void
    /** the sort and the filters of the sort and filter menu */
    view: SessionsView
    onViewChange: (next: Partial<SessionsView>) => void
    /** values for the Repository and Tag lists in the menu. empty hides the row */
    repoOptions?: string[]
    tagOptions?: string[]
    /** a menu filter or Running is on */
    filtersOn?: boolean
    onClearFilters?: () => void
    /** set when every session is archived: the empty list then offers the archived view */
    onShowArchived?: () => void
    hasUnfilteredProjects: boolean
    statusFilter?: 'all' | 'running'
    onStatusFilterChange?: (filter: 'all' | 'running') => void
    runningCount?: number
    onStopSession?: (id: string, event?: React.MouseEvent) => void
}

export const SessionListView: React.FC<SessionListViewProps> = ({
    projects: sessions,
    onOpenProject,
    isInitialLoading,
    isRefreshing = false,
    errorMessage,
    onRetry,
    actionError,
    menuOpenId,
    onToggleMenu,
    onCloseMenu,
    onToggleArchiveFromMenu,
    onOpenRename,
    onOpenDelete,
    onOpenTags,
    searchQuery,
    onSearchChange,
    view,
    onViewChange,
    repoOptions = [],
    tagOptions = [],
    filtersOn = false,
    onClearFilters,
    onShowArchived,
    hasUnfilteredProjects: hasUnfilteredSessions,
    statusFilter,
    onStatusFilterChange,
    runningCount,
    onStopSession,
}) => {
    const hasSessions = sessions.length > 0
    // a load error with nothing to show replaces the list; other errors stay in the header
    const showLoadError = Boolean(errorMessage) && !hasSessions && !isInitialLoading
    const headerError = actionError ?? (showLoadError ? null : errorMessage)

    return (
        <>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-1">
                        Sessions
                    </h1>
                    <p className="text-[13px] text-[#7B7A79]">Manage and view all your sessions.</p>
                </div>
                {headerError && (
                    <div className="mt-1 flex justify-end">
                        <ErrorAlert message={headerError} />
                    </div>
                )}
            </div>

            <ListToolbar
                search={
                    <ListSearchInput
                        value={searchQuery}
                        onChange={onSearchChange}
                        placeholder="Search sessions..."
                    />
                }
            >
                {onStatusFilterChange && (
                    <ListSwitch
                        onLabel="Running"
                        isOn={statusFilter === 'running'}
                        onChange={(isOn) => onStatusFilterChange(isOn ? 'running' : 'all')}
                        count={runningCount}
                    />
                )}

                <div className="flex-1" />

                <SessionsViewMenu
                    view={view}
                    onChange={onViewChange}
                    repos={repoOptions}
                    tags={tagOptions}
                />
            </ListToolbar>

            {isInitialLoading ? (
                <SessionListSkeleton />
            ) : showLoadError ? (
                <ListErrorState message="Could not load sessions" onRetry={() => onRetry?.()} />
            ) : !hasUnfilteredSessions ? (
                <ListEmptyState title="No sessions yet">
                    {onShowArchived && (
                        <button
                            type="button"
                            onClick={onShowArchived}
                            className={listActionButtonClass}
                        >
                            Show archived
                        </button>
                    )}
                </ListEmptyState>
            ) : !hasSessions ? (
                <ListEmptyState art="noResults" title="No sessions found">
                    {filtersOn && onClearFilters && (
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className={listActionButtonClass}
                        >
                            Clear filters
                        </button>
                    )}
                </ListEmptyState>
            ) : (
                <div
                    aria-busy={isRefreshing || undefined}
                    className={cn(
                        'flex flex-col gap-1 pb-4 transition-opacity',
                        // dims only when the rows take a moment, so a quick switch shows no change
                        isRefreshing
                            ? 'opacity-50 duration-200 delay-200'
                            : 'opacity-100 duration-150'
                    )}
                >
                    {sessions.map((session) => (
                        <SessionListRow
                            key={session.id}
                            project={session}
                            isMenuOpen={menuOpenId === session.id}
                            onOpenProject={onOpenProject}
                            onToggleMenu={onToggleMenu}
                            onCloseMenu={onCloseMenu}
                            onToggleArchiveFromMenu={onToggleArchiveFromMenu}
                            onOpenRename={onOpenRename}
                            onOpenDelete={onOpenDelete}
                            onOpenTags={onOpenTags}
                            onStopSession={onStopSession}
                            timeField={view.sort === 'updated' ? 'updated' : 'created'}
                            dimArchived={!view.archived}
                        />
                    ))}
                </div>
            )}
        </>
    )
}
