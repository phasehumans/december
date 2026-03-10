import React from 'react'
import { OutputHeaderActions } from './OutputHeaderActions'
import { OutputHeaderCenterControls } from './OutputHeaderCenterControls'
import { OutputHeaderViewTabs } from './OutputHeaderViewTabs'
import type { OutputHeaderProps } from '@/features/preview/types'

export const OutputHeader: React.FC<OutputHeaderProps> = ({
    activeTab,
    setActiveTab,
    device,
    setDevice,
    isSidebarCollapsed,
    onToggleSidebar,
    onOpenNewTab,
    onBack,
}) => {
    return (
        <header className="h-12 flex items-center justify-between px-3 bg-[#1F1F1F] backdrop-blur-sm shrink-0 z-10">
            <OutputHeaderViewTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={onToggleSidebar}
                onBack={onBack}
            />

            <OutputHeaderCenterControls
                device={device}
                setDevice={setDevice}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={onToggleSidebar}
                onOpenNewTab={onOpenNewTab}
            />

            <OutputHeaderActions />
        </header>
    )
}
