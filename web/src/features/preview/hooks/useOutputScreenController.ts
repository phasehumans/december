import React from 'react'
import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewDevice,
    PreviewRuntimeError,
    PreviewSelectedElement,
    PreviewSessionStatus,
    PreviewTab,
} from '@/features/preview/types'

interface UseOutputScreenControllerArgs {
    isGenerating: boolean
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath?: string | null
    generationPhase?: 'thinking' | 'planning' | 'building' | 'done' | null
    activeOperation?: OutputOperation | null
    onPromptSubmit: (
        prompt: string,
        options?: { selectedElement?: PreviewSelectedElement }
    ) => Promise<void> | void
    onRuntimeError?: (error: PreviewRuntimeError) => Promise<void> | void
    previewSession?: PreviewSessionStatus | null
}

const getPreviewHtmlFromFiles = (generatedFiles?: Record<string, GeneratedProjectFile>) => {
    if (!generatedFiles) {
        return ''
    }

    return (
        generatedFiles['web/index.html']?.content ||
        generatedFiles['public/index.html']?.content ||
        generatedFiles['index.html']?.content ||
        ''
    )
}

const getOperationSteps = (operation: OutputOperation | null | undefined) => {
    if (operation === 'edit') {
        return [
            'Reading the current project files',
            'Planning a minimal code patch',
            'Applying targeted file changes',
            'Refreshing the saved project version',
        ]
    }

    if (operation === 'fix') {
        return [
            'Capturing the preview runtime error',
            'Tracing the failing file path',
            'Applying the smallest reliable fix',
            'Refreshing the saved project version',
        ]
    }

    return [
        'Analyzing request intent',
        'Locking implementation plan',
        'Preparing build order and file tree',
        'Streaming file generation to the IDE',
        'Finalizing generated project output',
    ]
}

export const useOutputScreenController = ({
    isGenerating,
    generatedFiles,
    generationPhase,
    activeOperation,
    onPromptSubmit,
    onRuntimeError,
    previewSession,
}: UseOutputScreenControllerArgs) => {
    const [activeTab, setActiveTab] = React.useState<PreviewTab>('preview')
    const [device, setDevice] = React.useState<PreviewDevice>('desktop')
    const [previewHtml, setPreviewHtml] = React.useState(PREVIEW_HTML)
    const [isVisualMode, setIsVisualMode] = React.useState(false)
    const [selectedElement, setSelectedElement] = React.useState<PreviewSelectedElement | null>(
        null
    )
    const [editPrompt, setEditPrompt] = React.useState('')
    const [isApplyingEdit, setIsApplyingEdit] = React.useState(false)
    const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = React.useState(false)
    const [steps, setSteps] = React.useState<string[]>([])
    const [isThoughtsOpen, setIsThoughtsOpen] = React.useState(true)
    const [executionTime, setExecutionTime] = React.useState(0)
    const iframeRef = React.useRef<HTMLIFrameElement>(null)
    const hasSwitchedToCodeForBuildRef = React.useRef(false)

    React.useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                setIsChatSidebarCollapsed(true)
                setDevice('mobile')
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

        setSteps([])
        setIsThoughtsOpen(true)
        hasSwitchedToCodeForBuildRef.current = false
        setActiveTab(activeOperation === 'build' || !activeOperation ? 'preview' : 'code')

        const sequences = getOperationSteps(activeOperation)
        let stepIndex = 0
        const stepInterval = setInterval(() => {
            if (stepIndex < sequences.length) {
                setSteps((prev) => [...prev, sequences[stepIndex]!])
                stepIndex += 1
            } else {
                clearInterval(stepInterval)
            }
        }, 800)

        return () => {
            clearInterval(timerInterval)
            clearInterval(stepInterval)
        }
    }, [activeOperation, isGenerating])

    React.useEffect(() => {
        if (!isGenerating && steps.length > 0) {
            const timeout = setTimeout(() => setIsThoughtsOpen(false), 2000)
            return () => clearTimeout(timeout)
        }
    }, [isGenerating, steps.length])

    React.useEffect(() => {
        if (generationPhase === 'building' && !hasSwitchedToCodeForBuildRef.current) {
            hasSwitchedToCodeForBuildRef.current = true
            setActiveTab('code')
        }
    }, [generationPhase])

    React.useEffect(() => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                {
                    type: 'toggle-visual-mode',
                    isActive: isVisualMode,
                },
                '*'
            )

            if (!isVisualMode) {
                setSelectedElement(null)
            }
        }
    }, [isVisualMode])

    React.useEffect(() => {
        const generatedPreviewHtml = getPreviewHtmlFromFiles(generatedFiles)

        if (generatedPreviewHtml.trim()) {
            setPreviewHtml(generatedPreviewHtml)
            return
        }

        setPreviewHtml(PREVIEW_HTML)
    }, [generatedFiles])

    const handleIframeMessage = React.useCallback(
        (event: MessageEvent) => {
            if (event.data?.type === 'element-selected') {
                setSelectedElement(event.data)
                return
            }

            if (event.data?.type === 'selection-cleared') {
                setSelectedElement(null)
                return
            }

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
            await Promise.resolve(
                onPromptSubmit(nextPrompt, {
                    ...(selectedElement ? { selectedElement } : {}),
                })
            )
            didApply = true
        } finally {
            setIsApplyingEdit(false)

            if (didApply) {
                setEditPrompt('')
                setSelectedElement(null)

                if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: 'selection-cleared' }, '*')
                }
            }
        }
    }, [editPrompt, onPromptSubmit, selectedElement])

    const handleClearSelection = () => {
        setSelectedElement(null)

        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'selection-cleared' }, '*')
        }
    }

    const handleOpenInNewTab = () => {
        if (previewSession?.previewUrl) {
            window.open(previewSession.previewUrl, '_blank', 'noopener,noreferrer')
            return
        }

        const newWindow = window.open('', '_blank')

        if (newWindow) {
            newWindow.document.write(previewHtml)
            newWindow.document.close()
        }
    }

    return {
        activeTab,
        setActiveTab,
        device,
        setDevice,
        previewHtml,
        setPreviewHtml,
        isVisualMode,
        setIsVisualMode,
        selectedElement,
        editPrompt,
        setEditPrompt,
        isApplyingEdit,
        isChatSidebarCollapsed,
        setIsChatSidebarCollapsed,
        steps,
        isThoughtsOpen,
        setIsThoughtsOpen,
        executionTime,
        iframeRef,
        handleIframeMessage,
        handleApplyEdit,
        handleClearSelection,
        handleOpenInNewTab,
    }
}
