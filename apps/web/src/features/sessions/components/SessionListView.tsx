import React from 'react'

import { ListEmptyState, ListErrorState, ListSearchInput, ListToolbar } from './ListParts'
import { type SortOption } from './SessionList'
import { SessionListRow } from './SessionListRow'
import { SessionListSkeleton } from './SessionListSkeleton'

import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'

type RowAction = (session: any, event?: React.MouseEvent) => void

interface SessionListViewProps {
    projects: any[]
    onOpenProject: (projectId: string) => void
    isInitialLoading: boolean
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
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
    hasUnfilteredProjects: boolean
    statusFilter?: 'all' | 'running'
    onStatusFilterChange?: (filter: 'all' | 'running') => void
    runningCount?: number
    onStopSession?: (id: string, event?: React.MouseEvent) => void
}

const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
}

const segmentClass = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all ${
        active ? 'bg-[#282828] text-white shadow-sm' : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
    }`

export const SessionListView: React.FC<SessionListViewProps> = ({
    projects: sessions,
    onOpenProject,
    isInitialLoading,
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
    sortOption,
    onSortChange,
    hasUnfilteredProjects: hasUnfilteredSessions,
    statusFilter,
    onStatusFilterChange,
    runningCount,
    onStopSession,
}) => {
    const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
    const [dropdownDirection, setDropdownDirection] = React.useState<'down' | 'up'>('down')
    const sortDropdownRef = React.useRef<HTMLDivElement>(null)

    const toggleDropdown = (type: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (activeDropdown === type) {
            setActiveDropdown(null)
            return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        if (window.innerHeight - rect.bottom < 250 && rect.top > 250) {
            setDropdownDirection('up')
        } else {
            setDropdownDirection('down')
        }
        setActiveDropdown(type)
    }

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                sortDropdownRef.current &&
                !sortDropdownRef.current.contains(event.target as Node)
            ) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

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
                    <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-lg border border-[#282828] shrink-0">
                        <button
                            type="button"
                            onClick={() => onStatusFilterChange('all')}
                            className={segmentClass(statusFilter === 'all')}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => onStatusFilterChange('running')}
                            className={segmentClass(statusFilter === 'running')}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Running</span>
                            {runningCount !== undefined && runningCount > 0 && (
                                <span
                                    className={`text-[11.5px] tabular-nums ${
                                        statusFilter === 'running'
                                            ? 'text-[#949494]'
                                            : 'text-[#6B6A69]'
                                    }`}
                                >
                                    {runningCount}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                <div className="flex-1" />

                {/* sort dropdown */}
                <div className="relative shrink-0" ref={sortDropdownRef}>
                    <button
                        type="button"
                        onClick={(e) => toggleDropdown('sort', e)}
                        className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[#282828] hover:border-[#3A3A3A] bg-[#202020] px-2.5 sm:px-4 py-1.5 font-sans text-[12px] sm:text-[13px] text-[#949494] hover:text-[#EDEDED] transition-colors"
                    >
                        <span className="hidden sm:inline">Sort:</span> {SORT_LABELS[sortOption]}{' '}
                        <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                    </button>
                    {activeDropdown === 'sort' && (
                        <div
                            className={`absolute right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} z-50 w-48 rounded-xl border border-[#383736] bg-[#1E1E1E] py-2 shadow-xl`}
                        >
                            <div className="mb-1 border-b border-[#383736] px-3 pb-2 font-sans text-[11px] font-medium uppercase tracking-wider text-[#7B7A79]">
                                Sort by
                            </div>
                            {(['newest', 'oldest'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        onSortChange(option)
                                        setActiveDropdown(null)
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-1.5 font-sans text-[13px] text-[#D6D5C9] hover:bg-[#242323]"
                                >
                                    {option === 'newest' ? 'Newest first' : 'Oldest first'}
                                    {sortOption === option && <Icons.Check className="h-4 w-4" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </ListToolbar>

            {isInitialLoading ? (
                <SessionListSkeleton />
            ) : showLoadError ? (
                <ListErrorState message="Could not load sessions." onRetry={() => onRetry?.()} />
            ) : !hasUnfilteredSessions ? (
                <ListEmptyState title="No sessions yet" />
            ) : !hasSessions ? (
                <ListEmptyState title="No sessions found" />
            ) : (
                <div className="flex flex-col gap-1 pb-4">
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
                        />
                    ))}
                </div>
            )}
        </>
    )
}
