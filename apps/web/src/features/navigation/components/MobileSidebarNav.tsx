import React from 'react'

import { SidebarNavItem } from './SidebarNavItem'

import { Icons } from '@/shared/components/ui/Icons'

const HeavyAsteriskIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        {...props}
    >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="12" y1="5" x2="12" y2="19" transform="rotate(60 12 12)" />
        <line x1="12" y1="5" x2="12" y2="19" transform="rotate(120 12 12)" />
    </svg>
)

interface MobileSidebarNavProps {
    onClose: () => void
    onNewThread: () => void
    onAllProjects: () => void
    onTemplates: () => void
    onDocs: () => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const MobileSidebarNav: React.FC<MobileSidebarNavProps> = ({
    onClose,
    onNewThread,
    onAllProjects,
    onTemplates,
    onDocs,
    isAuthenticated,
    onOpenAuth,
}) => {
    return (
        <div className="flex flex-col gap-1 px-3">
            <SidebarNavItem
                icon={<Icons.Home />}
                label="Home"
                collapsed={false}
                onClick={() => {
                    if (!isAuthenticated) {
                        onOpenAuth?.()
                    } else {
                        onNewThread()
                    }
                    onClose()
                }}
            />
            <SidebarNavItem
                icon={<Icons.NewProject />}
                label="New Project"
                collapsed={false}
                onClick={() => {
                    if (!isAuthenticated) {
                        onOpenAuth?.()
                    } else {
                        onNewThread()
                    }
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
                icon={<HeavyAsteriskIcon className="w-[18px] h-[18px]" />}
                label="December CLI"
                collapsed={false}
                onClick={() => {
                    onDocs()
                    onClose()
                }}
            />
        </div>
    )
}
