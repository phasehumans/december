import { Maximize2, Minimize2 } from 'lucide-react'
import React from 'react'

import { ChangesWorkspace } from './ChangesWorkspace'
import { PreviewArea } from './PreviewArea'
import { PullRequestsWorkspace } from './PullRequestsWorkspace'
import { TerminalWorkspace } from './TerminalWorkspace'
import { ALL_TAB_DEFS, WorkspaceHeaderViewTabs } from './WorkspaceHeaderViewTabs'

import type { WorkspaceTabId } from './WorkspaceHeaderViewTabs'
import type { GeneratedProjectFile, PreviewSessionStatus } from '@/features/preview/types'
import type { BackendProjectVersionSummary } from '@/features/sessions/api/session'

import { useAppStore } from '@/app/store'
import { Tooltip } from '@/shared/components/ui/Tooltip'

interface WorkspaceScreenMainContentProps {
    isChatSidebarCollapsed: boolean
    onToggleSidebar: () => void
    isPreviewCollapsed?: boolean
    onTogglePreview?: () => void
    onOpenInNewTab: () => void
    onBack?: () => void
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath?: string | null
    isGenerating: boolean
    iframeRef: React.RefObject<HTMLIFrameElement>
    onIframeMessage: (event: MessageEvent) => void
    showStructureOnly: boolean
    projectName?: string | null
    projectId?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
    previewSession?: PreviewSessionStatus | null
    previewSessionError?: string | null
    projectType?: 'generated' | 'github' | 'zip'
    onRefresh?: () => void
}

export const WorkspaceScreenMainContent: React.FC<WorkspaceScreenMainContentProps> = ({
    isChatSidebarCollapsed,
    onToggleSidebar,
    onBack,
    generatedFiles,
    activeGeneratedFilePath,
    isGenerating,
    iframeRef,
    onIframeMessage,
    showStructureOnly,
    projectId,
    previewSession,
    previewSessionError,
    projectType,
}) => {
    const [openTabs, setOpenTabs] = React.useState<WorkspaceTabId[]>([
        'changes',
        'desktop',
        'shell',
    ])
    const [activeTab, setActiveTab] = React.useState<WorkspaceTabId>('changes')
    const initialMountRef = React.useRef(true)
    const prevFilePathRef = React.useRef<string | null>(activeGeneratedFilePath || null)
    const pullRequest = useAppStore((state) => state.pullRequest)

    const availablePrs = React.useMemo(() => {
        if (!pullRequest) return []
        return [
            {
                id: 'pull_requests' as const,
                label: pullRequest.prNumber ? `PR #${pullRequest.prNumber}` : 'Pull requests',
                icon: (
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        className="w-3.5 h-3.5 text-[#8E8D8C]"
                    >
                        <circle cx="5" cy="4" r="1.5" />
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="11" cy="6" r="1.5" />
                        <path
                            d="M5 5.5v5M11 7.5v1.5a3 3 0 0 1-3 3H6.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                ),
            },
        ]
    }, [pullRequest])

    React.useEffect(() => {
        if (initialMountRef.current) {
            initialMountRef.current = false
            return
        }
        if (activeGeneratedFilePath && activeGeneratedFilePath !== prevFilePathRef.current) {
            prevFilePathRef.current = activeGeneratedFilePath
            setActiveTab('changes')
        }
    }, [activeGeneratedFilePath])

    const handleCloseTab = (tabId: WorkspaceTabId) => {
        if (openTabs.length <= 1) return
        const nextTabs = openTabs.filter((id) => id !== tabId)
        setOpenTabs(nextTabs)
        if (activeTab === tabId) {
            const closingIndex = openTabs.indexOf(tabId)
            const fallbackTab = nextTabs[closingIndex] || nextTabs[closingIndex - 1] || nextTabs[0]
            setActiveTab(fallbackTab)
        }
    }

    const handleAddTab = (tabId: WorkspaceTabId) => {
        if (!openTabs.includes(tabId)) {
            setOpenTabs((prev) => [...prev, tabId])
        }
        setActiveTab(tabId)
    }

    const activeDef = ALL_TAB_DEFS.find((t) => t.id === activeTab)

    return (
        <div className="flex-1 flex flex-col h-full bg-[#141414] relative overflow-hidden min-h-0">
            <div className="h-10 flex items-center justify-between px-3 bg-[#141414] shrink-0 z-[40]">
                <WorkspaceHeaderViewTabs
                    openTabs={openTabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onCloseTab={handleCloseTab}
                    onAddTab={handleAddTab}
                    onReorderTabs={setOpenTabs}
                    onBack={onBack}
                    availablePrs={availablePrs}
                />

                <Tooltip
                    content={isChatSidebarCollapsed ? 'Show chat' : 'Expand workspace (hide chat)'}
                    position="bottom"
                    align="end"
                >
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="p-1.5 text-[#91908F] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer outline-none"
                    >
                        {isChatSidebarCollapsed ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                </Tooltip>
            </div>

            <div
                className={
                    activeTab === 'desktop'
                        ? 'flex-1 min-h-0 flex flex-col w-full h-full'
                        : 'hidden'
                }
            >
                <PreviewArea
                    isGenerating={isGenerating}
                    onMessage={onIframeMessage}
                    iframeRef={iframeRef}
                    showStructureOnly={showStructureOnly}
                    previewUrl={previewSession?.previewUrl}
                    previewState={previewSession?.state ?? null}
                    previewError={previewSession?.lastError ?? null}
                    previewSessionError={previewSessionError}
                    projectType={projectType}
                    projectId={projectId}
                />
            </div>

            {activeTab === 'changes' && <ChangesWorkspace />}

            <div
                className={
                    activeTab === 'shell' ? 'flex-1 min-h-0 flex flex-col w-full h-full' : 'hidden'
                }
            >
                <TerminalWorkspace
                    previewSessionId={previewSession?.previewId || projectId}
                    generatedFiles={generatedFiles}
                />
            </div>

            {activeTab === 'pull_requests' && (
                <PullRequestsWorkspace
                    sessionId={previewSession?.previewId || projectId || undefined}
                />
            )}

            {activeTab !== 'desktop' &&
                activeTab !== 'changes' &&
                activeTab !== 'shell' &&
                activeTab !== 'pull_requests' && (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] text-[#8E8D8C] select-none p-6 font-sans w-full h-full">
                        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#1E1E20] border border-[#2A2A2D] flex items-center justify-center text-[#A1A1AA]">
                                {activeDef?.icon}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[14px] font-semibold text-[#EDEDEF]">
                                    {activeDef?.label} View
                                </span>
                                <span className="text-[12px] text-[#8E8D8C]">
                                    Workspace options and details for{' '}
                                    {activeDef?.label.toLowerCase()} will appear here.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    )
}

export const OutputScreenMainContent = WorkspaceScreenMainContent
