import React from 'react'

import type { ProjectListRowProps } from '@/features/projects/types'

import { Icons } from '@/shared/components/ui/Icons'

export const ProjectListRow: React.FC<ProjectListRowProps> = ({
    project,
    isMenuOpen,
    isTogglePending,
    onOpenProject,
    onToggleStar,
    onToggleMenu,
    onOpenProjectFromMenu,
    onToggleStarFromMenu,
    onOpenRename,
    onOpenDuplicate,
    onOpenShare,
    onOpenDelete,
}) => {
    return (
        <div
            className="group relative grid cursor-pointer grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_8rem_2.5rem] items-center gap-3 rounded-xl border border-transparent px-5 py-3 transition-all duration-200 hover:bg-[#1E1D1B] md:gap-4"
            onClick={() => onOpenProject(project.id)}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-[14px] font-medium text-[#D6D5C9] transition-colors">
                    {project.title}
                </span>
                <span className="truncate text-[12px] text-[#7B7A79] transition-colors">
                    {project.description}
                </span>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-[#7B7A79]">
                {project.status === 'Published' && (
                    <Icons.Globe className="h-3.5 w-3.5 text-[#7B7A79]" />
                )}
                {project.status === 'Generated' && (
                    <Icons.Terminal className="h-3.5 w-3.5 text-[#7B7A79]" />
                )}
                {(!project.status || project.status === 'Draft') && (
                    <Icons.Folder className="h-3.5 w-3.5 text-[#7B7A79]" />
                )}
                <span className="capitalize">{project.status || 'Draft'}</span>
            </div>

            <div className="truncate pr-2 text-[13px] text-[#7B7A79] transition-colors group-hover:text-[#A3A2A0]">
                {project.createdAt}
            </div>

            <div className="flex items-center gap-2 text-[13px] text-[#7B7A79]">
                <span className="truncate">@{project.createdByUsername}</span>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={(e) => onToggleStar(project.id, e)}
                    className="rounded-lg p-2 transition-all duration-200 hover:bg-[#242323] focus:outline-none"
                    title={project.isStarred ? 'Unstar' : 'Star'}
                    disabled={isTogglePending}
                >
                    <Icons.Star
                        className={`h-4 w-4 transition-colors ${project.isStarred ? 'fill-white text-white' : 'text-[#7B7A79] hover:text-[#D6D5C9]'}`}
                    />
                </button>
            </div>

            <div
                className={`relative flex justify-center ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
            >
                <button
                    onClick={(e) => onToggleMenu(project.id, e)}
                    className={`rounded-lg p-2 text-[#7B7A79] transition-all hover:bg-[#242323] hover:text-[#D6D5C9] ${isMenuOpen ? 'bg-[#242323] text-[#D6D5C9]' : ''}`}
                >
                    <Icons.MoreHorizontal className="h-4 w-4" />
                </button>
                {isMenuOpen && (
                    <div
                        className="absolute right-0 top-9 z-30 flex w-56 flex-col rounded-xl border border-[#383736] bg-[#1E1D1C] p-1.5 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => onOpenProjectFromMenu(project.id, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]"
                        >
                            <Icons.ExternalLink className="h-4 w-4 text-[#7B7A79]" /> Open in new
                            tab
                        </button>
                        <button
                            onClick={(e) => onOpenRename(project, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]"
                        >
                            <Icons.Edit className="h-4 w-4 text-[#7B7A79]" /> Rename
                        </button>
                        <button
                            onClick={(e) => onOpenDuplicate(project, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]"
                        >
                            <Icons.Copy className="h-4 w-4 text-[#7B7A79]" /> Duplicate
                        </button>
                        <button
                            onClick={(e) => onToggleStarFromMenu(project, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]"
                        >
                            <Icons.Star className="h-4 w-4 text-[#7B7A79]" />{' '}
                            {project.isStarred ? 'Remove from favourites' : 'Add to favourites'}
                        </button>
                        {/* <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]">
                            <Icons.Settings className="h-4 w-4 text-[#7B7A79]" /> Settings
                        </button> */}
                        <button
                            onClick={(e) => onOpenShare(project, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#252422]"
                        >
                            <Icons.Globe className="h-4 w-4 text-[#7B7A79]" />{' '}
                            {project.isSharedAsTemplate ? 'Unshare' : 'Share'}
                        </button>
                        <div className="mx-2 my-1.5 h-px bg-[#383736]" />
                        <button
                            onClick={(e) => onOpenDelete(project, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-red-400 transition-colors hover:bg-[#252422] hover:text-red-300"
                        >
                            <Icons.Trash className="h-4 w-4" /> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
