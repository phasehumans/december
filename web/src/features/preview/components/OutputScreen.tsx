import React, { useState, useEffect, useRef, useCallback } from 'react'
import { OutputHeader } from './OutputHeader'
import { ChatThread as ChatSidebar } from '@/features/chat/components/ChatThread'
import { PreviewArea } from './PreviewArea'
import { CodeWorkspace } from './CodeWorkspace'
import Canvas from '@/features/canvas/components/Canvas'
import { PREVIEW_HTML } from '../constants/preview'
import type { OutputScreenProps } from '@/features/preview/types'

export const OutputScreen: React.FC<OutputScreenProps> = ({ onBack, isGenerating = false }) => {
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'canvas'>('preview')
    const [device, setDevice] = useState<'desktop' | 'mobile' | 'tablet'>('desktop')
    const [previewHtml, setPreviewHtml] = useState(PREVIEW_HTML)
    const [isVisualMode, setIsVisualMode] = useState(false)
    const [selectedElement, setSelectedElement] = useState<{
        tagName: string
        textContent: string
    } | null>(null)
    const [editPrompt, setEditPrompt] = useState('')
    const [isApplyingEdit, setIsApplyingEdit] = useState(false)
    const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Thought Process State
    const [steps, setSteps] = useState<string[]>([])
    const [isThoughtsOpen, setIsThoughtsOpen] = useState(true)
    const [executionTime, setExecutionTime] = useState(0)

    // Timer for thought process
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                setIsChatSidebarCollapsed(true)
                setDevice('mobile')
            }
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>
        if (isGenerating) {
            const start = Date.now()
            interval = setInterval(() => {
                setExecutionTime((Date.now() - start) / 1000)
            }, 100)

            // Reset steps
            setSteps([])
            setIsThoughtsOpen(true)

            // Simulate steps
            const sequences = [
                'Analyzing request intent',
                'Scaffolding component architecture',
                'Generating Tailwind utility classes',
                'Synthesizing responsive layout',
                'Finalizing render pass',
            ]

            let i = 0
            const stepInterval = setInterval(() => {
                if (i < sequences.length) {
                    setSteps((prev) => [...prev, sequences[i]!])
                    i++
                } else {
                    clearInterval(stepInterval)
                }
            }, 800)

            return () => {
                clearInterval(interval)
                clearInterval(stepInterval)
            }
        } else if (steps.length > 0) {
            // Auto collapse thoughts when done after a delay
            const timeout = setTimeout(() => setIsThoughtsOpen(false), 2000)
            return () => clearTimeout(timeout)
        }
    }, [isGenerating])

    // Handle Visual Mode Messages via Callback
    const handleIframeMessage = useCallback((event: MessageEvent) => {
        if (event.data.type === 'element-selected') {
            setSelectedElement(event.data)
        } else if (event.data.type === 'selection-cleared') {
            setSelectedElement(null)
        }
    }, [])

    // Toggle Visual Mode in Iframe
    useEffect(() => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                {
                    type: 'toggle-visual-mode',
                    isActive: isVisualMode,
                },
                '*'
            )
            if (!isVisualMode) {
                setSelectedElement(null)
            }
        }
    }, [isVisualMode])

    const handleApplyEdit = () => {
        if (!editPrompt.trim()) return
        setIsApplyingEdit(true)

        // Simulate API delay
        setTimeout(() => {
            setIsApplyingEdit(false)
            setEditPrompt('')
            // Flash effect in iframe
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ type: 'apply-changes' }, '*')
            }
            setSelectedElement(null)
        }, 1000)
    }

    const handleClearSelection = () => {
        setSelectedElement(null)
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'selection-cleared' }, '*')
        }
    }

    const handleOpenInNewTab = () => {
        const win = window.open('', '_blank')
        if (win) {
            win.document.write(previewHtml)
            win.document.close()
        }
    }

    return (
        <div className="flex w-full h-full bg-black text-white font-sans overflow-hidden">
            {/* Sidebar - Chat / History */}
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

            {/* Main Content - Preview / Code / Canvas */}
            <div className="flex-1 flex flex-col h-full bg-[#0F0F0F] relative overflow-hidden transition-all duration-300 min-h-0">
                <OutputHeader
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    device={device}
                    setDevice={setDevice}
                    isSidebarCollapsed={isChatSidebarCollapsed}
                    onToggleSidebar={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
                    onOpenNewTab={handleOpenInNewTab}
                    onBack={onBack}
                />

                {activeTab === 'preview' && (
                    <PreviewArea
                        html={previewHtml}
                        isGenerating={isGenerating}
                        device={device}
                        isVisualMode={isVisualMode}
                        onMessage={handleIframeMessage}
                        iframeRef={iframeRef}
                    />
                )}

                {activeTab === 'code' && (
                    <CodeWorkspace html={previewHtml} onHtmlChange={setPreviewHtml} />
                )}

                {activeTab === 'canvas' && (
                    <div className="flex-1 min-h-0 p-2 bg-[#0F0F0F]">
                        <div className="w-full h-full rounded-xl border border-white/10 overflow-hidden">
                            <Canvas />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


