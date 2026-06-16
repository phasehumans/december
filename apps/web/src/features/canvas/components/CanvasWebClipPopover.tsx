import React from 'react'

import type { CanvasItemDraft } from '@/features/canvas/types'

import { canvasAPI } from '@/features/canvas/api'
import { Modal } from '@/shared/components/ui/Modal'

interface CanvasWebClipPopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLButtonElement | null>
    containerRef?: React.RefObject<HTMLDivElement | null>
    onClose: () => void
    onInteract: () => void
    onAddItems: (items: CanvasItemDraft[]) => void
    projectId?: string | null
}

const isValidHttpUrl = (value: string) => {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

const mapClipToCanvasItem = (clip: {
    content: string
    width: number
    height: number
    assetKey: string
    assetSource: 'temporary' | 'project'
    assetContentType: string
    assetKind: 'upload' | 'web-clip'
}): CanvasItemDraft => {
    const width = Math.min(clip.width, 360)
    const height =
        clip.width > 0 ? Math.max(Math.round(clip.height * (width / clip.width)), 180) : 180

    return {
        type: 'image',
        content: clip.content,
        width,
        height,
        assetKey: clip.assetKey,
        assetSource: clip.assetSource,
        assetContentType: clip.assetContentType,
        assetKind: clip.assetKind,
    }
}

export const CanvasWebClipPopover: React.FC<CanvasWebClipPopoverProps> = ({
    isOpen,
    onClose,
    onInteract,
    onAddItems,
    projectId,
}) => {
    const [url, setUrl] = React.useState('')
    const [error, setError] = React.useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    React.useEffect(() => {
        if (!isOpen) {
            setUrl('')
            setError(null)
            setIsSubmitting(false)
        }
    }, [isOpen])

    const handleSubmit = async () => {
        const nextUrl = url.trim()

        if (!nextUrl) {
            setError('Enter a website URL.')
            return
        }

        if (!isValidHttpUrl(nextUrl)) {
            setError('Enter a valid http:// or https:// URL.')
            return
        }

        setError(null)
        setIsSubmitting(true)

        try {
            const result = await canvasAPI.createWebClips({
                url: nextUrl,
                projectId,
            })

            onInteract()
            onAddItems(result.clips.map(mapClipToCanvasItem))
            onClose()
        } catch (submissionError) {
            setError(
                submissionError instanceof Error
                    ? submissionError.message
                    : 'Failed to create web clips.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={isSubmitting ? () => {} : onClose}
            title="Web Clipper"
            description="Enter a website URL to instantly clip screenshots and content onto your visual Canvas workspace."
            variant="premium"
        >
            <div className="flex flex-col gap-4">
                {!isSubmitting ? (
                    <>
                        <div>
                            <label
                                htmlFor="webclipper-url-input"
                                className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                            >
                                Website URL
                            </label>
                            <input
                                id="webclipper-url-input"
                                type="url"
                                autoFocus
                                value={url}
                                onChange={(e) => {
                                    setUrl(e.target.value)
                                    setError(null)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void handleSubmit()
                                    }
                                }}
                                className="w-full bg-[#181817] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow]"
                                placeholder="https://example.com"
                                autoComplete="off"
                                disabled={isSubmitting}
                            />
                        </div>

                        {error && (
                            <p className="text-[12px] text-red-500 font-medium px-1">{error}</p>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={!url.trim() || isSubmitting}
                                className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[110px] cursor-pointer"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-4 animate-in fade-in duration-300">
                        {/* Elegant, minimal spinner */}
                        <div className="w-6 h-6 border-[2px] border-[#D6D5C9]/20 border-t-[#D6D5C9] rounded-full animate-spin" />
                        <div className="flex flex-col gap-1 max-w-[280px]">
                            <h3 className="text-white font-medium text-[14px]">
                                Clipping webpage...
                            </h3>
                            <p className="text-[12px] text-[#8F8E8D] leading-relaxed">
                                This process takes 60-90 seconds. Please wait while we generate
                                screenshots and structure elements.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
