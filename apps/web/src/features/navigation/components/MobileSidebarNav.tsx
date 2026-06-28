import React from 'react'

import { SidebarNavItem } from './SidebarNavItem'

import { Icons } from '@/shared/components/ui/Icons'

interface MobileSidebarNavProps {
    onClose: () => void
    onNewThread: () => void
    onAllProjects: () => void
    onSessions?: () => void
    onTemplates: () => void
    onDocs: () => void
    onProfile?: () => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const MobileSidebarNav: React.FC<MobileSidebarNavProps> = ({
    onClose,
    onNewThread,
    onAllProjects,
    onSessions,
    onTemplates,
    onDocs,
    onProfile,
    isAuthenticated,
    onOpenAuth,
}) => {
    return (
        <div className="flex flex-col gap-1 px-3">
            <SidebarNavItem
                icon={<Icons.Search className="w-[18px] h-[18px]" />}
                label="Search"
                collapsed={false}
                onClick={() => {}}
            />
            <SidebarNavItem
                icon={<Icons.SessionsIcon className="w-[18px] h-[18px]" />}
                label="Sessions"
                collapsed={false}
                onClick={() => {
                    onSessions?.()
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.Folder />}
                label="All Projects"
                collapsed={false}
                onClick={() => {
                    onAllProjects()
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.Grid />}
                label="Templates"
                collapsed={false}
                onClick={() => {
                    onTemplates()
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.Settings className="w-[18px] h-[18px]" />}
                label="Settings"
                collapsed={false}
                onClick={() => {
                    onProfile?.()
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.DocsBook className="w-[18px] h-[18px]" />}
                label="Documentation"
                collapsed={false}
                onClick={() => {
                    onDocs()
                    onClose()
                }}
            />
        </div>
    )
}
