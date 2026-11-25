import { io } from 'socket.io-client'

import type { BillingSource, Speed } from '@/features/home/model-selection'
import type { PromptRunConfig, UploadedAttachment } from '@/features/home/types'
import type {
    BackendProject,
    BackendMessage,
    BackendProjectVersionSummary,
} from '@/features/sessions/api/session'

import { useAppStore } from '@/app/store'
import { getModelSelection } from '@/features/home/model-selection'
import { sessionAPI } from '@/features/sessions/api/session'
import { ApiError, refreshAuthSession } from '@/shared/api/client'
import { getWebSocketUrl } from '@/shared/config/env'

export type GenerationMessageStatus = 'thinking' | 'building' | 'done' | 'error'

export interface PlannedBuildFile {
    path: string
    purpose: string
    generate: boolean
    generator: string
}

export interface AppliedProjectChangeResult {
    project: BackendProject
    version: Pick<BackendProjectVersionSummary, 'id' | 'versionNumber' | 'label' | 'status'>
    versions: BackendProjectVersionSummary[]
    chatMessages: BackendMessage[]
    generatedFiles: Record<string, string>
    appliedFiles: string[]
    deletedFiles: string[]
    assistantMessage: string
}

export type GenerationStreamEvent =
    | {
          type: 'connected'
          data: {
              ok: boolean
          }
      }
    | {
          type: 'project-created'
          data: {
              project: BackendProject
              version: { id: string }
          }
      }
    | {
          type: 'AgentStart'
          data?: any
      }
    | {
          type: 'TurnStart'
          data?: any
      }
    | {
          type: 'AgentStatus'
          data: {
              message: string
          }
      }
    | {
          type: 'ThinkingChunk'
          data: {
              content: string
          }
      }
    | {
          type: 'StreamChunk'
          data: {
              content: string
          }
      }
    | {
          type: 'ToolCallStart'
          data: {
              toolCall: any
          }
      }
    | {
          type: 'ToolExecutionUpdate'
          data: {
              toolCallId: string
              chunk: string
          }
      }
    | {
          type: 'ToolCallResult'
          data: {
              result: any
              toolCallId?: string
              output?: string
              error?: string
          }
      }
    | {
          type: 'FileModified'
          data: {
              path: string
              diff?: string
              action?: 'created' | 'modified' | 'deleted'
          }
      }
    | {
          type: 'GitDiffUpdate'
          data: {
              gitDiff?: string
              gitStatus?: string
          }
      }
    | {
          type: 'PullRequestUpdate'
          data: {
              pullRequest?: any
          }
      }
    | {
          type: 'PlanMilestoneUpdate'
          data: {
              plan?: any
          }
      }
    | {
          type: 'TestExecutionUpdate'
          data: {
              report?: any
          }
      }
    | {
          type: 'PreviewPortDetected'
          data: {
              port?: number
              ports?: number[]
              previewUrl?: string
          }
      }
    | {
          type: 'BrowserViewportUpdate'
          data: import('@/features/preview/types').BrowserViewportData
      }
    | {
          type: 'DesktopViewportUpdate'
          data: import('@/features/preview/types').BrowserViewportData
      }
    | {
          type: 'AskQuestionPrompt'
          data: {
              questionId?: string
              sessionId?: string
              questions?: any[]
          }
      }
    | {
          type: 'ContextCompacted'
          data: {
              summary: string
          }
      }
    | {
          type: 'AgentInterrupt'
          data?: any
      }
    | {
          // the running agent now reads these messages, sent while it worked (#637)
          type: 'SteeringDelivered'
          data?: {
              messages?: Array<{ prompt?: string; sequence?: number; clientMessageId?: string }>
          }
      }
    | {
          type: 'TurnEnd'
          data?: any
      }
    | {
          type: 'AgentEnd'
          data?: any
      }
    | {
          type: 'AgentError'
          data: {
              error?: string
              message?: string
              /** BYOK_KEY_FAILED or BYOK_KEY_MISSING when the user's own key failed */
              code?: string
              provider?: string
              keyFailure?: string
          }
      }
    | {
          type: 'phase'
          data: {
              phase: 'thinking' | 'building'
          }
      }
    | {
          type: 'message-start'
          data: {
              messageId: string
              status: 'thinking'
          }
      }
    | {
          type: 'message-chunk'
          data: {
              messageId: string
              chunk: string
          }
      }
    | {
          type: 'message-complete'
          data: {
              messageId: string
              status: 'done'
          }
      }
    | {
          type: 'build-plan'
          data: {
              files: PlannedBuildFile[]
              totalFiles: number
          }
      }
    | {
          type: 'patch-plan'
          data: {
              files: Array<{
                  path: string
                  action: 'create' | 'update' | 'delete'
                  purpose: string
                  instructions: string
              }>
              totalFiles: number
          }
      }
    | {
          type: 'file-start'
          data: {
              path: string
              purpose: string
              generator: string
              index: number
              total: number
          }
      }
    | {
          type: 'file-chunk'
          data: {
              path: string
              chunk: string
          }
      }
    | {
          type: 'file-complete'
          data: {
              path: string
              index: number
              total: number
          }
      }
    | {
          type: 'file-error'
          data: {
              path: string
              message: string
          }
      }
    | {
          type: 'result'
          data: {
              project: BackendProject
              version: Pick<
                  BackendProjectVersionSummary,
                  'id' | 'versionNumber' | 'label' | 'status'
              >
              intent: unknown
              plan: unknown
              generatedFiles: Record<string, string>
              versions?: BackendProjectVersionSummary[]
              chatMessages?: BackendMessage[]
              appliedFiles?: string[]
              deletedFiles?: string[]
              assistantMessage?: string
          }
      }
    | {
          type: 'error'
          data: {
              message: string
          }
      }

export function normalizeAgentStreamEvent(raw: any): GenerationStreamEvent {
    let payload = raw
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload)
        } catch {
            // Intentionally swallowed: Keep as raw string if JSON parsing fails
        }
    }

    if (!payload || typeof payload !== 'object') {
        return { type: 'StreamChunk', data: { content: String(raw ?? '') } }
    }

    let innerData = payload.data !== undefined ? payload.data : payload
    if (typeof innerData === 'string') {
        try {
            innerData = JSON.parse(innerData)
        } catch {
            // Intentionally swallowed: Keep as raw string if JSON parsing fails
        }
    }

    const eventType =
        payload.type || (typeof innerData === 'object' && innerData?.type) || 'StreamChunk'

    switch (eventType) {
        case 'ThinkingChunk': {
            const content =
                (typeof innerData === 'object'
                    ? (innerData?.content ?? innerData?.thoughts)
                    : null) ??
                payload.content ??
                payload.thoughts ??
                (typeof innerData === 'string' ? innerData : '')
            return {
                type: 'ThinkingChunk',
                data: {
                    content: typeof content === 'string' ? content : JSON.stringify(content ?? ''),
                },
            }
        }
        case 'StreamChunk': {
            const content =
                (typeof innerData === 'object' ? (innerData?.content ?? innerData?.chunk) : null) ??
                payload.content ??
                payload.chunk ??
                (typeof innerData === 'string' ? innerData : '')
            return {
                type: 'StreamChunk',
                data: {
                    content: typeof content === 'string' ? content : JSON.stringify(content ?? ''),
                },
            }
        }
        case 'ToolCallStart': {
            const tc =
                (typeof innerData === 'object' && innerData?.toolCall) ||
                payload.toolCall ||
                (typeof innerData === 'object' ? innerData : payload)
            const id = tc?.id || tc?.toolCallId || `tool-${Date.now()}`
            const name = tc?.name || tc?.toolName || 'tool'
            const input = tc?.input ?? tc?.toolInput ?? tc?.args ?? {}
            return {
                type: 'ToolCallStart',
                data: {
                    toolCall: { id, name, input, args: input },
                },
            }
        }
        case 'ToolExecutionUpdate':
        case 'TerminalData': {
            const toolCallId =
                (typeof innerData === 'object' && (innerData?.toolCallId || innerData?.taskId)) ||
                payload.toolCallId ||
                payload.taskId ||
                ''
            const chunk =
                (typeof innerData === 'object' && innerData?.chunk) ||
                payload.chunk ||
                (typeof innerData === 'string' ? innerData : '')
            return {
                type: 'ToolExecutionUpdate',
                data: { toolCallId: String(toolCallId), chunk: String(chunk) },
            }
        }
        case 'ToolCallResult': {
            const res =
                typeof innerData === 'object' && innerData?.result !== undefined
                    ? innerData.result
                    : payload.result !== undefined
                      ? payload.result
                      : innerData
            const toolCallId =
                (typeof innerData === 'object' && innerData?.toolCallId) ||
                payload.toolCallId ||
                (typeof res === 'object' && res?.toolCallId) ||
                undefined
            const output =
                (typeof res === 'object' ? (res?.output ?? res?.content) : null) ??
                (typeof innerData === 'object'
                    ? (innerData?.output ?? innerData?.content)
                    : null) ??
                (typeof res === 'string' ? res : undefined)
            const error =
                (typeof res === 'object' ? res?.error : null) ??
                (typeof innerData === 'object' ? innerData?.error : null) ??
                payload.error ??
                undefined
            return {
                type: 'ToolCallResult',
                data: {
                    result: res,
                    toolCallId,
                    output,
                    error: error ? String(error) : undefined,
                },
            }
        }
        case 'FileModified': {
            const path =
                (typeof innerData === 'object' && (innerData?.path || innerData?.filePath)) ||
                payload.path ||
                payload.filePath ||
                ''
            const diff =
                (typeof innerData === 'object' && innerData?.diff) || payload.diff || undefined
            const action =
                (typeof innerData === 'object' && innerData?.action) || payload.action || 'modified'
            return {
                type: 'FileModified',
                data: {
                    path: String(path),
                    diff,
                    action,
                },
            }
        }
        case 'ContextCompacted': {
            const summary =
                (typeof innerData === 'object' && innerData?.summary) || payload.summary || ''
            return {
                type: 'ContextCompacted',
                data: { summary: String(summary) },
            }
        }
        case 'GitDiffUpdate': {
            const gitDiff =
                (typeof innerData === 'object' && innerData?.gitDiff) || payload.gitDiff || ''
            const gitStatus =
                (typeof innerData === 'object' && innerData?.gitStatus) || payload.gitStatus || ''
            return {
                type: 'GitDiffUpdate',
                data: { gitDiff: String(gitDiff), gitStatus: String(gitStatus) },
            }
        }
        case 'PullRequestUpdate': {
            const pullRequest =
                (typeof innerData === 'object' && innerData?.pullRequest) ||
                payload.pullRequest ||
                null
            return {
                type: 'PullRequestUpdate',
                data: { pullRequest },
            }
        }
        case 'PlanMilestoneUpdate': {
            const plan = (typeof innerData === 'object' && innerData?.plan) || payload.plan || null
            return {
                type: 'PlanMilestoneUpdate',
                data: { plan },
            }
        }
        case 'TestExecutionUpdate': {
            const report =
                (typeof innerData === 'object' && innerData?.report) || payload.report || null
            return {
                type: 'TestExecutionUpdate',
                data: { report },
            }
        }
        case 'PreviewPortDetected': {
            const port = (typeof innerData === 'object' && innerData?.port) || payload.port || null
            const ports = (typeof innerData === 'object' && innerData?.ports) || payload.ports || []
            const previewUrl =
                (typeof innerData === 'object' && innerData?.previewUrl) ||
                payload.previewUrl ||
                null
            return {
                type: 'PreviewPortDetected',
                data: { port, ports, previewUrl },
            }
        }
        case 'AskQuestionPrompt': {
            const questionId =
                (typeof innerData === 'object' && innerData?.questionId) || payload.questionId || ''
            const questions =
                (typeof innerData === 'object' && innerData?.questions) || payload.questions || []
            return {
                type: 'AskQuestionPrompt',
                data: { questionId, sessionId: payload.sessionId, questions },
            }
        }
        case 'BrowserViewportUpdate':
        case 'DesktopViewportUpdate': {
            const viewportData =
                typeof innerData === 'object' && innerData?.screenshot !== undefined
                    ? innerData
                    : payload
            return {
                type: 'BrowserViewportUpdate',
                data: viewportData,
            }
        }
        case 'AgentStatus': {
            const message =
                (typeof innerData === 'object' &&
                    (innerData?.message || innerData?.statusMessage)) ||
                payload.message ||
                payload.statusMessage ||
                ''
            return {
                type: 'AgentStatus',
                data: { message: String(message) },
            }
        }
        case 'AgentError': {
            const error =
                (typeof innerData === 'object' && (innerData?.error || innerData?.message)) ||
                payload.error ||
                payload.message ||
                'Agent Execution Error'
            const code = payload.code || (typeof innerData === 'object' && innerData?.code)
            return {
                type: 'AgentError',
                data: {
                    error: String(error),
                    message: String(error),
                    ...(code ? { code: String(code) } : {}),
                    ...(payload.provider ? { provider: String(payload.provider) } : {}),
                    ...(payload.keyFailure ? { keyFailure: String(payload.keyFailure) } : {}),
                },
            }
        }
        case 'AgentInterrupt': {
            return { type: 'AgentInterrupt', data: {} }
        }
        case 'TurnEnd': {
            return { type: 'TurnEnd', data: {} }
        }
        case 'AgentEnd': {
            return { type: 'AgentEnd', data: innerData }
        }
        case 'AgentStart':
        case 'TurnStart':
        case 'connected':
        case 'project-created':
        case 'phase':
        case 'message-start':
        case 'message-chunk':
        case 'message-complete':
        case 'build-plan':
        case 'patch-plan':
        case 'file-start':
        case 'file-chunk':
        case 'file-complete':
        case 'file-error':
        case 'result':
        case 'error': {
            return { type: eventType, data: innerData } as GenerationStreamEvent
        }
        default: {
            return { type: eventType, data: innerData } as any
        }
    }
}

/**
 * The user's own key failed (BYOK_KEY_FAILED or BYOK_KEY_MISSING). The stream handler
 * already showed the provider's message with "switch to december credits", so callers
 * must not show it again or treat it as a december credits problem.
 */
export class OwnKeyError extends ApiError {
    code: string

    constructor(message: string, code: string) {
        super(message, 500)
        this.name = 'OwnKeyError'
        this.code = code
    }
}

export const isOwnKeyError = (error: unknown): error is OwnKeyError => error instanceof OwnKeyError

type PromptSelection =
    // december credits: the server picks the model from the tier (#632)
    | { billingSource: 'CREDITS'; tier: Speed }
    | { billingSource: 'OWN_KEY'; model?: string; provider?: string }

/**
 * Who pays for a prompt, and what the server needs to pick the model: the tier on
 * December credits, the model and its provider on the user's own key. A caller that
 * names no source (the automatic fix of a preview error) gets what the prompt box shows.
 */
const resolvePromptSelection = (options?: {
    model?: string
    provider?: string
    billingSource?: BillingSource
    runConfig?: PromptRunConfig
}): PromptSelection => {
    const picked = getModelSelection()
    const billingSource: BillingSource =
        options?.billingSource ??
        (options?.model
            ? // a model with no source: its source in the prompt box, or credits
              picked.model === options.model && picked.provider === options.provider
                ? picked.source
                : 'CREDITS'
            : picked.source)

    if (billingSource !== 'OWN_KEY') {
        return { billingSource: 'CREDITS', tier: options?.runConfig?.effort ?? picked.speed }
    }
    return options?.model
        ? { billingSource, model: options.model, provider: options.provider }
        : { billingSource, model: picked.model, provider: picked.provider }
}

/** the session configuration that `POST /session` reads. skills go with each message */
const toSessionConfig = (runConfig?: PromptRunConfig) => ({
    ...(runConfig?.planFirst !== undefined ? { planFirst: runConfig.planFirst } : {}),
    ...(runConfig?.effort ? { effort: runConfig.effort } : {}),
    ...(runConfig?.openPullRequest !== undefined
        ? { openPullRequest: runConfig.openPullRequest }
        : {}),
    ...(runConfig?.disabledPlugins ? { disabledPlugins: runConfig.disabledPlugins } : {}),
    ...(runConfig?.disabledMcps ? { disabledMcps: runConfig.disabledMcps } : {}),
})

type CreatePromptSessionInput = {
    prompt: string
    model?: string
    provider?: string
    billingSource?: BillingSource
    runConfig?: PromptRunConfig
    repoUrl?: string
    branch?: string
    gitRef?: string
    issueNumber?: number
}
type GenerateProjectInput = {
    prompt: string
    sessionId?: string | null
    projectId?: string | null
    model?: string
    provider?: string
    billingSource?: BillingSource
    runConfig?: PromptRunConfig
    /** the stored files of this prompt (#634) */
    attachments?: UploadedAttachment[]
    /** the session the prompt box made to store the files of this first prompt */
    session?: { id: string }
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
    repoUrl?: string
    branch?: string
    gitRef?: string
    issueNumber?: number
}
type ApplyProjectEditInput = {
    sessionId?: string
    projectId?: string
    versionId?: string | null
    prompt: string
    model?: string
    provider?: string
    billingSource?: BillingSource
    runConfig?: PromptRunConfig
    /** the stored files of this prompt (#634) */
    attachments?: UploadedAttachment[]
    /** the id of this message in the chat (#637) */
    clientMessageId?: string
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}
type ApplyProjectFixInput = {
    sessionId?: string
    projectId?: string
    versionId?: string | null
    errorMessage: string
    stack?: string
    model?: string
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}

let sharedSocket: ReturnType<typeof io> | null = null

// the listeners of `prompt_queued` (#637). they are kept here, because the socket object
// is made again after a disconnect
const promptQueuedListeners = new Set<(event: any) => void>()
const dispatchPromptQueued = (event: any) => {
    for (const listener of [...promptQueuedListeners]) listener(event)
}

// `RunClosed`: the worker is done with a run, and the session takes the next one (#637).
// it comes after AgentEnd, when the stream of the run no longer listens
const runClosedListeners = new Set<(event: RunClosedEvent) => void>()
const dispatchRunClosed = (raw: any) => {
    let event = raw
    if (typeof raw === 'string') {
        try {
            event = JSON.parse(raw)
        } catch {
            // Intentionally swallowed: an event that is not json is not RunClosed
            return
        }
    }
    if (event?.type !== 'RunClosed' || typeof event.sessionId !== 'string') return
    for (const listener of [...runClosedListeners]) {
        listener({ sessionId: event.sessionId, runFollows: event.runFollows === true })
    }
}

export const getSharedSocket = (): ReturnType<typeof io> => {
    if (!sharedSocket || sharedSocket.disconnected) {
        const baseUrl = getWebSocketUrl()
        sharedSocket = io(baseUrl, {
            path: '/socket.io/',
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling'],
        })
    }
    // bound again on each use: `off` with no listener (a test, a reset) removes them
    sharedSocket.off('prompt_queued', dispatchPromptQueued)
    sharedSocket.on('prompt_queued', dispatchPromptQueued)
    sharedSocket.off('agent_event', dispatchRunClosed)
    sharedSocket.on('agent_event', dispatchRunClosed)
    return sharedSocket
}

/** the `send_prompt` message of the socket */
const toPromptPayload = (data: {
    sessionId: string
    prompt: string
    selection: PromptSelection
    runConfig?: PromptRunConfig
    attachmentIds?: string[]
    clientMessageId?: string
}) => {
    const { sessionId, prompt, selection, runConfig, attachmentIds, clientMessageId } = data
    return {
        sessionId: sessionId,
        projectId: sessionId,
        prompt: prompt,
        ...(selection.billingSource === 'OWN_KEY'
            ? { model: selection.model, provider: selection.provider }
            : { tier: selection.tier }),
        billingSource: selection.billingSource,
        ...(runConfig?.planFirst !== undefined ? { planFirst: runConfig.planFirst } : {}),
        ...(runConfig?.effort ? { effort: runConfig.effort } : {}),
        // the skills picked for this message, and the + menu switches
        ...(runConfig?.skills?.length ? { skills: runConfig.skills } : {}),
        ...(runConfig?.disabledPlugins ? { disabledPlugins: runConfig.disabledPlugins } : {}),
        ...(runConfig?.disabledMcps ? { disabledMcps: runConfig.disabledMcps } : {}),
        ...(attachmentIds?.length ? { attachments: attachmentIds } : {}),
        ...(clientMessageId ? { clientMessageId } : {}),
    }
}

const runOverSocket = async (
    sessionId: string,
    prompt: string,
    onEvent: (event: GenerationStreamEvent) => void,
    signal?: AbortSignal,
    options?: {
        attachOnly?: boolean
        model?: string
        provider?: string
        billingSource?: BillingSource
        runConfig?: PromptRunConfig
        /** the ids of the files uploaded for this prompt (#634) */
        attachmentIds?: string[]
        /** the id of this message in the chat (#637) */
        clientMessageId?: string
    }
): Promise<any> => {
    const selection = resolvePromptSelection(options)
    const runConfig = options?.runConfig
    return new Promise((resolve, reject) => {
        const socket = getSharedSocket()

        let hasResolved = false
        let hasSentPrompt = Boolean(options?.attachOnly)
        let resultData: any = null

        const cleanup = () => {
            socket.off('connect', handleConnect)
            socket.off('connect_error', handleConnectError)
            socket.off('agent_event', handleAgentEvent)
            socket.off('error', handleError)
            socket.off('disconnect', handleDisconnect)
            socket.io.off('reconnect', handleReconnect)
            socket.io.off('reconnect_failed', handleReconnectFailed)
        }

        const handleConnect = () => {
            onEvent({ type: 'connected', data: { ok: true } })

            socket.emit('join_session', sessionId)

            if (!hasSentPrompt && prompt) {
                hasSentPrompt = true
                socket.emit(
                    'send_prompt',
                    toPromptPayload({
                        sessionId,
                        prompt,
                        selection,
                        runConfig,
                        attachmentIds: options?.attachmentIds,
                        clientMessageId: options?.clientMessageId,
                    })
                )
            }
        }

        const handleReconnect = () => {
            socket.emit('join_session', sessionId)
        }

        const handleReconnectFailed = () => {
            if (!hasResolved) {
                hasResolved = true
                cleanup()
                reject(new ApiError('Socket reconnection failed after multiple attempts', 500))
            }
        }

        const handleConnectError = async (err: any) => {
            const errMsg = err?.message || ''
            if (errMsg.includes('Authentication error') || errMsg.includes('401')) {
                const refreshed = await refreshAuthSession()
                if (refreshed && !hasResolved) {
                    socket.connect()
                    return
                }
            }
            if (!hasResolved && !socket.active) {
                hasResolved = true
                cleanup()
                reject(new ApiError(err.message || 'Socket connection failed', 500))
            }
        }

        const handleAgentEvent = (rawEvent: any) => {
            const streamEvent = normalizeAgentStreamEvent(rawEvent)
            onEvent(streamEvent)

            if (streamEvent.data?.generatedFiles) {
                useAppStore.getState().replaceGeneratedOutput(streamEvent.data.generatedFiles)
            }

            if (streamEvent.type === 'GitDiffUpdate') {
                if (streamEvent.data?.gitDiff !== undefined) {
                    useAppStore.getState().setGitDiff(streamEvent.data.gitDiff)
                }
                if (streamEvent.data?.gitStatus !== undefined) {
                    useAppStore.getState().setGitStatus(streamEvent.data.gitStatus)
                }
            }

            if (streamEvent.type === 'PullRequestUpdate') {
                if (streamEvent.data?.pullRequest !== undefined) {
                    useAppStore.getState().setPullRequest(streamEvent.data.pullRequest)
                }
            }

            if (streamEvent.type === 'PlanMilestoneUpdate') {
                if (streamEvent.data?.plan !== undefined) {
                    useAppStore.getState().setSessionPlan(streamEvent.data.plan)
                }
            }

            if (streamEvent.type === 'TestExecutionUpdate') {
                if (streamEvent.data?.report !== undefined) {
                    useAppStore.getState().setTestReport(streamEvent.data.report)
                }
            }

            if (streamEvent.type === 'PreviewPortDetected') {
                if (streamEvent.data?.previewUrl) {
                    const currentSession = useAppStore.getState().previewSession
                    if (currentSession) {
                        useAppStore.getState().setPreviewSession({
                            ...currentSession,
                            previewUrl: streamEvent.data.previewUrl,
                            state: 'Healthy',
                        })
                    }
                }
            }

            if (
                streamEvent.type === 'BrowserViewportUpdate' ||
                streamEvent.type === 'DesktopViewportUpdate'
            ) {
                if (streamEvent.data) {
                    useAppStore.getState().setDesktopViewport(streamEvent.data)
                }
            }

            if (streamEvent.type === 'result' || streamEvent.type === 'AgentEnd') {
                resultData = streamEvent.data
                hasResolved = true
                cleanup()
                resolve(resultData)
            }
            if (streamEvent.type === 'error' || streamEvent.type === 'AgentError') {
                hasResolved = true
                cleanup()
                const errorMessage =
                    (streamEvent.data as any)?.error ||
                    streamEvent.data?.message ||
                    'Agent Execution Error'
                const errorCode = (streamEvent.data as any)?.code
                reject(
                    typeof errorCode === 'string' && errorCode.startsWith('BYOK_')
                        ? new OwnKeyError(errorMessage, errorCode)
                        : new ApiError(errorMessage, 500)
                )
            }
        }

        const handleError = (err: any) => {
            if (!hasResolved) {
                hasResolved = true
                cleanup()
                reject(new ApiError(err.message || 'Socket error', 500))
            }
        }

        const handleDisconnect = (reason: string) => {
            if (reason === 'io server disconnect' && !hasResolved) {
                hasResolved = true
                cleanup()
                reject(new Error('Socket disconnected by server'))
            }
        }

        if (signal) {
            signal.addEventListener('abort', () => {
                if (!hasResolved) {
                    hasResolved = true
                    if (signal.reason === 'stop_session') {
                        socket.emit('stop_session', { sessionId })
                    }
                    cleanup()
                    reject(new Error('Aborted'))
                }
            })
        }

        socket.on('connect_error', handleConnectError)
        socket.on('agent_event', handleAgentEvent)
        socket.on('error', handleError)
        socket.on('disconnect', handleDisconnect)
        socket.io.on('reconnect', handleReconnect)
        socket.io.on('reconnect_failed', handleReconnectFailed)

        if (socket.connected) {
            handleConnect()
        } else {
            socket.on('connect', handleConnect)
            if (socket.disconnected) {
                socket.connect()
            }
        }
    })
}

/** the ids a prompt names for its stored files */
const toAttachmentIds = (attachments?: UploadedAttachment[]) =>
    attachments?.length ? attachments.map((attachment) => attachment.id) : undefined

/**
 * Makes the session of a first prompt. An own-key session tells the server which key
 * pays, so it does not ask for credits.
 */
const createPromptSession = async (data: CreatePromptSessionInput) => {
    const { prompt, repoUrl, branch, gitRef, issueNumber, runConfig } = data
    const selection = resolvePromptSelection(data)
    return sessionAPI.createSession({
        prompt,
        type: 'WEB',
        repoUrl,
        branch,
        gitRef,
        issueNumber,
        ...(selection.billingSource === 'OWN_KEY'
            ? {
                  billingSource: 'OWN_KEY' as const,
                  provider: selection.provider,
                  model: selection.model,
              }
            : { tier: selection.tier }),
        ...toSessionConfig(runConfig),
    })
}

/**
 * @deprecated Legacy generation wrapper. Use standard session socket communication instead.
 */
const generateProjectStream = async ({
    prompt,
    sessionId,
    projectId,
    model,
    provider,
    billingSource,
    runConfig,
    attachments,
    session,
    signal,
    onEvent,
    repoUrl,
    branch,
    gitRef,
    issueNumber,
}: GenerateProjectInput) => {
    let targetSessionId = sessionId || projectId
    const selection = resolvePromptSelection({ model, provider, billingSource, runConfig })

    if (!targetSessionId) {
        // create new session if no session id provided. the prompt box made it already
        // when it had files to store.
        let newSession: { id: string }
        try {
            newSession =
                session ??
                (await createPromptSession({
                    prompt,
                    repoUrl,
                    branch,
                    gitRef,
                    issueNumber,
                    model,
                    provider,
                    billingSource,
                    runConfig,
                }))
        } catch (error) {
            // the server checks the own key before it creates the session (400, for example
            // "add your OpenAI key in settings first"). show it the same way as a key failure
            // during the run, with "switch to december credits", and do not show it twice.
            if (
                selection.billingSource === 'OWN_KEY' &&
                error instanceof ApiError &&
                error.status === 400
            ) {
                onEvent({
                    type: 'AgentError',
                    data: { error: error.message, code: 'BYOK_KEY_MISSING' },
                })
                throw new OwnKeyError(error.message, 'BYOK_KEY_MISSING')
            }
            throw error
        }
        targetSessionId = newSession.id

        onEvent({
            type: 'project-created',
            data: {
                project: newSession as unknown as BackendProject,
                version: {
                    id: newSession.id,
                },
            },
        })
    }

    // the prompt box stored the files before it sent the prompt. the prompt names their ids
    return await runOverSocket(targetSessionId, prompt, onEvent, signal, {
        model,
        provider,
        billingSource: selection.billingSource,
        runConfig,
        attachmentIds: toAttachmentIds(attachments),
    })
}

/**
 * @deprecated Legacy generation wrapper. Use standard session socket communication instead.
 */
const applyProjectEdit = async (data: ApplyProjectEditInput) => {
    const targetSessionId = data.sessionId || data.projectId
    if (!targetSessionId) throw new Error('sessionId is required for edit')
    const attachmentIds = toAttachmentIds(data.attachments)
    return await runOverSocket(targetSessionId, data.prompt, data.onEvent, data.signal, {
        model: data.model,
        provider: data.provider,
        ...(data.billingSource ? { billingSource: data.billingSource } : {}),
        runConfig: data.runConfig,
        attachmentIds,
        clientMessageId: data.clientMessageId,
    })
}

/**
 * @deprecated Legacy generation wrapper. Use standard session socket communication instead.
 */
const applyProjectFix = async (data: ApplyProjectFixInput) => {
    const targetSessionId = data.sessionId || data.projectId
    if (!targetSessionId) throw new Error('sessionId is required for fix')
    const prompt = `Fix error: ${data.errorMessage}\n\nStack:\n${data.stack || ''}`
    return await runOverSocket(targetSessionId, prompt, data.onEvent, data.signal)
}

const listenToSessionStream = async (
    sessionId: string,
    onEvent: (event: GenerationStreamEvent) => void,
    signal?: AbortSignal
): Promise<any> => {
    return await runOverSocket(sessionId, '', onEvent, signal, { attachOnly: true })
}

/**
 * A message for a session whose run works (#637, "send now"). It opens no new stream: the
 * stream of the run shows what the agent does with it.
 */
const sendMessageToRun = async (data: {
    sessionId: string
    prompt: string
    clientMessageId: string
    model?: string
    provider?: string
    billingSource?: BillingSource
    runConfig?: PromptRunConfig
    attachments?: UploadedAttachment[]
}) => {
    const attachmentIds = toAttachmentIds(data.attachments)
    getSharedSocket().emit(
        'send_prompt',
        toPromptPayload({
            sessionId: data.sessionId,
            prompt: data.prompt,
            selection: resolvePromptSelection(data),
            runConfig: data.runConfig,
            attachmentIds,
            clientMessageId: data.clientMessageId,
        })
    )
}

export interface PromptQueuedEvent {
    sessionId: string
    prompt?: string
    clientMessageId?: string
}

/**
 * The server did not take a prompt, because a run works in the session and new messages
 * are queued (#637). The web holds the message until the run ends. Returns the unsubscribe.
 */
const onPromptQueued = (listener: (event: PromptQueuedEvent) => void) => {
    getSharedSocket()
    promptQueuedListeners.add(listener)
    return () => {
        promptQueuedListeners.delete(listener)
    }
}

export interface RunClosedEvent {
    sessionId: string
    /** the server queued a run for a message the ended run did not read */
    runFollows: boolean
}

/** The session is free for its next run (#637). Returns the unsubscribe. */
const onRunClosed = (listener: (event: RunClosedEvent) => void) => {
    getSharedSocket()
    runClosedListeners.add(listener)
    return () => {
        runClosedListeners.delete(listener)
    }
}

const stopSessionStream = (sessionId: string) => {
    const socket = getSharedSocket()
    socket.emit('stop_session', { sessionId })
}

/**
 * @deprecated Legacy generation wrappers. Use standard session socket communication instead.
 */
export const generationAPI = {
    createPromptSession,
    generateProjectStream,
    applyProjectEdit,
    applyProjectFix,
    listenToSessionStream,
    stopSessionStream,
    sendMessageToRun,
    onPromptQueued,
    onRunClosed,
}
