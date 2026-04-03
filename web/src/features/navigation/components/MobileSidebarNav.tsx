import React from 'react'
import { Icons } from '@/shared/components/ui/Icons'
import { SidebarNavItem } from './SidebarNavItem'

interface MobileSidebarNavProps {
    onClose: () => void
    onNewThread: () => void
    onAllProjects: () => void
    onTemplates: () => void
}

export const MobileSidebarNav: React.FC<MobileSidebarNavProps> = ({
    onClose,
    onNewThread,
    onAllProjects,
    onTemplates,
}) => {
    return (
        <div className="flex flex-col gap-1 px-3">
            <SidebarNavItem
                icon={<Icons.Home />}
                label="Home"
                collapsed={false}
                onClick={() => {
                    onNewThread()
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.NewProject />}
                label="New Project"
                collapsed={false}
                onClick={() => {
                    onNewThread()
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
                icon={<Icons.Folder />}
                label="All Projects"
                collapsed={false}
                onClick={() => {
                    onAllProjects()
                    onClose()
                }}
            />
        </div>
    )
}
