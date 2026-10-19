import { Agent } from '@december/agent'
import { Box, useInput } from 'ink'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'

import { GlobalShortcuts } from './components/global-shortcuts'
import { formatModelDisplayName } from './components/header'
import { InputBar } from './components/input-bar'
import { AskQuestionMenu } from './components/menus/ask-question-menu'
import { AuthMenus } from './components/menus/auth-menus'
import { GrillQuestionMenu } from './components/menus/grill-question-menu'
import { PlanApproveMenu } from './components/menus/plan-approve-menu'
import { ToolPermissionMenu } from './components/menus/tool-permission-menu'
import { MessageList } from './components/message-list'
import { ScrollViewport, type ScrollViewportHandle } from './components/scroll-viewport'
import { useTerminalColumns, useTerminalRows } from './hooks/use-terminal-columns'
import { extractPlanSummary } from './utils/pager'

import type { ReleaseAnnouncement } from './constants/announcements'

export function ChatApp({
    agent,
    isAuthenticated: initialAuth,
    cliVersion,
    latestVersion,
    userEmail,
    sessionRepository,
    onLogin,
    onUpdateSuccess,
    session,
    announcement,
    activeModel,
    authMethod,
    selectedProvider,
    modelLabel,
    onExit,
}: {
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    sessionRepository?: any
    onLogin?: (
        onCode: (code: string, uri: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    onUpdateSuccess?: () => Promise<void>
    session: any
    announcement?: ReleaseAnnouncement | null
    activeModel?: string
    authMethod?: string
    selectedProvider?: string
    modelLabel?: string
    onExit?: () => void
}) {
    const [exitConfirm, setExitConfirm] = useState(false)
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleInterrupt = useCallback(() => {
        if (session.pendingDeviceAuthUrl) {
            if (onExit) {
                onExit()
            } else {
                process.exit(0)
            }
            return
        }

        if (session.isStreaming) {
            if (session.handleAbort) {
                session.handleAbort()
            } else if (agent?.abort) {
                agent.abort()
            }
        }

        if (exitConfirm) {
            if (exitTimerRef.current) {
                clearTimeout(exitTimerRef.current)
                exitTimerRef.current = null
            }
            if (onExit) {
                onExit()
            } else {
                process.exit(0)
            }
        } else {
            setExitConfirm(true)
            if (exitTimerRef.current) {
                clearTimeout(exitTimerRef.current)
            }
            exitTimerRef.current = setTimeout(() => {
                setExitConfirm(false)
                exitTimerRef.current = null
            }, 3000)
        }
    }, [exitConfirm, session, agent, onExit])

    useEffect(() => {
        return () => {
            if (exitTimerRef.current) {
                clearTimeout(exitTimerRef.current)
                exitTimerRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!process.stdout?.isTTY) return

        const isWindows = process.platform === 'win32'

        try {
            if (isWindows) {
                // On Windows: Do not capture mouse clicks/motion (modes 1000/1002/1006).
                // This preserves native Windows Terminal click-and-drag selection and copying without holding Shift.
                // Enable Alternate Scroll Mode (mode 1007), which converts mouse wheel scrolls into arrow keys.
                process.stdout.write('\x1b[?1007h')
            } else {
                // On macOS and Linux: Enable SGR mouse tracking, button-event tracking, and alternate scroll mode.
                process.stdout.write('\x1b[?1000h\x1b[?1002h\x1b[?1006h\x1b[?1007h')
            }
        } catch {
            // Intentionally swallowed: ignore stdout write errors on mount
        }

        return () => {
            try {
                if (isWindows) {
                    process.stdout.write('\x1b[?1007l')
                } else {
                    process.stdout.write('\x1b[?1007l\x1b[?1006l\x1b[?1002l\x1b[?1000l')
                }
            } catch {
                // Intentionally swallowed: cleanup terminal mouse modes on unmount
            }
        }
    }, [])

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            handleInterrupt()
        }
    })

    const {
        staticKey,
        staticMessages,
        activeMessages,
        isAuthenticated,
        currentEmail,
        authMode,
        grillMode,
        planWorkflow,
        setStaticMessages,
        setStaticKey,
        setActiveMessages,
        setAuthMode,
        handleSubmit,
    } = session

    const workflowPhase = planWorkflow?.phase

    const workflowUI =
        workflowPhase === 'grilling' ? (
            <GrillQuestionMenu
                {...session}
                grillQuestions={planWorkflow.questions}
                currentGrillIndex={planWorkflow.currentIndex}
                grillAnswers={planWorkflow.answers}
            />
        ) : workflowPhase === 'reviewing' ? (
            <PlanApproveMenu
                {...session}
                planSummary={
                    planWorkflow.planText
                        ? extractPlanSummary(planWorkflow.planText)
                        : session.planSummary || planWorkflow.prompt
                }
            />
        ) : null

    const authUI =
        authMode !== 'none' ? (
            authMode === 'ask_question' && session.pendingQuestions ? (
                <AskQuestionMenu
                    questions={session.pendingQuestions.questions}
                    onComplete={(answers) => {
                        session.pendingQuestions?.resolve(
                            typeof answers === 'string' ? answers : answers.join(', ')
                        )
                        setAuthMode('none')
                        session.setPendingQuestions(null)
                    }}
                />
            ) : authMode === 'tool_permission' && session.pendingToolCall ? (
                <ToolPermissionMenu
                    toolCall={session.pendingToolCall.toolCall}
                    onComplete={(result) => {
                        session.pendingToolCall?.resolve(result)
                        setAuthMode('none')
                        session.setPendingToolCall(null)
                    }}
                />
            ) : (
                <AuthMenus
                    {...session}
                    agent={agent}
                    getProviderModels={session.getProviderModels}
                    cliVersion={cliVersion}
                />
            )
        ) : null

    const [isReadingMode, setIsReadingMode] = useState(false)

    const handleFormSubmit = useCallback(
        (text: string, options?: { returnQuery?: string }) => {
            handleSubmit(text, options)
        },
        [handleSubmit]
    )

    const totalTokens = useMemo(() => {
        return [...staticMessages, ...activeMessages].reduce((acc, msg) => {
            if (msg.usage) {
                return acc + (msg.usage.promptTokens || 0) + (msg.usage.completionTokens || 0)
            }
            return acc
        }, 0)
    }, [staticMessages, activeMessages])

    const rows = useTerminalRows()
    const columns = useTerminalColumns()

    const scrollViewportRef = useRef<ScrollViewportHandle>(null)

    const handleScrollUp = useCallback((delta: number = 1) => {
        scrollViewportRef.current?.scrollUp(delta)
    }, [])

    const handleScrollDown = useCallback((delta: number = 1) => {
        scrollViewportRef.current?.scrollDown(delta)
    }, [])

    const handleCopy = useCallback(() => {
        import('./utils/clipboard')
            .then((cb) => {
                const allMsgs = [...staticMessages, ...activeMessages]
                const lastAssistant = [...allMsgs]
                    .reverse()
                    .find((m) => m.role === 'assistant' && m.blocks)
                if (lastAssistant) {
                    const text =
                        lastAssistant.blocks?.map((b: any) => b.content || '').join('\n') || ''
                    cb.writeToClipboard(text)
                    session.addToast?.('Copied to clipboard.', 'success')
                }
            })
            .catch(() => {
                // Intentionally swallowed: clipboard copy error fallback handled
            })
    }, [staticMessages, activeMessages, session])

    const handleResetChat = useCallback(() => {
        console.clear()
        setStaticMessages([{ id: 'header-' + Date.now(), role: 'header' }])
        setStaticKey((k: number) => k + 1)
        setActiveMessages([])
        session.setQueuedPrompts?.([])
        session.addToast?.('Started a new conversation.', 'success')
    }, [setStaticMessages, setStaticKey, setActiveMessages, session])

    const effectiveModel =
        session.activeModel || activeModel || agent?.modelOptions?.model || 'gemini-3.7-flash'
    const effectiveModelLabel = session.activeModel
        ? formatModelDisplayName(session.activeModel)
        : modelLabel || formatModelDisplayName(effectiveModel)
    const effectiveAuthMethod = session.authMethod || authMethod
    const effectiveProvider = session.selectedProvider || selectedProvider

    const isDeviceAuthPending = Boolean(session.pendingDeviceAuthUrl)

    const inputBarElement = (
        <InputBar
            onSubmit={handleFormSubmit}
            onScrollUp={handleScrollUp}
            onScrollDown={handleScrollDown}
            onStartVoice={session.onStartVoice}
            disabled={
                authMode !== 'none' ||
                (Boolean(workflowUI) && !session.customInputMode) ||
                isDeviceAuthPending
            }
            onCopy={handleCopy}
            placeholder={
                isDeviceAuthPending
                    ? 'Waiting for approval... Press [o] to open in browser'
                    : 'Ask December to build features, fix bugs, or work on your code...'
            }
            activeModel={effectiveModel}
            modelLabel={effectiveModelLabel}
            contextTokens={totalTokens}
            authMethod={session.authMethod}
            isAuthenticated={isAuthenticated}
            hasBothAuth={session.hasBothAuth}
            authUI={authUI}
            workflowUI={workflowUI}
            planWorkflowPhase={workflowPhase}
            interactivePlanGoalMode={session.interactivePlanGoalMode}
            agent={agent}
            toasts={session.toasts}
            resetChat={handleResetChat}
            onUpdateSuccess={onUpdateSuccess}
            queuedPrompts={session.queuedPrompts}
            grillMode={grillMode}
            planRefineMode={session.planRefineMode}
            customInputMode={session.customInputMode || false}
            showExitConfirm={exitConfirm}
            tasks={session.tasks}
            onExit={onExit}
            btwState={session.btwState}
            onDismissBtw={session.handleDismissBtw}
            cliVersion={cliVersion}
            userEmail={currentEmail || userEmail}
            selectedProvider={effectiveProvider}
            prefillPrompt={session.prefillPrompt}
            onClearPrefillPrompt={session.onClearPrefillPrompt}
        />
    )

    return (
        <Box flexDirection="column" height={rows} width={columns} overflow="hidden">
            <GlobalShortcuts {...session} agent={agent} />
            <ScrollViewport
                ref={scrollViewportRef}
                isGenerating={session.isStreaming}
                isActive={authMode === 'none'}
                onCopy={handleCopy}
                onScrollChange={(linesBelow) => setIsReadingMode(linesBelow > 0)}
            >
                <MessageList
                    staticKey={staticKey}
                    staticMessages={staticMessages}
                    activeMessages={activeMessages}
                    isAuthenticated={isAuthenticated}
                    cliVersion={cliVersion}
                    latestVersion={latestVersion}
                    userEmail={currentEmail || userEmail}
                    expandCommands={session.expandCommands}
                    fullscreen={true}
                    announcement={announcement}
                    isReadingMode={isReadingMode}
                    activeModel={effectiveModel}
                    modelLabel={effectiveModelLabel}
                    authMethod={effectiveAuthMethod}
                    selectedProvider={effectiveProvider}
                />
            </ScrollViewport>

            <Box flexDirection="column" flexShrink={0} width="100%">
                {inputBarElement}
            </Box>
        </Box>
    )
}
