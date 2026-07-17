import React, { useState } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface SessionListRowProps {
    project: any // Actually a BackendSession
    isMenuOpen: boolean
    isTogglePending: boolean
    onOpenProject: (id: string) => void
    onToggleStar: (id: string, event: React.MouseEvent) => void
    onToggleMenu: (id: string, event: React.MouseEvent) => void
    onOpenProjectFromMenu: (id: string, event: React.MouseEvent) => void
    onToggleStarFromMenu: (session: any, event: React.MouseEvent) => void
    onToggleArchiveFromMenu: (session: any, event: React.MouseEvent) => void
    onOpenRename: (session: any, event: React.MouseEvent) => void
    onOpenDuplicate: (session: any, event: React.MouseEvent) => void
    onOpenShare: (session: any, event: React.MouseEvent) => void
    onOpenDelete: (session: any, event: React.MouseEvent) => void
    onOpenSettings: (session: any, event: React.MouseEvent) => void
}

export const SessionListRow: React.FC<SessionListRowProps> = ({
    project,
    isMenuOpen,
    isTogglePending,
    onOpenProject,
    onToggleStar,
    onToggleMenu,
    onOpenProjectFromMenu,
    onToggleStarFromMenu,
    onToggleArchiveFromMenu,
    onOpenRename,
    onOpenDuplicate,
    onOpenShare,
    onOpenDelete,
    onOpenSettings,
}) => {
    const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
    const session = project // alias for clarity

    const updatedDate = new Date(session.updatedAt || session.createdAt)
    const createdDate = new Date(session.createdAt)
    const formatDate = (d: Date) =>
        d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        })

    return (
        <div
            className={`group relative grid cursor-pointer grid-cols-[minmax(0,2fr)_minmax(100px,auto)_minmax(100px,auto)_minmax(150px,1fr)_minmax(100px,auto)_2.5rem] items-center gap-2 rounded-lg border pl-1 pr-5 py-2 transition-all duration-200 hover:bg-[#191919] md:gap-3 ${
                session.isArchived
                    ? 'opacity-60 border-transparent hover:opacity-100'
                    : 'border-transparent'
            }`}
            onClick={() => onOpenProject(session.id)}
        >
            {/* Name */}
            <div className="flex flex-1 items-center gap-3 min-w-0">
                <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[#D6D5C9] transition-colors">
                            {session.title || 'Untitled Session'}
                        </span>
                        {session.isArchived && (
                            <span
                                className="flex items-center justify-center rounded bg-[#242323] p-1"
                                title="Archived"
                            >
                                <Icons.Archive className="h-3 w-3 text-[#7B7A79]" />
                            </span>
                        )}
                    </div>
                    <span className="truncate text-[12px] text-[#7B7A79] transition-colors">
                        {session.lastMessage || 'No messages yet...'}
                    </span>
                </div>
            </div>

            {/* Created At */}
            <div className="truncate pr-2 text-[13px] text-[#7B7A79] transition-colors group-hover:text-[#A3A2A0]">
                {formatDate(createdDate)}
            </div>

            {/* Updated At */}
            <div className="truncate pr-2 text-[13px] text-[#7B7A79] transition-colors group-hover:text-[#A3A2A0]">
                {formatDate(updatedDate)}
            </div>

            {/* Tags & PR */}
            <div className="flex items-center gap-2 overflow-hidden">
                {session.tags && session.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        {session.tags.slice(0, 2).map((tag: string) => (
                            <span
                                key={tag}
                                className="truncate rounded-md border border-[#383736] bg-[#242323] px-2 py-0.5 text-[11px] font-medium text-[#A3A2A0]"
                            >
                                {tag}
                            </span>
                        ))}
                        {session.tags.length > 2 && (
                            <span className="text-[11px] text-[#7B7A79]">
                                +{session.tags.length - 2}
                            </span>
                        )}
                    </div>
                )}
                {session.prNumber && (
                    <span className="flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-400">
                        <Icons.GitPullRequest className="h-3 w-3" />#{session.prNumber}
                    </span>
                )}
                {!session.tags?.length && !session.prNumber && (
                    <span className="text-[#4A4948] text-[12px]">--</span>
                )}
            </div>

            {/* Created By */}
            <div className="truncate text-[13px] text-[#7B7A79] transition-colors group-hover:text-[#A3A2A0]">
                {session.createdBy || '--'}
            </div>

            {/* Menu */}
            <div
                className={`relative flex justify-center ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
            >
                <button
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        if (window.innerHeight - rect.bottom < 300 && rect.top > 300) {
                            setMenuDirection('up')
                        } else {
                            setMenuDirection('down')
                        }
                        onToggleMenu(session.id, e)
                    }}
                    className={`rounded-lg p-2 text-[#7B7A79] transition-all hover:bg-[#242323] hover:text-[#D6D5C9] ${isMenuOpen ? 'bg-[#242323] text-[#D6D5C9]' : ''}`}
                >
                    <Icons.MoreHorizontal className="h-4 w-4" />
                </button>
                {isMenuOpen && (
                    <div
                        className={`absolute right-0 ${menuDirection === 'up' ? 'bottom-9' : 'top-9'} z-30 flex w-56 flex-col rounded-xl border border-[#383736] bg-[#1E1E1E] p-1.5 shadow-xl`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => onOpenProjectFromMenu(session.id, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#262626]"
                        >
                            <Icons.ExternalLink className="h-4 w-4 text-[#7B7A79]" /> Open
                        </button>
                        <button
                            onClick={(e) => onOpenRename(session, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#262626]"
                        >
                            <Icons.Edit className="h-4 w-4 text-[#7B7A79]" /> Rename
                        </button>
                        <button
                            onClick={(e) => onToggleStarFromMenu(session, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#262626]"
                        >
                            <Icons.Pin className="h-4 w-4 text-[#7B7A79]" />{' '}
                            {session.isPinned ? 'Unpin session' : 'Pin session'}
                        </button>
                        <button
                            onClick={(e) => onToggleArchiveFromMenu(session, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#262626]"
                        >
                            <Icons.Archive className="h-4 w-4 text-[#7B7A79]" />{' '}
                            {session.isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                        {session.projectId && (
                            <button
                                onClick={(e) => onOpenSettings(session, e)}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#D6D5C9] transition-colors hover:bg-[#262626]"
                            >
                                <Icons.Settings className="h-4 w-4 text-[#7B7A79]" /> Settings
                            </button>
                        )}
                        <div className="mx-2 my-1.5 h-px bg-[#383736]" />
                        <button
                            onClick={(e) => onOpenDelete(session, e)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-red-400 transition-colors hover:bg-[#262626] hover:text-red-300"
                        >
                            <Icons.Trash className="h-4 w-4" /> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
