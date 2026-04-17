import React from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'

import { canvasAPI } from '@/features/canvas/api'
import type { CanvasItemDraft } from '@/features/canvas/types'
import { Button } from '@/shared/components/ui/Button'

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
    anchorRef,
    containerRef,
    onClose,
    onInteract,
    onAddItems,
    projectId,
}) => {
    const popoverRef = React.useRef<HTMLDivElement | null>(null)
    const [url, setUrl] = React.useState('')
    const [error, setError] = React.useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [position, setPosition] = React.useState<{
        top: number
        left: number
        width: number
    } | null>(null)

    React.useEffect(() => {
        if (!isOpen) {
            setUrl('')
            setError(null)
            setIsSubmitting(false)
            setPosition(null)
        }
    }, [isOpen])

    React.useLayoutEffect(() => {
        if (!isOpen || !anchorRef.current || typeof window === 'undefined') {
            return
        }

        const updatePosition = () => {
            const anchor = anchorRef.current
            const container = containerRef?.current
            if (!anchor) {
                return
            }

            const horizontalPadding = 12
            const width = Math.min(440, window.innerWidth - horizontalPadding * 2)

            // If containerRef is provided (the toolbar), align with it
            // Otherwise align with the anchor button
            const targetElement = container || anchor
            const rect = targetElement.getBoundingClientRect()

            const unclampedLeft = rect.left + rect.width / 2 - width / 2
            const left = Math.min(
                Math.max(unclampedLeft, horizontalPadding),
                window.innerWidth - width - horizontalPadding
            )

            setPosition({
                top: rect.bottom + 8,
                left,
                width,
            })
        }

        updatePosition()

        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [anchorRef, containerRef, isOpen])

    React.useEffect(() => {
        if (!isOpen) {
            return
        }

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null

            if (
                (target && popoverRef.current?.contains(target)) ||
                (target && anchorRef.current?.contains(target))
            ) {
                return
            }

            if (!isSubmitting) {
                onClose()
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isSubmitting) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [anchorRef, isOpen, isSubmitting, onClose])

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

    if (!isOpen || !position || typeof document === 'undefined') {
        return null
    }

    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[70] rounded-[14px] border border-white/10 bg-[#171615]/90 backdrop-blur-xl p-1.5 pointer-events-auto animate-popoverIn"
            style={{
                top: position.top,
                left: position.left,
                width: position.width,
            }}
        >
            <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Globe className="w-3.5 h-3.5 text-[#656565]" strokeWidth={2} />
                    </div>
                    <input
                        autoFocus
                        type="url"
                        placeholder="https://example.com"
                        value={url}
                        disabled={isSubmitting}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                void handleSubmit()
                            }
                        }}
                        className="w-full bg-[#0D0D0B] border border-white/5 focus:border-white/20 rounded-[10px] h-10 pl-9 pr-3 text-[13px] text-[#D6D5D4] placeholder-[#4A4A4A] outline-none transition-all disabled:opacity-50 font-medium"
                    />
                </div>
                <button
                    type="button"
                    disabled={isSubmitting || !url.trim()}
                    onClick={() => void handleSubmit()}
                    className="h-10 px-4 rounded-[10px] bg-[#D6D5D4] hover:bg-white text-[#111] text-[13px] font-semibold disabled:opacity-30 disabled:grayscale transition-all shrink-0 flex items-center justify-center min-w-[90px] shadow-sm active:scale-[0.98]"
                >
                    {isSubmitting ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#111]/20 border-t-[#111] rounded-full animate-spin" />
                    ) : (
                        'Get Clips'
                    )}
                </button>
            </div>
            {error && <p className="mt-2.5 px-2 text-[11px] text-red-500 font-medium">{error}</p>}
        </div>,
        document.body
    )
}
