import React from 'react'

import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewRuntimeError,
    PreviewSessionStatus,
    PreviewTab,
} from '@/features/preview/types'

interface UseWorkspaceScreenControllerArgs {
    isGenerating: boolean
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath?: string | null
    generationPhase?: 'thinking' | 'building' | 'done' | null
    activeOperation?: OutputOperation | null
    onPromptSubmit: (prompt: string) => Promise<void> | void
    onRuntimeError?: (error: PreviewRuntimeError) => Promise<void> | void
    previewSession?: PreviewSessionStatus | null
}

export const useWorkspaceScreenController = ({
    isGenerating,
    activeOperation,
    onPromptSubmit,
    onRuntimeError,
    previewSession,
}: UseWorkspaceScreenControllerArgs) => {
    const [activeTab, setActiveTab] = React.useState<PreviewTab>('preview')
    const [editPrompt, setEditPrompt] = React.useState('')
    const [isApplyingEdit, setIsApplyingEdit] = React.useState(false)
    const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = React.useState(false)
    const [executionTime, setExecutionTime] = React.useState(0)
    const iframeRef = React.useRef<HTMLIFrameElement>(null)
    const hasSwitchedToCodeForBuildRef = React.useRef(false)

    React.useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                setIsChatSidebarCollapsed(true)
            }
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    React.useEffect(() => {
        if (!isGenerating) {
            setIsApplyingEdit(false)
            return
        }

        const start = Date.now()
        const timerInterval = setInterval(() => {
            setExecutionTime((Date.now() - start) / 1000)
        }, 100)

        hasSwitchedToCodeForBuildRef.current = false
        setActiveTab((prev) => (activeOperation === 'build' || !activeOperation ? 'preview' : prev))

        return () => {
            clearInterval(timerInterval)
        }
    }, [activeOperation, isGenerating])

    React.useEffect(() => {
        if (!isGenerating && previewSession?.backendStatus === 'ready') {
            setActiveTab('preview')
        }
    }, [isGenerating, previewSession?.backendStatus])

    const handleIframeMessage = React.useCallback(
        (event: MessageEvent) => {
            if (event.data?.type === 'runtime-error' && onRuntimeError) {
                void onRuntimeError({
                    message: event.data.message,
                    stack: event.data.stack,
                })
            }
        },
        [onRuntimeError]
    )

    const handleApplyEdit = React.useCallback(async () => {
        const nextPrompt = editPrompt.trim()

        if (!nextPrompt) {
            return
        }

        setIsApplyingEdit(true)
        let didApply = false

        try {
            await Promise.resolve(onPromptSubmit(nextPrompt))
            didApply = true
        } finally {
            setIsApplyingEdit(false)

            if (didApply) {
                setEditPrompt('')
            }
        }
    }, [editPrompt, onPromptSubmit])

    const handleOpenInNewTab = () => {
        if (previewSession?.previewUrl) {
            window.open(previewSession.previewUrl, '_blank', 'noopener,noreferrer')
        }
    }

    const handleRefreshPreview = React.useCallback(() => {
        window.dispatchEvent(new CustomEvent('december-preview-refresh-triggered'))
        if (iframeRef.current) {
            try {
                if (iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.location.reload()
                }
            } catch {
                if (iframeRef.current.src) {
                    const src = iframeRef.current.src
                    iframeRef.current.src = ''
                    iframeRef.current.src = src
                }
            }
        }
    }, [])

    return {
        activeTab,
        setActiveTab,
        editPrompt,
        setEditPrompt,
        isApplyingEdit,
        isChatSidebarCollapsed,
        setIsChatSidebarCollapsed,
        executionTime,
        iframeRef,
        handleIframeMessage,
        handleApplyEdit,
        handleOpenInNewTab,
        handleRefreshPreview,
    }
}

export const useOutputScreenController = useWorkspaceScreenController
