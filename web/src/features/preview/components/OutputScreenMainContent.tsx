import React from 'react'
import { OutputHeader } from './OutputHeader'
import { PreviewArea } from './PreviewArea'
import { CodeWorkspace } from './CodeWorkspace'
import Canvas from '@/features/canvas/components/Canvas'
import type {
    GeneratedProjectFile,
    PreviewDevice,
    PreviewSessionStatus,
    PreviewTab,
} from '@/features/preview/types'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

interface OutputScreenMainContentProps {
    activeTab: PreviewTab
    setActiveTab: (tab: PreviewTab) => void
    device: PreviewDevice
    setDevice: (device: PreviewDevice) => void
    isChatSidebarCollapsed: boolean
    onToggleSidebar: () => void
    onOpenInNewTab: () => void
    onBack?: () => void
    previewHtml: string
    setPreviewHtml: (nextHtml: string) => void
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath?: string | null
    isGenerating: boolean
    isVisualMode: boolean
    iframeRef: React.RefObject<HTMLIFrameElement>
    onIframeMessage: (event: MessageEvent) => void
    showStructureOnly: boolean
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
    previewSession?: PreviewSessionStatus | null
    previewSessionError?: string | null
}

export const OutputScreenMainContent: React.FC<OutputScreenMainContentProps> = ({
    activeTab,
    setActiveTab,
    device,
    setDevice,
    isChatSidebarCollapsed,
    onToggleSidebar,
    onOpenInNewTab,
    onBack,
    previewHtml,
    setPreviewHtml,
    generatedFiles,
    activeGeneratedFilePath,
    isGenerating,
    isVisualMode,
    iframeRef,
    onIframeMessage,
    showStructureOnly,
    projectName,
    versions,
    activeVersionId,
    isVersionLoading,
    onSelectVersion,
    onDownload,
    previewSession,
    previewSessionError,
}) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#0F0F0F] relative overflow-hidden transition-all duration-300 min-h-0">
            <OutputHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                device={device}
                setDevice={setDevice}
                isSidebarCollapsed={isChatSidebarCollapsed}
                onToggleSidebar={onToggleSidebar}
                onOpenNewTab={onOpenInNewTab}
                onBack={onBack}
                projectName={projectName}
                versions={versions}
                activeVersionId={activeVersionId}
                isVersionLoading={isVersionLoading}
                onSelectVersion={onSelectVersion}
                onDownload={onDownload}
            />

            {activeTab === 'preview' && (
                <PreviewArea
                    html={previewHtml}
                    isGenerating={isGenerating}
                    device={device}
                    isVisualMode={isVisualMode}
                    onMessage={onIframeMessage}
                    iframeRef={iframeRef}
                    showStructureOnly={showStructureOnly}
                    previewUrl={previewSession?.previewUrl}
                    previewState={previewSession?.state ?? null}
                    previewError={previewSession?.lastError ?? null}
                    previewSessionError={previewSessionError}
                />
            )}

            {activeTab === 'code' && (
                <CodeWorkspace
                    html={previewHtml}
                    generatedFiles={generatedFiles}
                    activeFilePath={activeGeneratedFilePath}
                    onHtmlChange={setPreviewHtml}
                />
            )}

            {activeTab === 'canvas' && (
                <div className="flex-1 min-h-0 p-2 bg-[#0F0F0F]">
                    <div className="w-full h-full rounded-xl border border-white/10 overflow-hidden">
                        <Canvas />
                    </div>
                </div>
            )}
        </div>
    )
}
