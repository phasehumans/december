import React from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'

import { canvasAPI } from '@/features/canvas/api'
import type { CanvasItemDraft } from '@/features/canvas/types'
import { Button } from '@/shared/components/ui/Button'

interface CanvasWebClipPopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLButtonElement | null>
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
            if (!anchor) {
                return
            }

            const horizontalPadding = 12
            const width = Math.min(420, window.innerWidth - horizontalPadding * 2)
            const rect = anchor.getBoundingClientRect()
            const unclampedLeft = rect.left + rect.width / 2 - width / 2
            const left = Math.min(
                Math.max(unclampedLeft, horizontalPadding),
                window.innerWidth - width - horizontalPadding
            )

            setPosition({
                top: rect.bottom + 10,
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
    }, [anchorRef, isOpen])

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
            className="fixed z-[70] rounded-xl border border-white/10 bg-[#171615] p-3 shadow-2xl ring-1 ring-white/5 pointer-events-auto"
            style={{
                top: position.top,
                left: position.left,
                width: position.width,
            }}
        >
            <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <Globe
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                    />
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
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#242323] pl-9 pr-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSubmit()}
                    isLoading={isSubmitting}
                    className="shrink-0"
                >
                    Get Clips
                </Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>,
        document.body
    )
}
