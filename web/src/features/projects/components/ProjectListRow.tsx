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
    onOpenRename,
    onOpenDuplicate,
    onOpenDelete,
}) => {
    return (
        <div
            className="group relative grid cursor-pointer grid-cols-12 items-center gap-4 rounded-xl border border-transparent px-6 py-4 transition-all duration-200 hover:border-white/5 hover:bg-surface/40"
            onClick={onOpenProject}
        >
            <div className="col-span-6 flex items-center gap-4">
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-surface text-neutral-500 shadow-sm transition-colors group-hover:text-white md:flex">
                    <Icons.Globe className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-[15px] font-medium text-textMain transition-colors group-hover:text-white">
                        {project.title}
                    </span>
                    <span className="truncate text-xs text-neutral-600 transition-colors group-hover:text-neutral-500">
                        {project.description}
                    </span>
                </div>
            </div>
            <div className="col-span-4 text-sm font-medium text-neutral-500 transition-colors group-hover:text-neutral-400">
                {project.updatedAt}
            </div>
            <div className="relative col-span-2 flex items-center justify-end gap-2">
                <button
                    onClick={(e) => onToggleStar(project.id, e)}
                    className="rounded-lg p-2 transition-all duration-200 hover:bg-white/5 focus:outline-none"
                    title={project.isStarred ? 'Unstar' : 'Star'}
                    disabled={isTogglePending}
                >
                    <Icons.Star
                        className={`h-4 w-4 transition-colors ${project.isStarred ? 'fill-white text-white' : 'text-neutral-600 hover:text-white'}`}
                    />
                </button>
                <div
                    className={`relative ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
                >
                    <button
                        onClick={(e) => onToggleMenu(project.id, e)}
                        className={`rounded-lg p-2 text-neutral-600 transition-all hover:bg-white/5 hover:text-white ${isMenuOpen ? 'bg-white/5 text-white' : ''}`}
                    >
                        <Icons.MoreHorizontal className="h-4 w-4" />
                    </button>
                    {isMenuOpen && (
                        <div
                            className="absolute right-0 top-9 z-30 flex w-48 flex-col rounded-lg border border-white/10 bg-[#1C1C1E] py-1.5 shadow-xl ring-1 ring-black/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={(e) => onOpenRename(project, e)}
                                className="mx-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                            >
                                <Icons.Edit className="h-3.5 w-3.5" /> Rename
                            </button>
                            <button
                                onClick={(e) => onOpenDuplicate(project, e)}
                                className="mx-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                            >
                                <Icons.Copy className="h-3.5 w-3.5" /> Duplicate
                            </button>
                            <div className="mx-1 my-1 h-px bg-white/5" />
                            <button
                                onClick={(e) => onOpenDelete(project, e)}
                                className="mx-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-white/5 hover:text-red-300"
                            >
                                <Icons.Trash className="h-3.5 w-3.5" /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
