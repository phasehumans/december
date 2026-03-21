import React from 'react'
import { OutputHeader } from './OutputHeader'
import { PreviewArea } from './PreviewArea'
import { CodeWorkspace } from './CodeWorkspace'
import Canvas from '@/features/canvas/components/Canvas'
import type { GeneratedProjectFile, PreviewDevice, PreviewTab } from '@/features/preview/types'

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
