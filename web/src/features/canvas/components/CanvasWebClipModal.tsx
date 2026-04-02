import React from 'react'
import { Globe } from 'lucide-react'
import { canvasAPI } from '@/features/canvas/api'
import type { CanvasItemDraft } from '@/features/canvas/types'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Modal } from '@/shared/components/ui/Modal'

interface CanvasWebClipModalProps {
    isOpen: boolean
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

export const CanvasWebClipModal: React.FC<CanvasWebClipModalProps> = ({
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
            onAddItems(
                result.clips.map((clip) => ({
                    type: 'image',
                    content: clip.content,
                    width: Math.min(clip.width, 360),
                    height: Math.max(Math.round(Math.min(clip.height, 900) * (Math.min(clip.width, 360) / clip.width)), 180),
                    assetKey: clip.assetKey,
                    assetSource: clip.assetSource,
                    assetContentType: clip.assetContentType,
                    assetKind: clip.assetKind,
                }))
            )

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
            onClose={onClose}
            title="Clip Website"
            description="Capture a website into canvas-ready image cards."
        >
            <div className="space-y-4">
                <Input
                    autoFocus
                    label="Website URL"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleSubmit()
                        }
                    }}
                    leftIcon={<Globe size={14} />}
                    error={error ?? undefined}
                    disabled={isSubmitting}
                />

                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
                        Add To Canvas
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
