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
    projectName,
    projectId,
    versions,
    activeVersionId,
    isVersionLoading,
    onSelectVersion,
    onDownload,
    selectedModel,
    setSelectedModel,
}) => {
    return (
        <header className="h-12 flex items-center justify-between px-3 bg-[#171615] backdrop-blur-sm shrink-0 z-[45] gap-3">
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

            <OutputHeaderActions
                projectName={projectName}
                projectId={projectId}
                versions={versions}
                activeVersionId={activeVersionId}
                isVersionLoading={isVersionLoading}
                onSelectVersion={onSelectVersion}
                onDownload={onDownload}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
            />
        </header>
    )
}
