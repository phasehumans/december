import React, { useState, useRef } from 'react'
import { OutputHeader } from './features/preview/OutputHeader'
import { PreviewArea } from './features/preview/PreviewArea'

interface PreviewWindowProps {
    code: string
    status: 'thinking' | 'done' | 'error'
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
    isVisualMode: boolean
    onElementSelected: (element: { tagName: string; textContent: string }) => void
    onClearSelection: () => void
}

const PreviewWindow: React.FC<PreviewWindowProps> = ({
    code,
    status,
    isSidebarCollapsed,
    onToggleSidebar,
    isVisualMode,
    onElementSelected,
    onClearSelection,
}) => {
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
    const [device, setDevice] = useState<'desktop' | 'mobile' | 'tablet'>('desktop')
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const handleOpenInNewTab = () => {
        const win = window.open('', '_blank')
        if (win) {
            win.document.write(code)
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
        <div className="w-full h-full flex flex-col bg-zinc-900 overflow-hidden">
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
            <div className="flex-1 relative bg-black flex justify-center overflow-hidden">
                {viewMode === 'preview' ? (
                    <PreviewArea
                        html={code}
                        isGenerating={status === 'thinking'}
                        device={device}
                        isVisualMode={isVisualMode}
                        onMessage={handleMessage}
                        iframeRef={iframeRef}
                    />
                ) : (
                    <div className="w-full h-full overflow-auto bg-[#111] p-6">
                        <pre className="text-xs font-mono text-neutral-300 leading-relaxed">
                            <code>{code}</code>
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PreviewWindow
