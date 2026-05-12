import React from 'react'

import { ProjectListRow } from './ProjectListRow'

import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Icons } from '@/shared/components/ui/Icons'
import type { Project } from '@/features/projects/types'
import type { SortOption, StatusFilter } from './ProjectList'

interface ProjectListViewProps {
    projects: Project[]
    onNewProject: () => void
    onOpenProject: (projectId: string) => void
    isInitialLoading: boolean
    isFetching: boolean
    errorMessage: string | null
    actionError: string | null
    menuOpenId: string | null
    isTogglePending: boolean
    onToggleStar: (id: string, event: React.MouseEvent) => void
    onToggleMenu: (id: string, event: React.MouseEvent) => void
    onOpenProjectFromMenu: (projectId: string, event: React.MouseEvent) => void
    onToggleStarFromMenu: (project: Project, event: React.MouseEvent) => void
    onOpenRename: (project: Project, event: React.MouseEvent) => void
    onOpenDuplicate: (project: Project, event: React.MouseEvent) => void
    onOpenShare: (project: Project, event: React.MouseEvent) => void
    onOpenDelete: (project: Project, event: React.MouseEvent) => void
    searchQuery: string
    onSearchChange: (query: string) => void
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
    statusFilter: StatusFilter
    onStatusFilterChange: (filter: StatusFilter) => void
    hasUnfilteredProjects: boolean
}

const ProjectListAreaSkeleton: React.FC = () => {
    return (
        <div className="min-h-[420px] flex flex-col gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={`project-list-skeleton-${index}`}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_8rem_2.5rem] items-center gap-3 rounded-xl px-5 py-4 md:gap-4"
                >
                    <div className="flex flex-col gap-1 w-full max-w-xs">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <div>
                        <Skeleton className="h-3.5 w-20" />
                    </div>
                    <div>
                        <Skeleton className="h-3.5 w-24" />
                    </div>
                    <div>
                        <Skeleton className="h-3.5 w-32" />
                    </div>
                    <div className="flex justify-center">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                    <div></div>
                </div>
            ))}
        </div>
    )
}

const EmptyProjectsState: React.FC<{ onNewProject: () => void }> = ({ onNewProject }) => {
    return (
        <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="relative mb-6 h-28 w-32">
                <svg
                    viewBox="0 0 128 112"
                    fill="none"
                    className="h-full w-full text-[#8A8987]"
                    aria-hidden="true"
                >
                    <path
                        d="M28 42.5 64 22l36 20.5v43L64 106 28 85.5v-43Z"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M28 42.5 64 63l36-20.5M64 63v43"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            <h2 className="text-[17px] font-medium text-[#D6D5C9]">No projects</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#7B7A79]">
                Projects you create or import will appear here.
            </p>
            <button
                onClick={onNewProject}
                className="mt-5 rounded-lg border border-[#383736] bg-[#1A1918] px-4 py-2 text-[13px] font-medium text-[#D6D5C9] transition-colors hover:bg-[#242323]"
            >
                New project
            </button>
        </div>
    )
}

const NoResultsState: React.FC = () => {
    return (
        <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
            <h2 className="text-[17px] font-medium text-[#D6D5C9]">No matching projects</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#7B7A79]">
                Try adjusting your search or filters.
            </p>
        </div>
    )
}

const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
}

const STATUS_LABELS: Record<StatusFilter, string> = {
    any: 'Any',
    Draft: 'Draft',
    Generated: 'Generated',
    Published: 'Published',
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
    projects,
    onNewProject,
    onOpenProject,
    isInitialLoading,
    isFetching,
    errorMessage,
    actionError,
    menuOpenId,
    isTogglePending,
    onToggleStar,
    onToggleMenu,
    onOpenProjectFromMenu,
    onToggleStarFromMenu,
    onOpenRename,
    onOpenDuplicate,
    onOpenShare,
    onOpenDelete,
    searchQuery,
    onSearchChange,
    sortOption,
    onSortChange,
    statusFilter,
    onStatusFilterChange,
    hasUnfilteredProjects,
}) => {
    const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
    const [visibleCount, setVisibleCount] = React.useState(10)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useEffect(() => {
        setVisibleCount(10)
    }, [projects.length])

    const displayedError = actionError ?? errorMessage
    const hasProjects = projects.length > 0

    return (
        <>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">Projects</h1>
                    <p className="text-[13px] text-[#7B7A79]">
                        Manage and view all your workspaces and items.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isFetching && !isInitialLoading && (
                        <div className="text-[12px] text-neutral-500 mt-1">Syncing projects...</div>
                    )}
                    {displayedError && (
                        <div className="max-w-[26rem] truncate rounded-full border border-red-500/35 bg-red-500/15 px-4 py-1 text-xs font-medium text-red-200 mt-1">
                            {displayedError}
                        </div>
                    )}
                </div>
            </div>

            {hasUnfilteredProjects && (
                <>
                    <div className="relative z-10 mb-4 flex w-full items-center">
                        <div className="relative w-full max-w-[480px]">
                            <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full rounded-lg border border-[#383736] bg-[#171615] py-1.5 pl-9 pr-4 text-[13px] text-[#D6D5C9] transition-colors placeholder:text-[#7B7A79] hover:bg-[#1E1D1B] focus:border-[#7B7A79] focus:bg-[#1E1D1B] focus:outline-none"
                            />
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-2" ref={dropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() =>
                                        setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')
                                    }
                                    className="flex items-center gap-2 rounded-full border border-[#383736] bg-[#171615] px-4 py-1.5 text-[13px] text-[#D6D5C9] transition-colors hover:bg-[#1E1D1B]"
                                >
                                    Sort: {SORT_LABELS[sortOption]}{' '}
                                    <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                                </button>
                                {activeDropdown === 'sort' && (
                                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl">
                                        <div className="mb-1 border-b border-[#383736] px-3 pb-2 text-[12px] font-medium text-[#7B7A79]">
                                            Sort by
                                        </div>
                                        <button
                                            onClick={() => {
                                                onSortChange('newest')
                                                setActiveDropdown(null)
                                            }}
                                            className="flex w-full items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]"
                                        >
                                            Newest first{' '}
                                            {sortOption === 'newest' && (
                                                <Icons.Check className="h-4 w-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                onSortChange('oldest')
                                                setActiveDropdown(null)
                                            }}
                                            className="flex w-full items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]"
                                        >
                                            Oldest first{' '}
                                            {sortOption === 'oldest' && (
                                                <Icons.Check className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() =>
                                        setActiveDropdown(
                                            activeDropdown === 'status' ? null : 'status'
                                        )
                                    }
                                    className="flex items-center gap-2 rounded-full border border-[#383736] bg-[#171615] px-4 py-1.5 text-[13px] text-[#D6D5C9] transition-colors hover:bg-[#1E1D1B]"
                                >
                                    Status: {STATUS_LABELS[statusFilter]}{' '}
                                    <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                                </button>
                                {activeDropdown === 'status' && (
                                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl">
                                        <div className="mb-1 border-b border-[#383736] px-3 pb-2 text-[12px] font-medium text-[#7B7A79]">
                                            Publish status
                                        </div>
                                        {(['any', 'Draft', 'Generated', 'Published'] as const).map(
                                            (option) => (
                                                <button
                                                    key={option}
                                                    onClick={() => {
                                                        onStatusFilterChange(option)
                                                        setActiveDropdown(null)
                                                    }}
                                                    className="flex w-full items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]"
                                                >
                                                    {STATUS_LABELS[option]}{' '}
                                                    {statusFilter === option && (
                                                        <Icons.Check className="h-4 w-4" />
                                                    )}
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mb-2 grid grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_8rem_2.5rem] gap-3 border-b border-[#242323] px-5 py-3 text-[13px] font-medium text-[#D6D5C9] select-none md:gap-4">
                        <div>Name</div>
                        <div>Status</div>
                        <div>Created at</div>
                        <div>Created by</div>
                        <div className="text-center">Starred projects</div>
                        <div></div>
                    </div>
                </>
            )}

            {isInitialLoading ? (
                <ProjectListAreaSkeleton />
            ) : !hasUnfilteredProjects ? (
                <EmptyProjectsState onNewProject={onNewProject} />
            ) : !hasProjects ? (
                <NoResultsState />
            ) : (
                <div className="flex flex-col">
                    <div className="min-h-[420px] flex flex-col gap-1 pb-4">
                        {projects.slice(0, visibleCount).map((project) => (
                            <ProjectListRow
                                key={project.id}
                                project={project}
                                isMenuOpen={menuOpenId === project.id}
                                isTogglePending={isTogglePending}
                                onOpenProject={onOpenProject}
                                onToggleStar={onToggleStar}
                                onToggleMenu={onToggleMenu}
                                onOpenProjectFromMenu={onOpenProjectFromMenu}
                                onToggleStarFromMenu={onToggleStarFromMenu}
                                onOpenRename={onOpenRename}
                                onOpenDuplicate={onOpenDuplicate}
                                onOpenShare={onOpenShare}
                                onOpenDelete={onOpenDelete}
                            />
                        ))}
                    </div>

                    {visibleCount < projects.length && (
                        <div className="flex justify-center pt-2 mb-8">
                            <button
                                onClick={() =>
                                    setVisibleCount((prev) => Math.min(prev + 10, projects.length))
                                }
                                className="px-4 py-1.5 rounded-md border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
