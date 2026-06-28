import { ChevronLeft } from 'lucide-react'
import React, { useRef } from 'react'

import Canvas, { type CanvasRef } from '@/features/canvas/components/Canvas'
import type { CanvasDocument } from '@/features/canvas/types'

interface CanvasPageProps {
    onBack?: () => void
    canvasState: CanvasDocument
    onCanvasStateChange: (document: CanvasDocument) => void
    isAuthenticated: boolean
    onOpenAuth?: () => void
    projectId?: string
}

export const CanvasPage: React.FC<CanvasPageProps> = ({
    onBack,
    canvasState,
    onCanvasStateChange,
    isAuthenticated,
    onOpenAuth,
    projectId,
}) => {
    const canvasRef = useRef<CanvasRef>(null)

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px] font-sans">
            <div className="flex w-full h-full bg-[#141414] rounded-lg border border-[#242323] overflow-hidden relative">
                <div className="flex w-full h-full items-start justify-center relative overflow-hidden">
                    <Canvas
                        ref={canvasRef}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                        document={canvasState}
                        onDocumentChange={onCanvasStateChange}
                        projectId={projectId}
                    />
                </div>
            </div>
        </div>
    )
}
