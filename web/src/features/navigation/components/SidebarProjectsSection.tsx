import React from 'react'
import { SidebarSectionHeader } from './SidebarSectionHeader'
import { SidebarProjectItem } from './SidebarProjectItem'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import type { Project } from '@/features/projects/types'

interface SidebarProjectsSectionProps {
    label: string
    icon: React.ReactNode
    collapsed: boolean
    isOpen: boolean
    onToggle: () => void
    projects: Project[]
    isLoading: boolean
    loadingCount: number
    emptyText: string
}

const SidebarProjectSkeleton: React.FC = () => {
    return <Skeleton className="h-6 w-full rounded-md" />
}

export const SidebarProjectsSection: React.FC<SidebarProjectsSectionProps> = ({
    label,
    icon,
    collapsed,
    isOpen,
    onToggle,
    projects,
    isLoading,
    loadingCount,
    emptyText,
}) => {
    return (
        <div className="flex flex-col gap-1">
            <SidebarSectionHeader
                label={label}
                icon={icon}
                collapsed={collapsed}
                isOpen={isOpen}
                onToggle={onToggle}
            />

            {!collapsed && isOpen && (
                <div className="flex flex-col gap-1 ml-4 pl-3 border-l border-white/10 mt-1 min-h-[84px]">
                    {isLoading ? (
                        Array.from({ length: loadingCount }).map((_, index) => (
                            <SidebarProjectSkeleton key={`${label.toLowerCase()}-skeleton-${index}`} />
                        ))
                    ) : projects.length > 0 ? (
                        projects.map((project) => <SidebarProjectItem key={project.id} {...project} />)
                    ) : (
                        <div className="px-2 py-1.5 text-[13px] text-[#91908F]/50 italic font-['Segoe_UI']">
                            {emptyText}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
