import { useQueryClient } from '@tanstack/react-query'
import React from 'react'

import type { ViewState } from '@/app/types'
import type { Message } from '@/features/chat/types'
import type { PromptInputSubmitOptions } from '@/features/home/types'
import type { PreviewRuntimeError } from '@/features/preview/types'

import { useAppStore } from '@/app/store'
import { billingAPI, type BillingOverview } from '@/features/billing/api/billing'
import { billingQueryKeys } from '@/features/billing/hooks/useBillingData'
import { decideRunEnd, decideSubmit, useMessageQueue } from '@/features/chat/messageQueue'
import { mapBackendMessageToUIMessage } from '@/features/chat/utils'
import {
    generationAPI,
    isOwnKeyError,
    type AppliedProjectChangeResult,
    type GenerationStreamEvent,
} from '@/features/generation/api/generation'
import { usePreferences } from '@/features/profile/lib/preferences'
import { FOLLOW_RUN_EVENT } from '@/shared/lib/appEvents'

/** a message this tab sent, until its run takes it (#637) */
interface SentMessage {
    sessionId: string
    text: string
    options?: PromptInputSubmitOptions
    /** sent to the running agent ("send now"), not as the prompt of a new run */
    steering: boolean
    /** the socket has it (the files are uploaded first) */
    emitted: boolean
}

// the worker says when a session is free for its next run (RunClosed). a queued message
// goes out then, or after this time when that event did not come
const QUEUE_SEND_WAIT_MS = 15_000

type DeliveredSteering = NonNullable<
    Extract<GenerationStreamEvent, { type: 'SteeringDelivered' }>['data']
>['messages']

export const useChatController = (
    view: ViewState,
    openProject: (args: {
        projectId: string
        versionId?: string | null
        originView?: ViewState
        abortActiveGeneration?: boolean
    }) => Promise<void>,
    generationAbortControllerRef: React.MutableRefObject<AbortController | null>,
    activeAssistantMessageIdRef: React.MutableRefObject<string | null>,
    outputOriginViewRef: React.MutableRefObject<ViewState>,
    lastAutoFixSignatureRef: React.MutableRefObject<string | null>
) => {
    const queryClient = useQueryClient()
    const {
        activeProjectId,
        activeProjectVersionId,
        setActiveProjectId,
        setActiveProjectName,
        setActiveProjectVersionId,
        setProjectVersions,
        setProjectLoadError,
        setMessages,
        setGenerationPhase,
        setActiveOperation,
        setIsGenerating,
        setProjectType,
        setCurrentGenerationFilePaths,
        appendAssistantChunk,
        appendThinkingChunk,
        appendStreamChunk,
        addToolCallBlock,
        appendToolCallOutput,
        updateToolCallResult,
        addFileChangeBlock,
        addCompactionBlock,
        addInterruptBlock,
        setAssistantStatusMessage,
        setAssistantStatus,
        setAssistantError,
        setAssistantAppliedFiles,
        startGeneratedFile,
        appendGeneratedFileChunk,
        completeGeneratedFile,
        markGeneratedFileError,
        replaceGeneratedOutput,
        resetGeneratedOutput,
        isAuthenticated,
        setShowAuthModal,
        setShowOutOfCreditsModal,
    } = useAppStore()
    const isGenerating = useAppStore((state) => state.isGenerating)

    // a new message while December works (#637): the messages this tab sent that no run
    // has taken yet, and how the last run ended
    const sentMessagesRef = React.useRef<Map<string, SentMessage>>(new Map())
    const runStoppedRef = React.useRef(false)
    const queueSendTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const clearQueueSendTimer = React.useCallback(() => {
        if (queueSendTimerRef.current !== null) clearTimeout(queueSendTimerRef.current)
        queueSendTimerRef.current = null
    }, [])

    /**
     * The running agent now reads messages that were sent while it worked. They close the
     * answer so far, and what the agent does next shows in a new answer below them. A
     * message that still waits stays last.
     */
    const handleSteeringDelivered = React.useCallback(
        (delivered: DeliveredSteering) => {
            const list = (delivered ?? []).filter((message) => message?.prompt)
            if (list.length === 0) return

            const previousId = activeAssistantMessageIdRef.current
            if (previousId) setAssistantStatus(previousId, 'done')
            const assistantMessageId = `${Date.now()}-steered-assistant`
            const deliveredIds = new Set(list.map((message) => message.clientMessageId))
            for (const id of deliveredIds) {
                if (id) sentMessagesRef.current.delete(id)
            }
            const waitingIds = new Set(
                [...sentMessagesRef.current.entries()]
                    .filter(([, sent]) => sent.steering)
                    .map(([id]) => id)
            )

            setMessages((prev) => {
                const known = new Map(prev.map((message) => [message.id, message]))
                // a message from another tab or device is not in this chat yet
                const read: Message[] = list.map((message, index) => {
                    const mine = message.clientMessageId
                        ? known.get(message.clientMessageId)
                        : undefined
                    return (
                        mine ?? {
                            id: message.clientMessageId ?? `${assistantMessageId}-user-${index}`,
                            role: 'user',
                            content: message.prompt ?? '',
                        }
                    )
                })
                const readIds = new Set(read.map((message) => message.id))
                return [
                    ...prev.filter((m) => !readIds.has(m.id) && !waitingIds.has(m.id)),
                    ...read,
                    {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: '',
                        type: 'text',
                        status: 'thinking',
                    },
                    ...prev.filter((m) => waitingIds.has(m.id)),
                ]
            })
            activeAssistantMessageIdRef.current = assistantMessageId
            setGenerationPhase('thinking')
        },
        [activeAssistantMessageIdRef, setAssistantStatus, setGenerationPhase, setMessages]
    )

    const requireAuthOr = React.useCallback(
        (action: () => void) => {
            if (!isAuthenticated) {
                setShowAuthModal(true)
                return
            }
            action()
        },
        [isAuthenticated, setShowAuthModal]
    )

    const resetGenerationRefs = React.useCallback(() => {
        activeAssistantMessageIdRef.current = null
        setGenerationPhase(null)
        setActiveOperation(null)
        setCurrentGenerationFilePaths([])
    }, [
        activeAssistantMessageIdRef,
        setGenerationPhase,
        setActiveOperation,
        setCurrentGenerationFilePaths,
    ])

    const abortGenerationRequest = React.useCallback(() => {
        generationAbortControllerRef.current?.abort()
        generationAbortControllerRef.current = null
    }, [generationAbortControllerRef])

    const hydrateAppliedProjectChange = React.useCallback(
        (result: AppliedProjectChangeResult) => {
            const preferredPath = result.appliedFiles[result.appliedFiles.length - 1] ?? null

            setActiveProjectId(result.project.id)
            setActiveProjectName(result.project.name)
            setProjectVersions(result.versions)
            setActiveProjectVersionId(result.version.id)
            setProjectLoadError(null)

            const uiMessages = result.chatMessages.map(mapBackendMessageToUIMessage)
            const activeVersionSummary = result.versions.find(
                (v) => v.id === result.version.id
            )?.summary
            if (activeVersionSummary) {
                const lastAssistantIdx = [...uiMessages]
                    .reverse()
                    .findIndex((m) => m.role === 'assistant')
                if (lastAssistantIdx !== -1) {
                    const idx = uiMessages.length - 1 - lastAssistantIdx
                    uiMessages[idx].summary = activeVersionSummary
                }
            }
            setMessages(uiMessages)

            replaceGeneratedOutput(result.generatedFiles, preferredPath)
            setGenerationPhase('done')
        },
        [
            replaceGeneratedOutput,
            setActiveProjectId,
            setActiveProjectName,
            setProjectVersions,
            setActiveProjectVersionId,
            setProjectLoadError,
            setMessages,
            setGenerationPhase,
        ]
    )

    /**
     * The parts of a run stream that the stream of a first prompt and the stream of a
     * later prompt share: the messages the agent now reads, and the mark of a stopped run
     * (queued messages then wait for the user, #637). True when nothing more is to do.
     */
    const handleSharedRunEvent = React.useCallback(
        (event: GenerationStreamEvent, flushNow: () => void): boolean => {
            if (event.type === 'SteeringDelivered') {
                flushNow()
                handleSteeringDelivered(event.data?.messages)
                return true
            }
            if (
                event.type === 'AgentInterrupt' ||
                (event.type === 'AgentEnd' && event.data?.stopped === true)
            ) {
                runStoppedRef.current = true
            }
            return false
        },
        [handleSteeringDelivered]
    )

    const startGeneration = React.useCallback(
        (
            prompt: string,
            assistantMessageId: string,
            projectId?: string | null,
            options?: PromptInputSubmitOptions
        ) => {
            abortGenerationRequest()
            resetGeneratedOutput()
            runStoppedRef.current = false
            activeAssistantMessageIdRef.current = assistantMessageId
            setGenerationPhase('thinking')
            setActiveOperation('build')
            setCurrentGenerationFilePaths([])
            setIsGenerating(true)
            setProjectType('generated')
            setProjectLoadError(null)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                let pendingThinking = ''
                let pendingStream = ''
                let pendingToolOutputs: Record<string, string> = {}
                let streamFrameHandle: number | null = null

                const flushStreamBuffers = () => {
                    const activeMsgId = activeAssistantMessageIdRef.current
                    if (!activeMsgId) return

                    if (pendingThinking) {
                        const chunk = pendingThinking
                        pendingThinking = ''
                        appendThinkingChunk(activeMsgId, chunk)
                    }

                    if (pendingStream) {
                        const chunk = pendingStream
                        pendingStream = ''
                        appendStreamChunk(activeMsgId, chunk)
                    }

                    const toolKeys = Object.keys(pendingToolOutputs)
                    if (toolKeys.length > 0) {
                        const snapshot = { ...pendingToolOutputs }
                        pendingToolOutputs = {}
                        for (const toolId of toolKeys) {
                            if (snapshot[toolId]) {
                                appendToolCallOutput(activeMsgId, toolId, snapshot[toolId])
                            }
                        }
                    }
                }

                const scheduleStreamFlush = () => {
                    if (streamFrameHandle !== null) return
                    streamFrameHandle = requestAnimationFrame(() => {
                        streamFrameHandle = null
                        flushStreamBuffers()
                    })
                }

                try {
                    await generationAPI.generateProjectStream({
                        prompt,
                        projectId,
                        repoUrl: options?.repoUrl,
                        branch: options?.branch,
                        gitRef: options?.gitRef,
                        issueNumber: options?.issueNumber,
                        model: options?.model,
                        provider: options?.provider,
                        billingSource: options?.billingSource,
                        runConfig: options?.runConfig,
                        attachments: options?.attachments,
                        session: options?.session,
                        signal: abortController.signal,
                        onEvent: (event) => {
                            const activeMessageId = activeAssistantMessageIdRef.current

                            if (!activeMessageId) {
                                return
                            }

                            const flushNow = () => {
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                            }
                            if (handleSharedRunEvent(event, flushNow)) return

                            switch (event.type) {
                                case 'connected':
                                    return
                                case 'project-created':
                                    setActiveProjectId(event.data.project.id)
                                    setActiveProjectName(event.data.project.name)
                                    setActiveProjectVersionId(event.data.version.id)
                                    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                                    return
                                case 'AgentStart':
                                case 'TurnStart':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    setGenerationPhase('thinking')
                                    setAssistantStatus(activeMessageId, 'thinking')
                                    return
                                case 'AgentStatus':
                                    if (event.data?.message) {
                                        setAssistantStatusMessage(
                                            activeMessageId,
                                            event.data.message
                                        )
                                    }
                                    return
                                case 'ThinkingChunk':
                                    if (event.data?.content) {
                                        setGenerationPhase('thinking')
                                        pendingThinking += event.data.content
                                        scheduleStreamFlush()
                                    }
                                    return
                                case 'StreamChunk':
                                    if (event.data?.content) {
                                        setGenerationPhase('building')
                                        setAssistantStatus(activeMessageId, 'building')
                                        pendingStream += event.data.content
                                        scheduleStreamFlush()
                                    }
                                    return
                                case 'ToolCallStart':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    setGenerationPhase('building')
                                    setAssistantStatus(activeMessageId, 'building')
                                    if (event.data?.toolCall) {
                                        addToolCallBlock(activeMessageId, {
                                            toolCallId:
                                                event.data.toolCall.id || `tool-${Date.now()}`,
                                            toolName: event.data.toolCall.name || 'tool',
                                            toolInput:
                                                event.data.toolCall.input ||
                                                event.data.toolCall.args ||
                                                {},
                                            status: 'running',
                                            output: '',
                                        })
                                    }
                                    return
                                case 'ToolExecutionUpdate':
                                    if (event.data?.toolCallId && event.data?.chunk) {
                                        pendingToolOutputs[event.data.toolCallId] =
                                            (pendingToolOutputs[event.data.toolCallId] || '') +
                                            event.data.chunk
                                        scheduleStreamFlush()
                                    }
                                    return
                                case 'ToolCallResult':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    if (
                                        event.data?.result !== undefined ||
                                        event.data?.toolCallId
                                    ) {
                                        updateToolCallResult(activeMessageId, {
                                            toolCallId:
                                                event.data.toolCallId ||
                                                event.data.result?.toolCallId,
                                            status:
                                                event.data.error || event.data.result?.error
                                                    ? 'error'
                                                    : 'success',
                                            output:
                                                event.data.output ||
                                                event.data.result?.output ||
                                                event.data.result?.content ||
                                                (typeof event.data.result === 'string'
                                                    ? event.data.result
                                                    : ''),
                                            error: event.data.error || event.data.result?.error,
                                        })
                                    }
                                    return
                                case 'FileModified':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    if (event.data?.path) {
                                        addFileChangeBlock(activeMessageId, {
                                            filePath: event.data.path,
                                            action: event.data.action || 'modified',
                                            diff: event.data.diff,
                                        })
                                        const curPaths =
                                            useAppStore.getState().currentGenerationFilePaths
                                        if (
                                            curPaths.length > 0 &&
                                            !curPaths.includes(event.data.path)
                                        ) {
                                            setCurrentGenerationFilePaths([
                                                ...curPaths,
                                                event.data.path,
                                            ])
                                        }
                                    }
                                    return
                                case 'ContextCompacted':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    if (event.data?.summary) {
                                        addCompactionBlock(activeMessageId, event.data.summary)
                                    }
                                    return
                                case 'AgentInterrupt':
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    addInterruptBlock(activeMessageId)
                                    setIsGenerating(false)
                                    return
                                case 'TurnEnd':
                                case 'AgentEnd': {
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    setGenerationPhase('done')
                                    setAssistantStatus(activeMessageId, 'done')
                                    // a turn is one step of the run: December works until
                                    // the run ends, so a new message is queued or sent (#637)
                                    if (event.type === 'TurnEnd') return
                                    setIsGenerating(false)
                                    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                                    const currentPid = useAppStore.getState().activeProjectId
                                    if (currentPid) {
                                        void queryClient.invalidateQueries({
                                            queryKey: ['session', currentPid],
                                        })
                                    }
                                    return
                                }
                                case 'AgentError': {
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    setGenerationPhase(null)
                                    const errText =
                                        event.data?.error ||
                                        event.data?.message ||
                                        'Agent Execution Error'
                                    const lowerErr = String(errText).toLowerCase()
                                    const isOwnKeyError = String(event.data?.code || '').startsWith(
                                        'BYOK_'
                                    )
                                    if (isOwnKeyError) {
                                        setAssistantError(activeMessageId, errText, {
                                            ownKey: true,
                                        })
                                        setIsGenerating(false)
                                        return
                                    }
                                    if (
                                        lowerErr.includes('insufficient') ||
                                        lowerErr.includes('credit') ||
                                        lowerErr.includes('balance') ||
                                        lowerErr.includes('wallet')
                                    ) {
                                        void queryClient.invalidateQueries({
                                            queryKey: billingQueryKeys.overview,
                                        })
                                        setShowOutOfCreditsModal(true)
                                    }
                                    setAssistantError(activeMessageId, errText)
                                    setIsGenerating(false)
                                    return
                                }
                                case 'phase':
                                    if (event.data.phase === 'building') {
                                        setGenerationPhase('building')
                                        setAssistantStatus(activeMessageId, 'building')
                                    }
                                    return
                                case 'message-start':
                                    if (event.data.status === 'thinking') {
                                        setGenerationPhase('thinking')
                                        setAssistantStatus(activeMessageId, 'thinking')
                                    }
                                    return
                                case 'message-chunk':
                                    appendAssistantChunk(
                                        activeMessageId,
                                        event.data.chunk,
                                        event.data.messageId
                                    )
                                    return
                                case 'message-complete':
                                case 'build-plan':
                                case 'patch-plan':
                                    return
                                case 'file-start':
                                    setCurrentGenerationFilePaths(
                                        useAppStore
                                            .getState()
                                            .currentGenerationFilePaths.includes(event.data.path)
                                            ? useAppStore.getState().currentGenerationFilePaths
                                            : [
                                                  ...useAppStore.getState()
                                                      .currentGenerationFilePaths,
                                                  event.data.path,
                                              ]
                                    )
                                    startGeneratedFile(event.data)
                                    return
                                case 'file-chunk':
                                    appendGeneratedFileChunk(event.data.path, event.data.chunk)
                                    return
                                case 'file-complete':
                                    completeGeneratedFile(event.data.path)
                                    return
                                case 'file-error':
                                    markGeneratedFileError(event.data.path)
                                    return
                                case 'result': {
                                    if (streamFrameHandle !== null) {
                                        cancelAnimationFrame(streamFrameHandle)
                                        streamFrameHandle = null
                                    }
                                    flushStreamBuffers()
                                    setGenerationPhase('done')
                                    setAssistantStatus(activeMessageId, 'done')
                                    setIsGenerating(false)
                                    if (event.data?.generatedFiles) {
                                        replaceGeneratedOutput(event.data.generatedFiles)
                                    }
                                    if (event.data?.project?.id) {
                                        setActiveProjectId(event.data.project.id)
                                        if (event.data.project.name) {
                                            setActiveProjectName(event.data.project.name)
                                        }
                                    }
                                    if (event.data?.version?.id) {
                                        setActiveProjectVersionId(event.data.version.id)
                                    }
                                    if (event.data?.versions) {
                                        setProjectVersions(event.data.versions)
                                    }
                                    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                                    const currentPid =
                                        event.data?.project?.id ||
                                        useAppStore.getState().activeProjectId
                                    if (currentPid) {
                                        void queryClient.invalidateQueries({
                                            queryKey: ['session', currentPid],
                                        })
                                    }
                                    return
                                }
                                case 'error': {
                                    const activeFile =
                                        useAppStore.getState().activeGeneratedFilePath
                                    if (activeFile) {
                                        markGeneratedFileError(activeFile)
                                    }
                                    return
                                }
                            }
                        },
                    })
                } catch (error) {
                    if (abortController.signal.aborted) {
                        return
                    }
                    // already shown by the stream handler, with "switch to december credits"
                    if (isOwnKeyError(error)) {
                        return
                    }

                    const activeMessageId = activeAssistantMessageIdRef.current
                    const message =
                        error instanceof Error ? error.message : 'Generation failed unexpectedly.'
                    const lowerMsg = String(message).toLowerCase()
                    if (
                        lowerMsg.includes('insufficient') ||
                        lowerMsg.includes('credit') ||
                        lowerMsg.includes('balance') ||
                        lowerMsg.includes('wallet')
                    ) {
                        void queryClient.invalidateQueries({
                            queryKey: billingQueryKeys.overview,
                        })
                        setShowOutOfCreditsModal(true)
                    }

                    const activeFile = useAppStore.getState().activeGeneratedFilePath
                    if (activeFile) {
                        markGeneratedFileError(activeFile)
                    }

                    if (activeMessageId) {
                        setAssistantError(activeMessageId, message)
                    }
                } finally {
                    if (generationAbortControllerRef.current === abortController) {
                        generationAbortControllerRef.current = null
                        resetGenerationRefs()
                        setIsGenerating(false)
                    }
                }
            })()
        },
        [
            abortGenerationRequest,
            activeAssistantMessageIdRef,
            appendAssistantChunk,
            appendThinkingChunk,
            appendStreamChunk,
            addCompactionBlock,
            addFileChangeBlock,
            addInterruptBlock,
            addToolCallBlock,
            appendToolCallOutput,
            updateToolCallResult,
            setAssistantStatusMessage,
            appendGeneratedFileChunk,
            completeGeneratedFile,
            generationAbortControllerRef,
            handleSharedRunEvent,
            markGeneratedFileError,
            queryClient,
            replaceGeneratedOutput,
            resetGeneratedOutput,
            resetGenerationRefs,
            setActiveOperation,
            setActiveProjectId,
            setActiveProjectName,
            setActiveProjectVersionId,
            setAssistantError,
            setAssistantStatus,
            setCurrentGenerationFilePaths,
            setGenerationPhase,
            setIsGenerating,
            setProjectLoadError,
            setProjectVersions,
            setProjectType,
            startGeneratedFile,
            setShowOutOfCreditsModal,
        ]
    )

    const handlePromptSubmit = React.useCallback(
        (prompt: string, options?: PromptInputSubmitOptions) => {
            requireAuthOr(async () => {
                const normalizedPrompt = prompt.trim()
                if (!normalizedPrompt) {
                    return
                }

                // Check credits before creating session or navigating to workspace
                let overview = queryClient.getQueryData<BillingOverview>(billingQueryKeys.overview)
                if (overview === undefined && isAuthenticated) {
                    try {
                        overview = await billingAPI.getOverview()
                        queryClient.setQueryData(billingQueryKeys.overview, overview)
                    } catch {
                        // Intentionally swallowed: ignore billing check network error and proceed
                    }
                }

                // own-key runs are paid by the user's provider, so an empty wallet is fine
                if (
                    options?.billingSource !== 'OWN_KEY' &&
                    overview !== undefined &&
                    (overview.creditBalance ?? 0) <= 0
                ) {
                    setShowOutOfCreditsModal(true)
                    return
                }

                outputOriginViewRef.current = view
                setProjectLoadError(null)

                const baseId = Date.now().toString()
                const assistantMessageId = `${baseId}-assistant`
                const userMsg: Message = {
                    id: baseId,
                    role: 'user',
                    content: normalizedPrompt,
                    ...(options?.attachments?.length
                        ? { attachments: options.attachments.map(({ name }) => ({ name })) }
                        : {}),
                }
                const assistantMsg: Message = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: '',
                    type: 'text',
                    status: 'thinking',
                }

                setMessages([userMsg, assistantMsg])
                startGeneration(normalizedPrompt, assistantMessageId, activeProjectId, options)
            })
        },
        [
            activeProjectId,
            startGeneration,
            view,
            requireAuthOr,
            outputOriginViewRef,
            setProjectLoadError,
            setMessages,
            queryClient,
            isAuthenticated,
            setShowOutOfCreditsModal,
        ]
    )

    const applyProjectChange = React.useCallback(
        ({
            kind,
            prompt,
            errorMessage,
            stack,
            visibleUserMessage,
            model,
            provider,
            billingSource,
            runConfig,
            attachments,
        }: {
            // `follow` shows a run that the server started (#637): no prompt goes out
            kind: 'edit' | 'fix' | 'follow'
            prompt?: string
            errorMessage?: string
            stack?: string | null
            visibleUserMessage: string
            model?: string
            provider?: string
            // the payment source the prompt box shows (December credits or the user's own key)
            billingSource?: PromptInputSubmitOptions['billingSource']
            runConfig?: PromptInputSubmitOptions['runConfig']
            /** the stored files sent with this prompt (#634) */
            attachments?: PromptInputSubmitOptions['attachments']
        }) => {
            if (!activeProjectId) {
                return
            }

            abortGenerationRequest()
            setProjectLoadError(null)
            runStoppedRef.current = false

            const baseId = Date.now().toString()
            const assistantMessageId = `${baseId}-assistant`
            if (kind === 'edit' && prompt) {
                // the server can give the prompt back when a run still works (#637)
                sentMessagesRef.current.set(baseId, {
                    sessionId: activeProjectId,
                    text: prompt,
                    options: { model, provider, billingSource, runConfig, attachments },
                    steering: false,
                    emitted: true,
                })
            }
            const userMsg: Message = {
                id: baseId,
                role: 'user',
                content: visibleUserMessage,
                ...(attachments?.length
                    ? { attachments: attachments.map(({ name }) => ({ name })) }
                    : {}),
            }
            const assistantMsg: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                type: 'text',
                status: 'thinking',
            }

            // an answer that still waits for a run of another tab, with no content, is dropped
            const staleAssistantId = activeAssistantMessageIdRef.current
            setMessages((prev) => {
                const kept = prev.filter(
                    (message) =>
                        message.id !== staleAssistantId ||
                        message.status !== 'thinking' ||
                        Boolean(message.content) ||
                        Boolean(message.blocks?.length)
                )
                return kind === 'follow'
                    ? [...kept, assistantMsg]
                    : [...kept, userMsg, assistantMsg]
            })
            activeAssistantMessageIdRef.current = assistantMessageId
            setGenerationPhase('thinking')
            setActiveOperation(kind === 'follow' ? 'edit' : kind)
            setCurrentGenerationFilePaths([])
            setIsGenerating(true)
            setProjectType('generated')
            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                let pendingThinking = ''
                let pendingStream = ''
                let pendingToolOutputs: Record<string, string> = {}
                let streamFrameHandle: number | null = null

                const flushStreamBuffers = () => {
                    const activeMsgId = activeAssistantMessageIdRef.current
                    if (!activeMsgId) return

                    if (pendingThinking) {
                        const chunk = pendingThinking
                        pendingThinking = ''
                        appendThinkingChunk(activeMsgId, chunk)
                    }

                    if (pendingStream) {
                        const chunk = pendingStream
                        pendingStream = ''
                        appendStreamChunk(activeMsgId, chunk)
                    }

                    const toolKeys = Object.keys(pendingToolOutputs)
                    if (toolKeys.length > 0) {
                        const snapshot = { ...pendingToolOutputs }
                        pendingToolOutputs = {}
                        for (const toolId of toolKeys) {
                            if (snapshot[toolId]) {
                                appendToolCallOutput(activeMsgId, toolId, snapshot[toolId])
                            }
                        }
                    }
                }

                const scheduleStreamFlush = () => {
                    if (streamFrameHandle !== null) return
                    streamFrameHandle = requestAnimationFrame(() => {
                        streamFrameHandle = null
                        flushStreamBuffers()
                    })
                }

                try {
                    let didHydrateStreamResult = false
                    const handleStreamEvent = (event: GenerationStreamEvent) => {
                        const activeMessageId = activeAssistantMessageIdRef.current

                        if (!activeMessageId) {
                            return
                        }

                        const flushNow = () => {
                            if (streamFrameHandle !== null) {
                                cancelAnimationFrame(streamFrameHandle)
                                streamFrameHandle = null
                            }
                            flushStreamBuffers()
                        }
                        if (handleSharedRunEvent(event, flushNow)) return

                        switch (event.type) {
                            case 'connected':
                                return
                            case 'AgentStart':
                            case 'TurnStart':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                setGenerationPhase('thinking')
                                setAssistantStatus(activeMessageId, 'thinking')
                                return
                            case 'AgentStatus':
                                if (event.data?.message) {
                                    setAssistantStatusMessage(activeMessageId, event.data.message)
                                }
                                return
                            case 'ThinkingChunk':
                                if (event.data?.content) {
                                    setGenerationPhase('thinking')
                                    pendingThinking += event.data.content
                                    scheduleStreamFlush()
                                }
                                return
                            case 'StreamChunk':
                                if (event.data?.content) {
                                    setGenerationPhase('building')
                                    setAssistantStatus(activeMessageId, 'building')
                                    pendingStream += event.data.content
                                    scheduleStreamFlush()
                                }
                                return
                            case 'ToolCallStart':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                setGenerationPhase('building')
                                setAssistantStatus(activeMessageId, 'building')
                                if (event.data?.toolCall) {
                                    addToolCallBlock(activeMessageId, {
                                        toolCallId: event.data.toolCall.id || `tool-${Date.now()}`,
                                        toolName: event.data.toolCall.name || 'tool',
                                        toolInput:
                                            event.data.toolCall.input ||
                                            event.data.toolCall.args ||
                                            {},
                                        status: 'running',
                                        output: '',
                                    })
                                }
                                return
                            case 'ToolExecutionUpdate':
                                if (event.data?.toolCallId && event.data?.chunk) {
                                    pendingToolOutputs[event.data.toolCallId] =
                                        (pendingToolOutputs[event.data.toolCallId] || '') +
                                        event.data.chunk
                                    scheduleStreamFlush()
                                }
                                return
                            case 'ToolCallResult':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                if (event.data?.result !== undefined || event.data?.toolCallId) {
                                    updateToolCallResult(activeMessageId, {
                                        toolCallId:
                                            event.data.toolCallId || event.data.result?.toolCallId,
                                        status:
                                            event.data.error || event.data.result?.error
                                                ? 'error'
                                                : 'success',
                                        output:
                                            event.data.output ||
                                            event.data.result?.output ||
                                            event.data.result?.content ||
                                            (typeof event.data.result === 'string'
                                                ? event.data.result
                                                : ''),
                                        error: event.data.error || event.data.result?.error,
                                    })
                                }
                                return
                            case 'FileModified':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                if (event.data?.path) {
                                    addFileChangeBlock(activeMessageId, {
                                        filePath: event.data.path,
                                        action: event.data.action || 'modified',
                                        diff: event.data.diff,
                                    })
                                    const curPaths =
                                        useAppStore.getState().currentGenerationFilePaths
                                    if (
                                        curPaths.length > 0 &&
                                        !curPaths.includes(event.data.path)
                                    ) {
                                        setCurrentGenerationFilePaths([
                                            ...curPaths,
                                            event.data.path,
                                        ])
                                    }
                                }
                                return
                            case 'ContextCompacted':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                if (event.data?.summary) {
                                    addCompactionBlock(activeMessageId, event.data.summary)
                                }
                                return
                            case 'AgentInterrupt':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                addInterruptBlock(activeMessageId)
                                setIsGenerating(false)
                                return
                            case 'TurnEnd':
                            case 'AgentEnd': {
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                setGenerationPhase('done')
                                setAssistantStatus(activeMessageId, 'done')
                                // a turn is one step of the run: December works until the
                                // run ends, so a new message is queued or sent (#637)
                                if (event.type === 'TurnEnd') return
                                setIsGenerating(false)
                                void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                                const currentPid = useAppStore.getState().activeProjectId
                                if (currentPid) {
                                    void queryClient.invalidateQueries({
                                        queryKey: ['session', currentPid],
                                    })
                                }
                                return
                            }
                            case 'AgentError':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                setGenerationPhase(null)
                                setAssistantError(
                                    activeMessageId,
                                    event.data?.error ||
                                        event.data?.message ||
                                        'Agent Execution Error',
                                    String(event.data?.code || '').startsWith('BYOK_')
                                        ? { ownKey: true }
                                        : undefined
                                )
                                setIsGenerating(false)
                                return
                            case 'phase':
                                if (event.data.phase === 'thinking') {
                                    setGenerationPhase('thinking')
                                    setAssistantStatus(activeMessageId, 'thinking')
                                }

                                if (event.data.phase === 'building') {
                                    setGenerationPhase('building')
                                    setAssistantStatus(activeMessageId, 'building')
                                }
                                return
                            case 'message-start':
                                if (event.data.status === 'thinking') {
                                    setGenerationPhase('thinking')
                                    setAssistantStatus(activeMessageId, 'thinking')
                                }
                                return
                            case 'message-chunk':
                                appendAssistantChunk(
                                    activeMessageId,
                                    event.data.chunk,
                                    event.data.messageId
                                )
                                return
                            case 'message-complete':
                                return
                            case 'patch-plan':
                            case 'build-plan':
                                setAssistantAppliedFiles(
                                    activeMessageId,
                                    event.data.files.map((f) => f.path)
                                )
                                return
                            case 'file-start':
                                setCurrentGenerationFilePaths(
                                    useAppStore
                                        .getState()
                                        .currentGenerationFilePaths.includes(event.data.path)
                                        ? useAppStore.getState().currentGenerationFilePaths
                                        : [
                                              ...useAppStore.getState().currentGenerationFilePaths,
                                              event.data.path,
                                          ]
                                )
                                startGeneratedFile(event.data)
                                return
                            case 'file-chunk':
                                appendGeneratedFileChunk(event.data.path, event.data.chunk)
                                return
                            case 'file-complete':
                                completeGeneratedFile(event.data.path)
                                return
                            case 'file-error':
                                markGeneratedFileError(event.data.path)
                                return
                            case 'result':
                                if (streamFrameHandle !== null) {
                                    cancelAnimationFrame(streamFrameHandle)
                                    streamFrameHandle = null
                                }
                                flushStreamBuffers()
                                if (
                                    event.data.versions &&
                                    event.data.chatMessages &&
                                    event.data.appliedFiles &&
                                    event.data.deletedFiles &&
                                    event.data.assistantMessage
                                ) {
                                    didHydrateStreamResult = true
                                    hydrateAppliedProjectChange({
                                        project: event.data.project,
                                        version: event.data.version,
                                        versions: event.data.versions,
                                        chatMessages: event.data.chatMessages,
                                        generatedFiles: event.data.generatedFiles,
                                        appliedFiles: event.data.appliedFiles,
                                        deletedFiles: event.data.deletedFiles,
                                        assistantMessage: event.data.assistantMessage,
                                    })
                                    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                                }
                                return
                            case 'project-created':
                            case 'error':
                                return
                        }
                    }

                    const result =
                        kind === 'follow'
                            ? await generationAPI.listenToSessionStream(
                                  activeProjectId,
                                  handleStreamEvent,
                                  abortController.signal
                              )
                            : kind === 'edit'
                              ? await generationAPI.applyProjectEdit({
                                    projectId: activeProjectId,
                                    versionId: activeProjectVersionId,
                                    prompt: prompt ?? '',
                                    model,
                                    provider,
                                    billingSource,
                                    runConfig,
                                    attachments,
                                    clientMessageId: baseId,
                                    signal: abortController.signal,
                                    onEvent: handleStreamEvent,
                                })
                              : await generationAPI.applyProjectFix({
                                    projectId: activeProjectId,
                                    versionId: activeProjectVersionId,
                                    errorMessage: errorMessage ?? '',
                                    ...(stack ? { stack } : {}),
                                    signal: abortController.signal,
                                    onEvent: handleStreamEvent,
                                })

                    if (abortController.signal.aborted) {
                        return
                    }

                    // an agent run ends with AgentEnd, which carries no project to load
                    if (result && !didHydrateStreamResult && Array.isArray(result.appliedFiles)) {
                        hydrateAppliedProjectChange(result)
                        void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                    }
                } catch (error) {
                    if (abortController.signal.aborted) {
                        return
                    }
                    // already shown by the stream handler, with "switch to december credits"
                    if (isOwnKeyError(error)) {
                        return
                    }

                    const message =
                        error instanceof Error ? error.message : 'Failed to update project'
                    setProjectLoadError(message)
                    // steering can open a new answer in the middle of the run (#637)
                    setAssistantError(
                        activeAssistantMessageIdRef.current ?? assistantMessageId,
                        message
                    )
                } finally {
                    if (streamFrameHandle !== null) {
                        cancelAnimationFrame(streamFrameHandle)
                        streamFrameHandle = null
                    }
                    flushStreamBuffers()
                    if (!abortController.signal.aborted) {
                        setIsGenerating(false)
                        setGenerationPhase(null)
                        setActiveOperation(null)
                        setCurrentGenerationFilePaths([])
                        activeAssistantMessageIdRef.current = null
                    }
                }
            })()
        },
        [
            abortGenerationRequest,
            activeAssistantMessageIdRef,
            activeProjectId,
            activeProjectVersionId,
            generationAbortControllerRef,
            handleSharedRunEvent,
            hydrateAppliedProjectChange,
            queryClient,
            setAssistantAppliedFiles,
            setAssistantError,
            setAssistantStatus,
            setAssistantStatusMessage,
            setGenerationPhase,
            setActiveOperation,
            setIsGenerating,
            setMessages,
            setProjectLoadError,
            setProjectType,
            setCurrentGenerationFilePaths,
            appendAssistantChunk,
            appendThinkingChunk,
            appendStreamChunk,
            addToolCallBlock,
            appendToolCallOutput,
            updateToolCallResult,
            addFileChangeBlock,
            addCompactionBlock,
            addInterruptBlock,
            startGeneratedFile,
            appendGeneratedFileChunk,
            completeGeneratedFile,
            markGeneratedFileError,
        ]
    )

    /** sends a queued message as the prompt of a new run: the next one, or the one named */
    const sendQueuedMessage = React.useCallback(
        (id?: string) => {
            clearQueueSendTimer()
            if (!activeProjectId) return
            const next = useMessageQueue.getState().take(activeProjectId, id)
            if (!next) return
            applyProjectChange({
                kind: 'edit',
                prompt: next.text,
                visibleUserMessage: next.text,
                model: next.options?.model,
                provider: next.options?.provider,
                billingSource: next.options?.billingSource,
                runConfig: next.options?.runConfig,
                attachments: next.options?.attachments,
            })
        },
        [activeProjectId, applyProjectChange, clearQueueSendTimer]
    )

    /**
     * "Send now": the message shows in the chat at once and goes to the running agent, which
     * reads it at its next turn. When the run ends before that, the server starts a run for
     * the message, and the session follows it.
     */
    const sendToRunningAgent = React.useCallback(
        (text: string, options?: PromptInputSubmitOptions) => {
            if (!activeProjectId) return
            const sessionId = activeProjectId
            const id = Date.now().toString()
            const sent: SentMessage = { sessionId, text, options, steering: true, emitted: false }
            sentMessagesRef.current.set(id, sent)
            setMessages((prev) => [
                ...prev,
                {
                    id,
                    role: 'user',
                    content: text,
                    ...(options?.attachments?.length
                        ? { attachments: options.attachments.map(({ name }) => ({ name })) }
                        : {}),
                },
            ])
            generationAPI
                .sendMessageToRun({
                    sessionId,
                    prompt: text,
                    clientMessageId: id,
                    model: options?.model,
                    provider: options?.provider,
                    billingSource: options?.billingSource,
                    runConfig: options?.runConfig,
                    attachments: options?.attachments,
                })
                .then(() => {
                    sent.emitted = true
                    const state = useAppStore.getState()
                    // the run ended while the files went up: the server starts a run for
                    // the message
                    if (
                        sentMessagesRef.current.has(id) &&
                        !state.isGenerating &&
                        state.activeProjectId === sessionId
                    ) {
                        sentMessagesRef.current.delete(id)
                        applyProjectChange({ kind: 'follow', visibleUserMessage: '' })
                    }
                })
                .catch((error: unknown) => {
                    // the message did not go out (a file upload failed): it waits in the queue
                    console.error('[chat] could not send the message to the running agent', error)
                    if (!sentMessagesRef.current.delete(id)) return
                    setMessages((prev) => prev.filter((message) => message.id !== id))
                    useMessageQueue.getState().putBack({ id, sessionId, text, options })
                })
        },
        [activeProjectId, applyProjectChange, setMessages]
    )

    // the server gave a prompt back, because a run works in the session and new messages
    // are queued there (another tab started it, or the account says "queue"). the message
    // leaves the chat and waits in the queue
    React.useEffect(
        () =>
            generationAPI.onPromptQueued((event) => {
                const id = event.clientMessageId
                const sent = id ? sentMessagesRef.current.get(id) : undefined
                if (!id || !sent) return
                sentMessagesRef.current.delete(id)
                setMessages((prev) => prev.filter((message) => message.id !== id))
                useMessageQueue.getState().putBack({
                    id,
                    sessionId: sent.sessionId,
                    text: sent.text,
                    options: sent.options,
                })
            }),
        [setMessages]
    )

    // a run the server started for the open session (#638, "Continue" at a spend limit):
    // the chat shows it live, the way it shows a run for a message the agent did not read
    React.useEffect(() => {
        const onFollowRun = (event: Event) => {
            const sessionId = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId
            if (!sessionId || sessionId !== useAppStore.getState().activeProjectId) return
            // tells the sender that this chat follows the run
            event.preventDefault()
            applyProjectChange({ kind: 'follow', visibleUserMessage: '' })
        }
        window.addEventListener(FOLLOW_RUN_EVENT, onFollowRun)
        return () => window.removeEventListener(FOLLOW_RUN_EVENT, onFollowRun)
    }, [applyProjectChange])

    // the "Send" of a queued message, for the list in the chat
    React.useEffect(() => {
        useMessageQueue.setState({ sendNow: (id) => sendQueuedMessage(id) })
        return () => useMessageQueue.setState({ sendNow: () => {} })
    }, [sendQueuedMessage])

    // the end of a run: the next queued message goes out when the worker says that the
    // session is free (its last work, the pull request step, is done). after a stop the
    // queue waits for the user
    const wasGeneratingRef = React.useRef(isGenerating)
    React.useEffect(() => {
        const runEnded = wasGeneratingRef.current && !isGenerating
        wasGeneratingRef.current = isGenerating
        if (!runEnded || !activeProjectId) return

        const sent = [...sentMessagesRef.current.entries()].filter(
            ([, message]) => message.sessionId === activeProjectId && message.emitted
        )
        // what the ended run took or left is settled now
        for (const [id] of sent) sentMessagesRef.current.delete(id)
        const step = decideRunEnd({
            stopped: runStoppedRef.current,
            unread: sent.filter(([, message]) => message.steering).length,
            queued: useMessageQueue
                .getState()
                .queued.filter((message) => message.sessionId === activeProjectId).length,
        })
        if (step === 'follow') applyProjectChange({ kind: 'follow', visibleUserMessage: '' })
        else if (step === 'send-next') {
            clearQueueSendTimer()
            queueSendTimerRef.current = setTimeout(() => sendQueuedMessage(), QUEUE_SEND_WAIT_MS)
        }
    }, [isGenerating, activeProjectId, applyProjectChange, clearQueueSendTimer, sendQueuedMessage])

    React.useEffect(
        () =>
            generationAPI.onRunClosed((event) => {
                if (event.sessionId !== activeProjectId) return
                clearQueueSendTimer()
                // a stopped run leaves the queue to the user. a run that follows (for a
                // message the agent did not read) closes later, and the queue goes then
                if (runStoppedRef.current || event.runFollows) return
                sendQueuedMessage()
            }),
        [activeProjectId, clearQueueSendTimer, sendQueuedMessage]
    )
    React.useEffect(() => clearQueueSendTimer, [clearQueueSendTimer])

    const handleOutputPromptSubmit = React.useCallback(
        (promptText: string, options?: PromptInputSubmitOptions) => {
            requireAuthOr(() => {
                const normalizedPrompt = promptText.trim()
                if (!normalizedPrompt) {
                    return
                }

                if (!activeProjectId) {
                    handlePromptSubmit(normalizedPrompt, options)
                    return
                }

                // a new message while December works (#637): by the account preference it
                // waits for the end of the run, or it goes to the running agent now
                const route = decideSubmit({
                    isWorking: useAppStore.getState().isGenerating,
                    mode: usePreferences.getState().messageWhileWorking,
                })
                if (route === 'queue') {
                    useMessageQueue
                        .getState()
                        .add({ sessionId: activeProjectId, text: normalizedPrompt, options })
                    return
                }
                if (route === 'steer') {
                    sendToRunningAgent(normalizedPrompt, options)
                    return
                }

                outputOriginViewRef.current = view
                applyProjectChange({
                    kind: 'edit',
                    prompt: normalizedPrompt,
                    visibleUserMessage: normalizedPrompt,
                    model: options?.model,
                    provider: options?.provider,
                    billingSource: options?.billingSource,
                    runConfig: options?.runConfig,
                    attachments: options?.attachments,
                })
            })
        },
        [
            activeProjectId,
            applyProjectChange,
            handlePromptSubmit,
            sendToRunningAgent,
            view,
            requireAuthOr,
            outputOriginViewRef,
        ]
    )

    const handlePreviewRuntimeError = React.useCallback(
        (runtimeError: PreviewRuntimeError) => {
            requireAuthOr(() => {
                const isGenerating = useAppStore.getState().isGenerating
                if (!activeProjectId || isGenerating) {
                    return
                }

                const message = runtimeError.message.trim()

                if (!message) {
                    return
                }

                const signature = `${activeProjectVersionId ?? 'current'}:${message}`

                if (lastAutoFixSignatureRef.current === signature) {
                    return
                }

                lastAutoFixSignatureRef.current = signature
                outputOriginViewRef.current = view
                applyProjectChange({
                    kind: 'fix',
                    errorMessage: message,
                    stack: runtimeError.stack,
                    visibleUserMessage: `Fix preview error: ${message}`,
                })
            })
        },
        [
            activeProjectId,
            activeProjectVersionId,
            applyProjectChange,
            view,
            requireAuthOr,
            outputOriginViewRef,
            lastAutoFixSignatureRef,
        ]
    )

    return {
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        applyProjectChange,
        startGeneration,
        resetGenerationRefs,
        abortGenerationRequest,
    }
}
