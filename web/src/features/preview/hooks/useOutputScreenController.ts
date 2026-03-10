import React from 'react'
import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import type { PreviewDevice, PreviewSelectedElement, PreviewTab } from '@/features/preview/types'

interface UseOutputScreenControllerArgs {
    isGenerating: boolean
}

export const useOutputScreenController = ({ isGenerating }: UseOutputScreenControllerArgs) => {
    const [activeTab, setActiveTab] = React.useState<PreviewTab>('preview')
    const [device, setDevice] = React.useState<PreviewDevice>('desktop')
    const [previewHtml, setPreviewHtml] = React.useState(PREVIEW_HTML)
    const [isVisualMode, setIsVisualMode] = React.useState(false)
    const [selectedElement, setSelectedElement] = React.useState<PreviewSelectedElement | null>(null)
    const [editPrompt, setEditPrompt] = React.useState('')
    const [isApplyingEdit, setIsApplyingEdit] = React.useState(false)
    const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = React.useState(false)
    const [steps, setSteps] = React.useState<string[]>([])
    const [isThoughtsOpen, setIsThoughtsOpen] = React.useState(true)
    const [executionTime, setExecutionTime] = React.useState(0)
    const iframeRef = React.useRef<HTMLIFrameElement>(null)

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
        let timerInterval: ReturnType<typeof setInterval>

        if (isGenerating) {
            const start = Date.now()
            timerInterval = setInterval(() => {
                setExecutionTime((Date.now() - start) / 1000)
            }, 100)

            setSteps([])
            setIsThoughtsOpen(true)

            const sequences = [
                'Analyzing request intent',
                'Scaffolding component architecture',
                'Generating Tailwind utility classes',
                'Synthesizing responsive layout',
                'Finalizing render pass',
            ]

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
        }

        if (steps.length > 0) {
            const timeout = setTimeout(() => setIsThoughtsOpen(false), 2000)
            return () => clearTimeout(timeout)
        }
    }, [isGenerating, steps.length])

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

    const handleIframeMessage = React.useCallback((event: MessageEvent) => {
        if (event.data.type === 'element-selected') {
            setSelectedElement(event.data)
            return
        }

        if (event.data.type === 'selection-cleared') {
            setSelectedElement(null)
        }
    }, [])

    const handleApplyEdit = () => {
        if (!editPrompt.trim()) {
            return
        }

        setIsApplyingEdit(true)

        setTimeout(() => {
            setIsApplyingEdit(false)
            setEditPrompt('')

            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ type: 'apply-changes' }, '*')
            }

            setSelectedElement(null)
        }, 1000)
    }

    const handleClearSelection = () => {
        setSelectedElement(null)

        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'selection-cleared' }, '*')
        }
    }

    const handleOpenInNewTab = () => {
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
