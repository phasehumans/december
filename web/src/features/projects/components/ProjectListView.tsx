import React from 'react'

import { ProjectListRow } from './ProjectListRow'

import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Icons } from '@/shared/components/ui/Icons'
import type { Project } from '@/features/projects/types'

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
    onOpenRename: (project: Project, event: React.MouseEvent) => void
    onOpenDuplicate: (project: Project, event: React.MouseEvent) => void
    onOpenShare: (project: Project, event: React.MouseEvent) => void
    onOpenDelete: (project: Project, event: React.MouseEvent) => void
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
    onOpenRename,
    onOpenDuplicate,
    onOpenShare,
    onOpenDelete,
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

    const statuses = ['Draft', 'Generated', 'Published'] as const
    const mockProjects: Project[] = Array.from({ length: 25 }).map((_, index) => {
        if (projects[index]) {
            return {
                ...projects[index],
                status: statuses[index % 3],
            }
        }

        const relativeTime = index % 2 === 0 ? `${index + 1} hr ago` : `${index + 2} days ago`

        return {
            id: `mock-${index}`,
            title: `Sample Project ${index + 1}`,
            description: 'This is a sample project description.',
            updatedAt: relativeTime,
            isStarred: index % 5 === 0,
            versionCount: 1,
            currentVersionId: null,
            status: statuses[index % 3],
        }
    })

    const displayedError = actionError ?? errorMessage

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

            {/* Search and Filters */}
            <div className="flex items-center mb-4 w-full relative z-10">
                <div className="relative w-full max-w-[480px]">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B7A79]" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        className="w-full bg-[#171615] hover:bg-[#1E1D1B] focus:bg-[#1E1D1B] border border-[#383736] rounded-lg pl-9 pr-4 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:outline-none focus:border-[#7B7A79] transition-colors"
                    />
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2" ref={dropdownRef}>
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() =>
                                setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')
                            }
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#383736] bg-[#171615] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Sort: Newest{' '}
                            <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                        </button>
                        {activeDropdown === 'sort' && (
                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl z-50">
                                <div className="px-3 pb-2 text-[12px] font-medium text-[#7B7A79] border-b border-[#383736] mb-1">
                                    Sort by
                                </div>
                                <button className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]">
                                    Newest first <Icons.Check className="h-4 w-4" />
                                </button>
                                <button className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]">
                                    Oldest first
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() =>
                                setActiveDropdown(activeDropdown === 'status' ? null : 'status')
                            }
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#383736] bg-[#171615] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Status: Any <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                        </button>
                        {activeDropdown === 'status' && (
                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl z-50">
                                <div className="px-3 pb-2 text-[12px] font-medium text-[#7B7A79] border-b border-[#383736] mb-1">
                                    Publish status
                                </div>
                                <button className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]">
                                    Draft
                                </button>
                                <button className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]">
                                    Generated <Icons.Check className="h-4 w-4" />
                                </button>
                                <button className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323]">
                                    Published
                                </button>
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

            {isInitialLoading ? (
                <ProjectListAreaSkeleton />
            ) : (
                <div className="flex flex-col">
                    <div className="min-h-[420px] flex flex-col gap-1 pb-4">
                        {mockProjects.slice(0, visibleCount).map((project) => (
                            <ProjectListRow
                                key={project.id}
                                project={project}
                                isMenuOpen={menuOpenId === project.id}
                                isTogglePending={isTogglePending}
                                onOpenProject={onOpenProject}
                                onToggleStar={onToggleStar}
                                onToggleMenu={onToggleMenu}
                                onOpenRename={onOpenRename}
                                onOpenDuplicate={onOpenDuplicate}
                                onOpenShare={onOpenShare}
                                onOpenDelete={onOpenDelete}
                            />
                        ))}
                    </div>

                    {/* Load More */}
                    {visibleCount < mockProjects.length && (
                        <div className="flex justify-center pt-2 mb-8">
                            <button
                                onClick={() =>
                                    setVisibleCount((prev) =>
                                        Math.min(prev + 10, mockProjects.length)
                                    )
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
