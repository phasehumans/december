import React from 'react'
import { ChatThread as ChatSidebar } from '@/features/chat/components/ChatThread'
import { OutputScreenMainContent } from './OutputScreenMainContent'
import { useOutputScreenController } from '@/features/preview/hooks/useOutputScreenController'
import type { OutputScreenProps } from '@/features/preview/types'

export const OutputScreen: React.FC<OutputScreenProps> = ({ onBack, isGenerating = false }) => {
    const {
        activeTab,
        setActiveTab,
        device,
        setDevice,
        previewHtml,
        setPreviewHtml,
        isVisualMode,
        setIsVisualMode,
        selectedElement,
        editPrompt,
        setEditPrompt,
        isApplyingEdit,
        isChatSidebarCollapsed,
        setIsChatSidebarCollapsed,
        steps,
        isThoughtsOpen,
        setIsThoughtsOpen,
        executionTime,
        iframeRef,
        handleIframeMessage,
        handleApplyEdit,
        handleClearSelection,
        handleOpenInNewTab,
    } = useOutputScreenController({ isGenerating })

    return (
        <div className="flex w-full h-full bg-black text-white font-sans overflow-hidden">
            <ChatSidebar
                onBack={onBack || (() => {})}
                isGenerating={isGenerating}
                steps={steps}
                executionTime={executionTime}
                isThoughtsOpen={isThoughtsOpen}
                setIsThoughtsOpen={setIsThoughtsOpen}
                editPrompt={editPrompt}
                setEditPrompt={setEditPrompt}
                handleApplyEdit={handleApplyEdit}
                isVisualMode={isVisualMode}
                setIsVisualMode={setIsVisualMode}
                selectedElement={selectedElement}
                handleClearSelection={handleClearSelection}
                isApplyingEdit={isApplyingEdit}
                isCollapsed={isChatSidebarCollapsed}
                onClose={() => setIsChatSidebarCollapsed(true)}
            />

            <OutputScreenMainContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                device={device}
                setDevice={setDevice}
                isChatSidebarCollapsed={isChatSidebarCollapsed}
                onToggleSidebar={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
                onOpenInNewTab={handleOpenInNewTab}
                onBack={onBack}
                previewHtml={previewHtml}
                setPreviewHtml={setPreviewHtml}
                isGenerating={isGenerating}
                isVisualMode={isVisualMode}
                iframeRef={iframeRef}
                onIframeMessage={handleIframeMessage}
            />
        </div>
    )
}
