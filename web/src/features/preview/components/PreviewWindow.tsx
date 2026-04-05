import React, { useState, useRef } from 'react'

import { OutputHeader } from './OutputHeader'
import { PreviewArea } from './PreviewArea'
import { CodeWorkspace } from './CodeWorkspace'

import Canvas from '@/features/canvas/components/Canvas'
import type { PreviewWindowProps } from '@/features/preview/types'

const PreviewWindow: React.FC<PreviewWindowProps> = ({
    code,
    status,
    isSidebarCollapsed,
    onToggleSidebar,
    isVisualMode,
    onElementSelected,
    onClearSelection,
}) => {
    const [viewMode, setViewMode] = useState<'preview' | 'code' | 'canvas'>('preview')
    const [device, setDevice] = useState<'desktop' | 'mobile' | 'tablet'>('desktop')
    const [previewHtml, setPreviewHtml] = useState(code)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    React.useEffect(() => {
        setPreviewHtml(code)
    }, [code])

    const handleOpenInNewTab = () => {
        const win = window.open('', '_blank')
        if (win) {
            win.document.write(previewHtml)
            win.document.close()
        }
    }

    const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'element-selected') {
            onElementSelected({
                tagName: event.data.tagName,
                textContent: event.data.textContent,
            })
        }
        if (event.data.type === 'selection-cleared') {
            onClearSelection()
        }
    }

    // Effect to toggle visual mode in iframe
    React.useEffect(() => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                {
                    type: 'toggle-visual-mode',
                    isActive: isVisualMode,
                },
                '*'
            )
        }
    }, [isVisualMode])

    return (
        <div className="w-full h-full flex flex-col bg-zinc-900 overflow-hidden min-h-0">
            <OutputHeader
                activeTab={viewMode}
                setActiveTab={setViewMode}
                device={device}
                setDevice={setDevice}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={onToggleSidebar}
                onOpenNewTab={handleOpenInNewTab}
            />

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 relative bg-black flex justify-center overflow-hidden">
                {viewMode === 'preview' && (
                    <PreviewArea
                        html={previewHtml}
                        isGenerating={status === 'thinking'}
                        device={device}
                        isVisualMode={isVisualMode}
                        onMessage={handleMessage}
                        iframeRef={iframeRef}
                    />
                )}

                {viewMode === 'code' && (
                    <CodeWorkspace html={previewHtml} onHtmlChange={setPreviewHtml} />
                )}

                {viewMode === 'canvas' && (
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

export default PreviewWindow
