import { useState, useEffect } from 'react'

export const usePreviewAreaController = ({
    projectId,
    previewState,
    previewUrl,
    onMessage,
}: {
    projectId?: string
    previewState?: string
    previewUrl?: string
    onMessage: (e: MessageEvent) => void
}) => {
    const [isCopied, setIsCopied] = useState(false)
    const [isImportStreaming, setIsImportStreaming] = useState(false)
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [onMessage])

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMounted(true)
        }, 500)

        const handleRefreshTriggered = () => {
            setHasLoadedOnce(true)
        }
        window.addEventListener('december-preview-refresh-triggered', handleRefreshTriggered)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('december-preview-refresh-triggered', handleRefreshTriggered)
        }
    }, [])

    useEffect(() => {
        setHasLoadedOnce(false)
    }, [projectId])

    useEffect(() => {
        if (previewState === 'Healthy' && previewUrl) {
            setHasLoadedOnce(true)
        }
    }, [previewState, previewUrl])

    useEffect(() => {
        const handleStart = (e: Event) => {
            const customEvent = e as CustomEvent
            if (customEvent.detail?.projectId === projectId) {
                setIsImportStreaming(true)
            }
        }
        const handleEnd = (e: Event) => {
            const customEvent = e as CustomEvent
            if (customEvent.detail?.projectId === projectId) {
                setIsImportStreaming(false)
            }
        }

        window.addEventListener('december-import-stream-start', handleStart)
        window.addEventListener('december-import-stream-end', handleEnd)

        if (
            projectId &&
            sessionStorage.getItem(`december_import_stream_running_${projectId}`) === 'true'
        ) {
            setIsImportStreaming(true)
        } else {
            setIsImportStreaming(false)
        }

        return () => {
            window.removeEventListener('december-import-stream-start', handleStart)
            window.removeEventListener('december-import-stream-end', handleEnd)
        }
    }, [projectId])

    const copyErrorToClipboard = (previewError: any, previewSessionError: any) => {
        const errorText = `${previewError?.message ?? ''}\n${previewError?.detail ?? ''}\n${previewSessionError ?? ''}`
        void navigator.clipboard.writeText(errorText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return {
        isCopied,
        isImportStreaming,
        hasLoadedOnce,
        isMounted,
        copyErrorToClipboard,
    }
}
