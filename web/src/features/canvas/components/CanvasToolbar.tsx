import React, { useState } from 'react'
import { CanvasToolbarTopBar } from './CanvasToolbarTopBar'
import { CanvasToolbarBottomControls } from './CanvasToolbarBottomControls'
import { CanvasWebClipModal } from './CanvasWebClipModal'
import type { CanvasToolbarProps } from '@/features/canvas/types'

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    activeTool,
    setActiveTool,
    onAddItem,
    onAddItems,
    scale,
    setScale,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    hasInteracted,
    onInteract,
    isAuthenticated,
    onOpenAuth,
    projectId,
}) => {
    const [isWebClipModalOpen, setIsWebClipModalOpen] = useState(false)

    const handleAuthCheck = (action: () => void) => {
        if (!isAuthenticated && onOpenAuth) {
            onOpenAuth()
            return
        }
        action()
    }

    const handleImageUpload = () => {
        handleAuthCheck(() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (event) => {
                onInteract()
                const file = (event.target as HTMLInputElement).files?.[0]
                if (!file) return

                const reader = new FileReader()
                reader.onload = (readerEvent) => {
                    if (readerEvent.target?.result) {
                        onAddItem('image', readerEvent.target.result as string)
                    }
                }
                reader.readAsDataURL(file)
            }
            input.click()
        })
    }

    const handleSelectTool = (tool: string) => {
        handleAuthCheck(() => setActiveTool(tool))
    }

    const handleOpenWebClipModal = () => {
        handleAuthCheck(() => setIsWebClipModalOpen(true))
    }

    return (
        <div className="absolute inset-0 z-40 pointer-events-none">
            <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full px-4 md:px-0 pointer-events-none">
                <CanvasToolbarTopBar
                    activeTool={activeTool}
                    isWebClipModalOpen={isWebClipModalOpen}
                    onSelectTool={handleSelectTool}
                    onUploadImage={handleImageUpload}
                    onOpenWebClipModal={handleOpenWebClipModal}
                    onOpenHelp={() => window.open('https://www.youtube.com/@phasehumans', '_blank')}
                />
            </div>

            <CanvasToolbarBottomControls
                scale={scale}
                setScale={setScale}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
            />

            <CanvasWebClipModal
                isOpen={isWebClipModalOpen}
                onClose={() => setIsWebClipModalOpen(false)}
                onInteract={onInteract}
                onAddItems={onAddItems}
                projectId={projectId}
            />
        </div>
    )
}
