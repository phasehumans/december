import React, { useState } from 'react'
import { CanvasToolbarTopBar } from './CanvasToolbarTopBar'
import { CanvasToolbarLinkPopover } from './CanvasToolbarLinkPopover'
import { CanvasToolbarBottomControls } from './CanvasToolbarBottomControls'
import type { CanvasToolbarProps } from '@/features/canvas/types'

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    activeTool,
    setActiveTool,
    onAddItem,
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
}) => {
    const [isLinkInputOpen, setIsLinkInputOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')

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

    const handleLinkSubmit = () => {
        handleAuthCheck(() => {
            onInteract()
            if (!linkUrl) return
            onAddItem('link', linkUrl)
            setLinkUrl('')
            setIsLinkInputOpen(false)
        })
    }

    const handleSelectTool = (tool: string) => {
        handleAuthCheck(() => setActiveTool(tool))
    }

    const handleToggleLinkInput = () => {
        handleAuthCheck(() => setIsLinkInputOpen(!isLinkInputOpen))
    }

    return (
        <div className="absolute inset-0 z-40 pointer-events-none">
            <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full px-4 md:px-0 pointer-events-none">
                <CanvasToolbarTopBar
                    activeTool={activeTool}
                    isLinkInputOpen={isLinkInputOpen}
                    onSelectTool={handleSelectTool}
                    onUploadImage={handleImageUpload}
                    onToggleLinkInput={handleToggleLinkInput}
                    onOpenHelp={() => window.open('https://www.youtube.com/@phasehumans', '_blank')}
                />

                <CanvasToolbarLinkPopover
                    isOpen={isLinkInputOpen}
                    linkUrl={linkUrl}
                    setLinkUrl={setLinkUrl}
                    onSubmit={handleLinkSubmit}
                    onClose={() => setIsLinkInputOpen(false)}
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
        </div>
    )
}
