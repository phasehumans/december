import React from 'react'
import { ChatThread as ChatSidebar } from '@/features/chat/components/ChatThread'
import { OutputScreenMainContent } from './OutputScreenMainContent'
import { PreviewArea } from './PreviewArea'
import { useOutputScreenController } from '@/features/preview/hooks/useOutputScreenController'
import type { OutputScreenProps } from '@/features/preview/types'

type MobileOutputTab = 'chat' | 'preview'

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

    const [mobileActiveTab, setMobileActiveTab] = React.useState<MobileOutputTab>('chat')
    const handleBack = onBack || (() => {})

    return (
        <div className="w-full h-full bg-black text-white font-sans overflow-hidden">
            <div className="md:hidden flex h-full min-h-0 flex-col bg-[#0F0F0F]">
                <div className="flex-1 min-h-0 px-2 pt-2 pb-2 overflow-hidden">
                    <div
                        className={
                            mobileActiveTab === 'chat' ? 'h-full min-h-0' : 'hidden h-full min-h-0'
                        }
                    >
                        <ChatSidebar
                            mode="mobile"
                            onBack={handleBack}
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
                            isCollapsed={false}
                            onClose={() => {}}
                        />
                    </div>

                    <div
                        className={
                            mobileActiveTab === 'preview'
                                ? 'h-full min-h-0 flex'
                                : 'hidden h-full min-h-0 flex'
                        }
                    >
                        <PreviewArea
                            html={previewHtml}
                            isGenerating={isGenerating}
                            device="desktop"
                            isVisualMode={isVisualMode}
                            onMessage={handleIframeMessage}
                            iframeRef={iframeRef}
                            fullscreen
                        />
                    </div>
                </div>

                <div className="shrink-0 px-2 pb-2">
                    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#1F1F1F] p-1">
                        <button
                            onClick={() => setMobileActiveTab('chat')}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                mobileActiveTab === 'chat'
                                    ? 'bg-[#2B2B2B] text-white'
                                    : 'text-[#91908F] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setMobileActiveTab('preview')}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                mobileActiveTab === 'preview'
                                    ? 'bg-[#2B2B2B] text-white'
                                    : 'text-[#91908F] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Preview
                        </button>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex w-full h-full overflow-hidden">
                <ChatSidebar
                    onBack={handleBack}
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
        </div>
    )
}
