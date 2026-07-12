import { useAuth } from '../features/auth/use-auth'
import { useChat } from '../features/chat/use-chat'
import { useSettings } from '../features/settings/use-settings'
import { useTasks } from '../features/tasks/use-tasks'
import { useSessions } from '../features/sessions/use-sessions'
import { useHooks } from '../features/hooks/use-hooks'
import { Box, useApp, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import { useState, useCallback, useEffect } from 'react'

const CustomIndicator = ({ isSelected }: { isSelected?: boolean }) => (
    <Box marginRight={1}>
        <Text color={isSelected ? '#89B4F8' : '#AAAAAA'} bold={false}>
            {isSelected ? '❭' : ' '}
        </Text>
    </Box>
)

const CustomItem = ({ isSelected, label }: { isSelected?: boolean; label: string }) => (
    <Text color={isSelected ? '#89B4F8' : '#AAAAAA'} bold={false}>
        {label}
    </Text>
)

import { getProviderModels, getModelLabel, getModelContextWindow } from '../utils/models'

import {
    MessageList,
    AuthMode,
    Message,
    InputBar,
    useTerminalColumns,
    useToast,
} from '@december/tui'

import { parseErrorMessage } from '../utils/error-parser'
import { getGrillPrompt, getPlanPrompt } from '../constants/prompts'
import { MESSAGES } from '../constants/messages'

import type { MessageBlock } from '@december/tui'

import {
    Agent,
    runAgentLoop,
    saveConfig,
    loadConfig,
    getProviderConfig,
    taskManager,
} from '@december/agent'
import type { FileSessionRepository, SessionInfo, BackgroundTask } from '@december/agent'
import {
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenRouterProvider,
} from '@december/providers'

function getToolSummary(name: string, inputStr: string): string {
    try {
        const args = JSON.parse(inputStr || '{}')
        switch (name) {
            case 'read_file':
                return `Read(${args.filePath || args.path || ''})`.trim()
            case 'write_file':
                return `Create(${args.filePath || args.path || ''})`.trim()
            case 'edit_file':
            case 'edit_diff':
                return `Edit(${args.filePath || args.path || ''})`.trim()
            case 'list_dir':
                return `List(${args.dirPath || args.path || ''})`.trim()
            case 'bash':
                return `Bash(${args.command || ''})`.trim()
            case 'find_files':
                return `Search(${args.pattern || args.query || ''})`.trim()
            case 'grep_search':
                return `Search(${args.pattern || args.query || ''})`.trim()
            case 'subagent':
                return `Subagent()`
            default:
                return `${name}()`
        }
    } catch {
        return `${name}()`
    }
}

let msgId = 0

export function useAgentSession({
    agent,
    isAuthenticated: initialAuth,
    cliVersion,
    userEmail,
    sessionRepository,
    onLogin,
    onLoginHeadless,
}: {
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
    sessionRepository?: FileSessionRepository
    onLogin?: () => Promise<{ token: string; email: string | null }>
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void
    ) => Promise<{ token: string; email: string | null }>
}) {
    const settingsFeature = useSettings()
    const {
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsNotifications,
        setSettingsNotifications,
        settingsShowTasks,
        setSettingsShowTasks,
        settingsShowTips,
        setSettingsShowTips,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsTelemetry,
        setSettingsTelemetry,
        settingsAutoUpdate,
        setSettingsAutoUpdate,
        settingsSelectedIndex,
        setSettingsSelectedIndex,
        settingsDefaultModel,
        setSettingsDefaultModel,
        settingsMaxTokens,
        setSettingsMaxTokens,
    } = settingsFeature
    const tasksFeature = useTasks()
    const {
        tasksData,
        setTasksData,
        taskSelectedIndex,
        setTaskSelectedIndex,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
    } = tasksFeature
    const sessionsFeature = useSessions()
    const {
        sessionItems,
        setSessionItems,
        sessionsData,
        setSessionsData,
        sessionPage,
        setSessionPage,
        sessionSelectedIndex,
        setSessionSelectedIndex,
        sessionRenameMode,
        setSessionRenameMode,
        sessionNewName,
        setSessionNewName,
    } = sessionsFeature
    const hooksFeature = useHooks()
    const {
        selectedHookType,
        setSelectedHookType,
        hookMatchers,
        setHookMatchers,
        addingMatcher,
        setAddingMatcher,
        newMatcherRegex,
        setNewMatcherRegex,
        matcherIndex,
        setMatcherIndex,
    } = hooksFeature
    const authFeature = useAuth({ initialAuth, userEmail })
    const {
        isAuthenticated,
        setIsAuthenticated,
        currentEmail,
        setCurrentEmail,
        authMode,
        setAuthMode,
        logoutItems,
        setLogoutItems,
        selectedProvider,
        setSelectedProvider,
        apiKey,
        setApiKey,
        openRouterModels,
        setOpenRouterModels,
    } = authFeature
    const chatFeature = useChat()
    const {
        currentPlannedPrompt,
        setCurrentPlannedPrompt,
        planMode,
        setPlanMode,
        grillMode,
        setGrillMode,
        grillQuestions,
        setGrillQuestions,
        currentGrillIndex,
        setCurrentGrillIndex,
        grillAnswers,
        setGrillAnswers,
        grillPrompt,
        setGrillPrompt,
        customInputMode,
        setCustomInputMode,
        customAnswer,
        setCustomAnswer,
        staticMessages,
        setStaticMessages,
        staticKey,
        setStaticKey,
        activeMessages,
        setActiveMessages,
        isStreaming,
        setIsStreaming,
    } = chatFeature

    const [pendingQuestions, setPendingQuestions] = useState<{
        questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        resolve: (answer: string) => void
    } | null>(null)

    useEffect(() => {
        if (agent) {
            agent.operations.askQuestion = (questions) => {
                return new Promise((resolve) => {
                    setAuthMode('ask_question')
                    setPendingQuestions({ questions, resolve })
                })
            }
        }
    }, [agent])

    const cols = useTerminalColumns()
    const panelWidth = Math.floor(cols * 0.45)

    const toast = useToast()

    const { exit } = useApp()

    // Hooks state

    useEffect(() => {
        if (authMode === 'tasks_mode') {
            const update = () => {
                setTasksData([...taskManager.getTasks()])
            }
            update()
            const interval = setInterval(update, 500)
            return () => clearInterval(interval)
        }
    }, [authMode])

    useInput((input, key) => {
        if (authMode === 'hooks' && selectedHookType && !addingMatcher) {
            const matchers = hookMatchers[selectedHookType] || []
            const maxIdx = matchers.length + 1 // +2 items for Add/MatchAll, so len + 1 is the last index

            if (key.upArrow) {
                setMatcherIndex(Math.max(0, matcherIndex - 1))
            } else if (key.downArrow) {
                setMatcherIndex(Math.min(maxIdx, matcherIndex + 1))
            } else if (key.return) {
                if (matcherIndex === 0) {
                    setAddingMatcher(true)
                } else if (matcherIndex === 1) {
                    setHookMatchers((prev) => {
                        const existing = prev[selectedHookType] || []
                        return {
                            ...prev,
                            [selectedHookType]: [...existing, { pattern: '.*', enabled: true }],
                        }
                    })
                }
            } else if (input === 'e') {
                if (matcherIndex > 1) {
                    const idx = matcherIndex - 2
                    setHookMatchers((prev) => {
                        const existing = [...(prev[selectedHookType] || [])]
                        if (existing[idx]) {
                            existing[idx].enabled = !existing[idx].enabled
                        }
                        return { ...prev, [selectedHookType]: existing }
                    })
                }
            } else if (key.backspace || key.delete) {
                if (matcherIndex > 1) {
                    const idx = matcherIndex - 2
                    setHookMatchers((prev) => {
                        const existing = [...(prev[selectedHookType] || [])]
                        if (existing[idx]) {
                            existing.splice(idx, 1)
                        }
                        return { ...prev, [selectedHookType]: existing }
                    })
                    setMatcherIndex(Math.max(0, matcherIndex - 1))
                }
            }
        }

        if (authMode === 'tasks_mode') {
            if (taskViewingId) {
                if (key.escape) {
                    setTaskViewingId(null)
                } else if (key.upArrow) {
                    setTaskScrollOffset((prev) => Math.max(0, prev - 1))
                } else if (key.downArrow) {
                    setTaskScrollOffset((prev) => prev + 1)
                } else if (key.leftArrow) {
                    setTaskScrollOffset((prev) => Math.max(0, prev - 15))
                } else if (key.rightArrow) {
                    setTaskScrollOffset((prev) => prev + 15)
                }
                return
            }

            const currentTask = tasksData[taskSelectedIndex]
            if (key.upArrow) {
                setTaskSelectedIndex((prev) => Math.max(0, prev - 1))
            } else if (key.downArrow) {
                setTaskSelectedIndex((prev) => Math.min(tasksData.length - 1, prev + 1))
            } else if (key.return && currentTask) {
                setTaskViewingId(currentTask.id)
                setTaskScrollOffset(0)
            } else if (input === 'k' && currentTask) {
                const killed = taskManager.killTask(currentTask.id)
                if (killed) {
                    toast.show({
                        variant: 'success',
                        message: MESSAGES.TASKS.KILLED(currentTask.id),
                    })
                } else {
                    toast.show({
                        variant: 'error',
                        message: `Task ${currentTask.id} is not running.`,
                    })
                }
                setTasksData([...taskManager.getTasks()])
            } else if (input === 'x' && currentTask) {
                taskManager.removeTask(currentTask.id)
                toast.show({ message: `Task ${currentTask.id} removed from list.` })
                const nextTasks = taskManager.getTasks()
                setTasksData(nextTasks)
                setTaskSelectedIndex((prev) => Math.min(nextTasks.length - 1, Math.max(0, prev)))
            }
        }

        if (authMode === 'session_select' && !sessionRenameMode) {
            const SESSION_PAGE_SIZE = 10
            const maxPage = Math.max(0, Math.ceil(sessionsData.length / SESSION_PAGE_SIZE) - 1)
            const currentCount = Math.min(
                SESSION_PAGE_SIZE,
                sessionsData.length - sessionPage * SESSION_PAGE_SIZE
            )

            if (key.upArrow) {
                setSessionSelectedIndex(Math.max(0, sessionSelectedIndex - 1))
            } else if (key.downArrow) {
                setSessionSelectedIndex(Math.min(currentCount - 1, sessionSelectedIndex + 1))
            } else if (key.leftArrow) {
                if (sessionPage > 0) {
                    setSessionPage(sessionPage - 1)
                    setSessionSelectedIndex(0)
                }
            } else if (key.rightArrow) {
                if (sessionPage < maxPage) {
                    setSessionPage(sessionPage + 1)
                    setSessionSelectedIndex(0)
                }
            } else if (key.return) {
                const absIndex = sessionPage * SESSION_PAGE_SIZE + sessionSelectedIndex
                const session = sessionsData[absIndex]
                if (session) {
                    // Call the same logic that handleSessionSelect used
                    handleSessionSelect({ value: session.id })
                }
            } else if (key.f2 || input === 'r') {
                const absIndex = sessionPage * SESSION_PAGE_SIZE + sessionSelectedIndex
                const session = sessionsData[absIndex]
                if (session) {
                    setSessionNewName(session.preview || session.id)
                    setSessionRenameMode(true)
                }
            } else if ((key.delete && key.ctrl) || (key.backspace && key.ctrl) || input === 'd') {
                // Adding 'd' as alternative since ctrl+delete may not be captured properly
                const absIndex = sessionPage * SESSION_PAGE_SIZE + sessionSelectedIndex
                const session = sessionsData[absIndex]
                if (session && sessionRepository?.deleteSession) {
                    sessionRepository.deleteSession(session.id).then(() => {
                        const nextData = [...sessionsData]
                        nextData.splice(absIndex, 1)
                        setSessionsData(nextData)

                        // Adjust indexes
                        const newMaxPage = Math.max(
                            0,
                            Math.ceil(nextData.length / SESSION_PAGE_SIZE) - 1
                        )
                        if (sessionPage > newMaxPage) {
                            setSessionPage(newMaxPage)
                        }
                        const newCurrentCount = Math.min(
                            SESSION_PAGE_SIZE,
                            nextData.length - Math.min(sessionPage, newMaxPage) * SESSION_PAGE_SIZE
                        )
                        if (sessionSelectedIndex >= newCurrentCount) {
                            setSessionSelectedIndex(Math.max(0, newCurrentCount - 1))
                        }
                    })
                }
            }
        }

        if (key.escape || (input === 'c' && key.ctrl)) {
            if (isStreaming) {
                agent.abort()
                setIsStreaming(false)
            } else if (grillMode || planMode) {
                setGrillMode(false)
                setPlanMode(false)
            } else if (authMode === 'plan_mode') {
                setAuthMode('none')
            } else if (authMode === 'grill_question' && customInputMode) {
                setCustomInputMode(false)
                setCustomAnswer('')
            } else if (authMode === 'grill_question') {
                setAuthMode('none')
                setGrillQuestions([])
                setGrillAnswers([])
                setGrillPrompt(null)
                toast.show({ variant: 'error', message: 'Grill cancelled.' })
            } else if (authMode === 'byok_key') {
                setAuthMode('byok_provider')
            } else if (authMode === 'byok_provider' || authMode === 'december_login_select') {
                setAuthMode('menu')
            } else if (
                authMode === 'menu' ||
                authMode === 'model_select' ||
                authMode === 'logout_select' ||
                authMode === 'session_select' ||
                authMode === 'plan_approve' ||
                authMode === 'settings_main' ||
                authMode === 'context_select' ||
                authMode === 'hooks' ||
                authMode === 'tasks_mode' ||
                authMode === 'usage'
            ) {
                if (authMode === 'plan_approve') {
                    setCurrentPlannedPrompt(null)
                    toast.show({ variant: 'error', message: 'Plan cancelled.' })
                }

                if (authMode === 'session_select') {
                    if (sessionRenameMode) {
                        setSessionRenameMode(false)
                        setSessionNewName('')
                        return
                    }
                }

                if (authMode === 'hooks') {
                    if (addingMatcher) {
                        setAddingMatcher(false)
                        setNewMatcherRegex('')
                        return
                    }
                    if (selectedHookType) {
                        setSelectedHookType(null)
                        return
                    }
                }

                setAuthMode('none')
            } else if (input === 'c' && key.ctrl) {
                exit()
                process.exit(0)
            }
        }
    })

    const generateGrillQuestions = useCallback(
        async (userPrompt: string) => {
            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: '*Analyzing prompt and generating grill questions...*',
                        },
                    ],
                },
            ])

            try {
                const prompt = getGrillPrompt(userPrompt)

                const stream = agent.llm.stream(
                    [{ role: 'user', content: prompt }],
                    undefined,
                    undefined,
                    agent.modelOptions
                )
                let accumulatedText = ''
                for await (const chunk of stream) {
                    if (chunk.type === 'text') {
                        accumulatedText += chunk.text
                    }
                }

                let cleanJson = accumulatedText.trim()
                if (cleanJson.startsWith('```')) {
                    cleanJson = cleanJson.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '')
                }
                cleanJson = cleanJson.trim()

                const questions = JSON.parse(cleanJson)
                if (!Array.isArray(questions) || questions.length === 0) {
                    throw new Error('Invalid questions format returned from model.')
                }

                setGrillQuestions(questions)
                setGrillPrompt(userPrompt)
                setGrillAnswers([])
                setCurrentGrillIndex(0)
                setAuthMode('grill_question')
                setCustomInputMode(false)

                setActiveMessages([])
            } catch (err: any) {
                const cleanError = parseErrorMessage(err)
                toast.show({ variant: 'error', message: 'Failed to generate grill questions.' })
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'error',
                        text: `Grill Failed: ${cleanError}`,
                    },
                ])
            } finally {
                setIsStreaming(false)
            }
        },
        [agent, activeMessages, toast]
    )

    const generatePlanFromGrill = useCallback(
        async (answers: string[]) => {
            setAuthMode('none')
            const originalPrompt = grillPrompt
            setGrillPrompt(null)
            setGrillQuestions([])
            setGrillAnswers([])

            if (!originalPrompt) return

            setCurrentPlannedPrompt(originalPrompt)

            const planPrompt = getPlanPrompt(
                originalPrompt || '',
                grillQuestions.map((q, i) => ({ question: q.question, answer: answers[i] }))
            )

            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'user',
                    text: `Generate plan from grill interview for: "${originalPrompt}"`,
                },
                { id: ++msgId, role: 'assistant', blocks: [] },
            ])

            const assistantMsgId = msgId
            try {
                const stream = runAgentLoop(agent, planPrompt)

                for await (const event of stream) {
                    setActiveMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== assistantMsgId) return msg
                            const blocks = [...(msg.blocks || [])]
                            switch (event.type) {
                                case 'TurnStart':
                                    blocks.push({ type: 'text', content: 'Working...' })
                                    break
                                case 'AgentError': {
                                    const errMsg = parseErrorMessage({ message: event.error })
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (
                                        lastBlock &&
                                        lastBlock.type === 'text' &&
                                        (lastBlock.content === 'Working...' ||
                                            lastBlock.content === 'Thinking...' ||
                                            lastBlock.content.startsWith('Rate limit hit'))
                                    ) {
                                        lastBlock.content = `\n\n**Agent Error:** ${errMsg}\n`
                                    } else {
                                        blocks.push({
                                            type: 'text',
                                            content: `\n\n**Agent Error:** ${errMsg}\n`,
                                        })
                                    }
                                    break
                                }
                                case 'AgentStatus': {
                                    const statusBlock = blocks[blocks.length - 1]
                                    if (
                                        statusBlock &&
                                        statusBlock.type === 'text' &&
                                        (statusBlock.content === 'Working...' ||
                                            statusBlock.content === 'Thinking...' ||
                                            statusBlock.content.startsWith('Rate limit hit'))
                                    ) {
                                        statusBlock.content = event.message || 'Working...'
                                    } else if (event.message) {
                                        blocks.push({ type: 'text', content: event.message })
                                    }
                                    break
                                }
                                case 'StreamChunk':
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (lastBlock && lastBlock.type === 'text') {
                                        lastBlock.content =
                                            (lastBlock.content === 'Working...' ||
                                            lastBlock.content === 'Thinking...' ||
                                            lastBlock.content.startsWith('Rate limit hit')
                                                ? ''
                                                : lastBlock.content) + event.content
                                    } else {
                                        blocks.push({ type: 'text', content: event.content })
                                    }
                                    break
                                case 'ThinkingChunk': {
                                    const lastThinkBlock = blocks[blocks.length - 1]
                                    if (lastThinkBlock && lastThinkBlock.type === 'thinking') {
                                        lastThinkBlock.content += event.content
                                    } else {
                                        if (
                                            blocks.length > 0 &&
                                            blocks[blocks.length - 1].type === 'text' &&
                                            (blocks[blocks.length - 1].content === 'Working...' ||
                                                blocks[blocks.length - 1].content === 'Thinking...')
                                        ) {
                                            blocks.pop()
                                        }
                                        blocks.push({ type: 'thinking', content: event.content })
                                    }
                                    break
                                }
                                case 'ToolCallStart':
                                    blocks.push({
                                        type: 'command',
                                        toolCallId: event.toolCall.id,
                                        toolName: event.toolCall.name,
                                        toolInput: event.toolCall.input,
                                        command: getToolSummary(
                                            event.toolCall.name,
                                            event.toolCall.input
                                        ),
                                        status: 'running',
                                        output: '',
                                    })
                                    break
                                case 'ToolExecutionUpdate': {
                                    const runningCmd = blocks.find(
                                        (b) =>
                                            b.type === 'command' &&
                                            b.toolCallId === event.toolCallId
                                    ) as any
                                    if (runningCmd && runningCmd.status === 'running') {
                                        runningCmd.output += event.chunk
                                    }
                                    break
                                }
                                case 'ToolCallResult': {
                                    const lastCmd = blocks.find(
                                        (b) =>
                                            b.type === 'command' &&
                                            b.toolCallId === event.result.toolCallId
                                    ) as any
                                    if (lastCmd) {
                                        lastCmd.status = event.result.error ? 'error' : 'success'
                                        lastCmd.output = event.result.error || event.result.result
                                    }
                                    break
                                }
                                case 'AgentUsage': {
                                    return {
                                        ...msg,
                                        usage: {
                                            promptTokens: (event as any).promptTokens,
                                            completionTokens: (event as any).completionTokens,
                                        },
                                    }
                                }
                            }
                            return { ...msg, blocks }
                        })
                    )
                }
            } catch (err: any) {
                setActiveMessages((prev) => [
                    ...prev,
                    { id: ++msgId, role: 'error', text: err.message },
                ])
            } finally {
                setIsStreaming(false)
                setAuthMode('plan_approve')
            }
        },
        [agent, grillPrompt, grillQuestions, activeMessages]
    )

    const handleGrillSelect = useCallback(
        async (item: any) => {
            if (item.value === 'custom') {
                setCustomInputMode(true)
                return
            }

            const nextAnswers = [...grillAnswers, item.value]
            setGrillAnswers(nextAnswers)

            if (currentGrillIndex + 1 < grillQuestions.length) {
                setCurrentGrillIndex(currentGrillIndex + 1)
            } else {
                await generatePlanFromGrill(nextAnswers)
            }
        },
        [grillAnswers, currentGrillIndex, grillQuestions, generatePlanFromGrill]
    )

    const handleSubmit = useCallback(
        async (text: string) => {
            if (text.trim() === '/exit') {
                exit()
                process.exit(0)
                return
            }

            if (text.trim() === '/logout') {
                const config = await loadConfig()
                const items: { label: string; value: string }[] = []
                if (config.decemberToken) {
                    items.push({ label: 'December (Cloud Wallet)', value: 'decemberToken' })
                }
                if (config.providers) {
                    for (const provider of Object.keys(config.providers)) {
                        items.push({
                            label: `${provider.charAt(0).toUpperCase() + provider.slice(1)} (API Key)`,
                            value: `provider:${provider}`,
                        })
                    }
                }
                if (items.length === 0) {
                    setStaticMessages((prev) => [...prev, ...activeMessages])
                    setActiveMessages([
                        {
                            id: ++msgId,
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content:
                                        'No stored credentials to remove. /logout only removes credentials saved by /login; environment variables and models.json config are unchanged.',
                                },
                            ],
                        },
                    ])
                } else {
                    setLogoutItems(items)
                    setAuthMode('logout_select')
                }
                return
            }

            if (text.trim() === '/login') {
                setAuthMode('menu')
                return
            }

            if (text.trim() === '/hooks') {
                setAuthMode('hooks')
                return
            }

            if (text.trim() === '/hooks') {
                setAuthMode('hooks')
                return
            }

            if (text.trim() === '/context') {
                setAuthMode('context_select')
                return
            }

            if (text.trim() === '/model') {
                if (!isAuthenticated) {
                    setStaticMessages((prev) => [...prev, ...activeMessages])
                    setActiveMessages([
                        { id: ++msgId, role: 'user', text },
                        {
                            id: ++msgId,
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content: 'You must log in first to configure a model.',
                                },
                            ],
                        },
                    ])
                    return
                }
                loadConfig().then((config) => {
                    setSelectedProvider(config.activeProvider || '')
                    setAuthMode('model_select')
                })
                return
            }

            if (text.trim() === '/resume') {
                if (!sessionRepository) {
                    setStaticMessages((prev) => [...prev, ...activeMessages])
                    setActiveMessages([
                        { id: ++msgId, role: 'user', text },
                        {
                            id: ++msgId,
                            role: 'assistant',
                            blocks: [
                                { type: 'text', content: 'Session repository not available.' },
                            ],
                        },
                    ])
                    return
                }
                sessionRepository.listSessions().then((sessions) => {
                    if (sessions.length === 0) {
                        setStaticMessages((prev) => [...prev, ...activeMessages])
                        setActiveMessages([
                            { id: ++msgId, role: 'user', text },
                            {
                                id: ++msgId,
                                role: 'assistant',
                                blocks: [{ type: 'text', content: 'No previous sessions found.' }],
                            },
                        ])
                        return
                    }
                    setSessionsData(sessions)
                    setSessionPage(0)
                    setSessionSelectedIndex(0)
                    setSessionRenameMode(false)
                    setAuthMode('session_select')
                })
                return
            }

            // Intercept /plan commands anywhere in the text
            const planMatch = text.trim().match(/(.*?)(?:\s|^)\/plan(?:\s(.*))?$/s)
            if (planMatch) {
                const before = planMatch[1] || ''
                const after = planMatch[2] || ''
                const planPromptText = `${before} ${after}`.trim()

                if (planPromptText.length > 0) {
                    text = planPromptText
                    // Fallthrough to handleMessage but with isPlanningTurn = true (set below)
                } else {
                    setPlanMode((prev) => !prev)
                    setGrillMode(false)
                    return
                }
            }

            // Intercept /grill-me or /grill commands anywhere in the text
            const grillMatch = text.trim().match(/(.*?)(?:\s|^)\/(grill-me|grill)(?:\s(.*))?$/s)
            if (grillMatch) {
                const before = grillMatch[1] || ''
                const after = grillMatch[3] || ''
                const grillPromptText = `${before} ${after}`.trim()

                if (grillPromptText.length > 0) {
                    await generateGrillQuestions(grillPromptText)
                } else {
                    setGrillMode((prev) => !prev)
                    setPlanMode(false)
                }
                return
            }

            // Handle active modes (if the user previously toggled them on)
            if (grillMode) {
                setGrillMode(false)
                await generateGrillQuestions(text.trim())
                return
            }

            let isPlanningTurn = planMode || !!planMatch
            if (isPlanningTurn) {
                setPlanMode(false)
            }

            if (text.trim() === '/settings') {
                loadConfig().then((config) => {
                    setSettingsNonWorkspace(config.nonWorkspaceAccess ?? false)
                    setSettingsNotifications(config.notifications ?? false)
                    setSettingsShowTasks(config.showActiveTasks ?? true)
                    setSettingsShowTips(config.showTips ?? true)
                    setSettingsToolPermission(config.toolPermission ?? 'always-proceed')
                    setSettingsTelemetry(config.telemetry ?? true)
                    setSettingsAutoUpdate(config.autoUpdate ?? true)
                    setAuthMode('settings_main')
                })
                return
            }

            if (text.trim() === '/tasks') {
                setAuthMode('tasks_mode')
                return
            }

            if (text.trim() === '/usage') {
                setAuthMode('usage')
                return
            }

            if (!isAuthenticated) {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    { id: ++msgId, role: 'user', text },
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content:
                                    'You are not logged in. Please use `/login` to configure your API key or log in via December.',
                            },
                        ],
                    },
                ])
                return
            }

            // Normal chat logic
            if (isStreaming) {
                agent.steer({ role: 'user', content: text, isUI: true })
                setActiveMessages((prev) => [...prev, { id: ++msgId, role: 'user', text }])
                return
            }

            if (isPlanningTurn) {
                setCurrentPlannedPrompt(text)
            }

            setIsStreaming(true)
            const newUserMsg: Message = { id: ++msgId, role: 'user', text }
            setStaticMessages((prev) => [...prev, ...activeMessages, newUserMsg])
            setActiveMessages([{ id: ++msgId, role: 'assistant', blocks: [] }])

            const assistantMsgId = msgId

            const promptToSend = isPlanningTurn
                ? `You are currently in PLANNING MODE.
Please review the user's request: "${text}"
Create a detailed, step-by-step implementation plan to accomplish this request.
Do NOT execute any tools. Only describe the plan.
Start your response with '### Implementation Plan' and list the concrete steps.
Explain which files need to be created, modified, or deleted, and what the changes will be.`
                : text

            try {
                const stream = runAgentLoop(agent, promptToSend)

                for await (const event of stream) {
                    setActiveMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== assistantMsgId) return msg
                            const blocks = [...(msg.blocks || [])]
                            switch (event.type) {
                                case 'TurnStart':
                                    blocks.push({ type: 'text', content: 'Working...' })
                                    break
                                case 'AgentError': {
                                    const errMsg = parseErrorMessage({ message: event.error })
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (
                                        lastBlock &&
                                        lastBlock.type === 'text' &&
                                        (lastBlock.content === 'Working...' ||
                                            lastBlock.content === 'Thinking...' ||
                                            lastBlock.content.startsWith('Rate limit hit'))
                                    ) {
                                        lastBlock.content = `\n\n**Agent Error:** ${errMsg}\n`
                                    } else {
                                        blocks.push({
                                            type: 'text',
                                            content: `\n\n**Agent Error:** ${errMsg}\n`,
                                        })
                                    }
                                    break
                                }
                                case 'AgentStatus': {
                                    const statusBlock = blocks[blocks.length - 1]
                                    if (
                                        statusBlock &&
                                        statusBlock.type === 'text' &&
                                        (statusBlock.content === 'Working...' ||
                                            statusBlock.content === 'Thinking...' ||
                                            statusBlock.content.startsWith('Rate limit hit'))
                                    ) {
                                        statusBlock.content = event.message || 'Working...'
                                    } else if (event.message) {
                                        blocks.push({ type: 'text', content: event.message })
                                    }
                                    break
                                }
                                case 'StreamChunk':
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (lastBlock && lastBlock.type === 'text') {
                                        lastBlock.content =
                                            (lastBlock.content === 'Working...' ||
                                            lastBlock.content === 'Thinking...' ||
                                            lastBlock.content.startsWith('Rate limit hit')
                                                ? ''
                                                : lastBlock.content) + event.content
                                    } else {
                                        blocks.push({ type: 'text', content: event.content })
                                    }
                                    break
                                case 'ThinkingChunk': {
                                    const lastThinkBlock = blocks[blocks.length - 1]
                                    if (lastThinkBlock && lastThinkBlock.type === 'thinking') {
                                        lastThinkBlock.content += event.content
                                    } else {
                                        if (
                                            blocks.length > 0 &&
                                            blocks[blocks.length - 1].type === 'text' &&
                                            (blocks[blocks.length - 1].content === 'Working...' ||
                                                blocks[blocks.length - 1].content === 'Thinking...')
                                        ) {
                                            blocks.pop()
                                        }
                                        blocks.push({ type: 'thinking', content: event.content })
                                    }
                                    break
                                }
                                case 'ToolCallStart':
                                    blocks.push({
                                        type: 'command',
                                        toolCallId: event.toolCall.id,
                                        toolName: event.toolCall.name,
                                        toolInput: event.toolCall.input,
                                        command: getToolSummary(
                                            event.toolCall.name,
                                            event.toolCall.input
                                        ),
                                        status: 'running',
                                        output: '',
                                    })
                                    break
                                case 'ToolExecutionUpdate': {
                                    const runningCmd = blocks.find(
                                        (b) =>
                                            b.type === 'command' &&
                                            b.toolCallId === event.toolCallId
                                    ) as any
                                    if (runningCmd && runningCmd.status === 'running') {
                                        runningCmd.output += event.chunk
                                    }
                                    break
                                }
                                case 'ToolCallResult': {
                                    const lastCmd = blocks.find(
                                        (b) =>
                                            b.type === 'command' &&
                                            b.toolCallId === event.result.toolCallId
                                    ) as any
                                    if (lastCmd) {
                                        lastCmd.status = event.result.error ? 'error' : 'success'
                                        lastCmd.output = event.result.error || event.result.result
                                    }
                                    break
                                }
                                case 'AgentUsage': {
                                    return {
                                        ...msg,
                                        usage: {
                                            promptTokens: (event as any).promptTokens,
                                            completionTokens: (event as any).completionTokens,
                                        },
                                    }
                                }
                            }
                            return { ...msg, blocks }
                        })
                    )
                }
            } catch (err: any) {
                setActiveMessages((prev) => [
                    ...prev,
                    { id: ++msgId, role: 'error', text: err.message },
                ])
            } finally {
                setIsStreaming(false)
                if (isPlanningTurn) {
                    setAuthMode('plan_approve')
                }
            }
        },
        [
            exit,
            agent,
            activeMessages,
            isAuthenticated,
            isStreaming,
            grillQuestions,
            grillAnswers,
            customInputMode,
            generatePlanFromGrill,
            generateGrillQuestions,
            sessionRepository,
            toast,
            authMode,
            currentGrillIndex,
            grillMode,
            planMode,
        ]
    )

    const handleSettingsMainSelect = async (item: any) => {
        const config = await loadConfig()
        let updated = false

        switch (item.value) {
            case 'nonWorkspaceAccess':
                config.nonWorkspaceAccess = !settingsNonWorkspace
                setSettingsNonWorkspace(!settingsNonWorkspace)
                updated = true
                break
            case 'notifications':
                config.notifications = !settingsNotifications
                setSettingsNotifications(!settingsNotifications)
                updated = true
                break
            case 'showActiveTasks':
                config.showActiveTasks = !settingsShowTasks
                setSettingsShowTasks(!settingsShowTasks)
                updated = true
                break
            case 'showTips':
                config.showTips = !settingsShowTips
                setSettingsShowTips(!settingsShowTips)
                updated = true
                break
            case 'toolPermission':
                config.toolPermission =
                    settingsToolPermission === 'always-proceed' ? 'always-ask' : 'always-proceed'
                setSettingsToolPermission(config.toolPermission)
                updated = true
                break
            case 'telemetry':
                config.telemetry = !settingsTelemetry
                setSettingsTelemetry(!settingsTelemetry)
                updated = true
                break
            case 'autoUpdate':
                config.autoUpdate = !settingsAutoUpdate
                setSettingsAutoUpdate(!settingsAutoUpdate)
                updated = true
                break
            case 'back':
                setAuthMode('none')
                break
        }

        if (updated) {
            await saveConfig(config)
        }
    }

    const handleSettingsAgentSelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
        if (item.value.startsWith('model:')) {
            const model = item.value.split(':')[1]
            setSettingsDefaultModel(model)
            toast.show({ variant: 'success', message: MESSAGES.CONFIG.MODEL_UPDATED(model) })
        } else if (item.value.startsWith('tokens:')) {
            const tokens = parseInt(item.value.split(':')[1], 10)
            setSettingsMaxTokens(tokens)
            toast.show({ variant: 'success', message: MESSAGES.CONFIG.MAX_TOKENS_SET(tokens) })
        }
    }

    const handleSettingsUISelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
        if (item.value === 'sound') {
            setSettingsSoundEnabled((prev) => {
                const next = !prev
                toast.show({ message: `Notification sounds ${next ? 'enabled' : 'disabled'}` })
                return next
            })
        } else if (item.value === 'density') {
            setSettingsDensity((prev) => {
                const next = prev === 'compact' ? 'spacious' : 'compact'
                toast.show({ message: `Layout density set to ${next}` })
                return next
            })
        }
    }

    const handleSettingsKeysSelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
        if (item.value === 'gemini') {
            setSettingsGeminiKey((prev) =>
                prev === 'configured' ? 'not-configured' : 'configured'
            )
            toast.show({ message: 'Gemini API key toggled' })
        } else if (item.value === 'openrouter') {
            setSettingsOpenrouterKey((prev) =>
                prev === 'configured' ? 'not-configured' : 'configured'
            )
            toast.show({ message: 'OpenRouter API key toggled' })
        }
    }

    const handleAuthMenuSelect = async (item: any) => {
        if (item.value === 'december') {
            setAuthMode('december_login_select')
        } else if (item.value === 'december_browser') {
            setAuthMode('none')
            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: `Opening browser to log in...`,
                        },
                    ],
                },
            ])

            try {
                if (!onLogin) {
                    throw new Error('Login functionality is not provided by the host environment.')
                }
                const { token, email } = await onLogin()
                const config = await loadConfig()
                config.decemberToken = token
                if (email) {
                    config.email = email
                    setCurrentEmail(email)
                }
                await saveConfig(config)

                const providerConfig = await getProviderConfig()
                if (providerConfig) {
                    const provider = new OpenRouterProvider(providerConfig.apiKey)
                    agent.setLLM(provider)
                    setIsAuthenticated(true)
                }

                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: MESSAGES.AUTH.LOGIN_SUCCESS_DECEMBER,
                            },
                        ],
                    },
                ])
            } catch (err: any) {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'error',
                        text: `Login failed: ${err.message}`,
                    },
                ])
            } finally {
                setIsStreaming(false)
            }
        } else if (item.value === 'december_headless') {
            setAuthMode('none')
            setIsStreaming(true)

            try {
                if (!onLoginHeadless) {
                    throw new Error(
                        'Headless login functionality is not provided by the host environment.'
                    )
                }

                // Keep track of the message ID so we can update it with the code
                const codeMsgId = ++msgId
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: codeMsgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: `Generating device code...`,
                            },
                        ],
                    },
                ])

                const onCode = (code: string, uri: string) => {
                    setActiveMessages([
                        {
                            id: codeMsgId,
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content: `Please open [${uri}](${uri}) on any device and enter code: \`${code}\``,
                                },
                                {
                                    type: 'thinking',
                                    content: 'Waiting for authorization...',
                                },
                            ],
                        },
                    ])
                }

                const { token, email } = await onLoginHeadless(onCode)

                const config = await loadConfig()
                config.decemberToken = token
                if (email) {
                    config.email = email
                    setCurrentEmail(email)
                }
                await saveConfig(config)

                const providerConfig = await getProviderConfig()
                if (providerConfig) {
                    const provider = new OpenRouterProvider(providerConfig.apiKey)
                    agent.setLLM(provider)
                    setIsAuthenticated(true)
                }

                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE,
                            },
                        ],
                    },
                ])
            } catch (err: any) {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'error',
                        text: `Login failed: ${err.message}`,
                    },
                ])
            } finally {
                setIsStreaming(false)
            }
        } else if (item.value === 'byok') {
            setAuthMode('byok_provider')
        }
    }

    const handleModelSelect = async (item: any) => {
        if (item.value === 'loading') return
        const config = await loadConfig()
        config.activeModel = item.value
        await saveConfig(config)
        agent.modelOptions = { model: item.value }
        setAuthMode('none')

        setStaticMessages((prev) => [...prev, ...activeMessages])
        setActiveMessages([
            {
                id: ++msgId,
                role: 'assistant',
                blocks: [{ type: 'text', content: `Model successfully changed to ${item.value}!` }],
            },
        ])
    }

    const handleSessionSelect = async (item: any) => {
        setAuthMode('none')
        try {
            await agent.loadContext(item.value)

            // Rebuild UI messages from loaded context
            const resumedMessages: Message[] = []
            for (const msg of agent.messages) {
                if (msg.role === 'user') {
                    resumedMessages.push({ id: ++msgId, role: 'user', text: msg.content })
                } else if (msg.role === 'assistant') {
                    const blocks: MessageBlock[] = []

                    if (msg.content) {
                        blocks.push({ type: 'text', content: msg.content })
                    }

                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        for (const tc of msg.toolCalls) {
                            const toolMsg = agent.messages.find(
                                (m) => m.role === 'tool' && m.toolCallId === tc.id
                            )
                            const inputStr =
                                typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)
                            const hasError =
                                toolMsg &&
                                (toolMsg.content.startsWith('Error executing tool:') ||
                                    toolMsg.content.startsWith('Tool execution blocked:') ||
                                    (toolMsg.content.startsWith('Tool ') &&
                                        toolMsg.content.endsWith(' not found.')))
                            blocks.push({
                                type: 'command',
                                toolCallId: tc.id,
                                toolName: tc.name,
                                toolInput: inputStr,
                                command: getToolSummary(tc.name, inputStr),
                                status: hasError ? 'error' : 'success',
                                output: toolMsg?.content || '',
                            })
                        }
                    }

                    if (blocks.length > 0) {
                        resumedMessages.push({
                            id: ++msgId,
                            role: 'assistant',
                            blocks,
                        })
                    }
                }
            }

            setStaticMessages(resumedMessages)
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'assistant',
                    blocks: [{ type: 'text', content: `Resumed session: ${item.value}` }],
                },
            ])
        } catch (err: any) {
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                { id: ++msgId, role: 'error', text: `Failed to resume session: ${err.message}` },
            ])
        }
    }

    const handlePlanApprovalSelect = useCallback(
        async (item: any) => {
            setAuthMode('none')
            const originalPrompt = currentPlannedPrompt
            setCurrentPlannedPrompt(null)

            if (item.value === 'approve') {
                if (originalPrompt) {
                    await handleSubmit(originalPrompt)
                }
            } else {
                toast.show({ variant: 'error', message: 'Plan rejected.' })
                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [{ type: 'text', content: '*Plan rejected by user.*' }],
                    },
                ])
            }
        },
        [currentPlannedPrompt, handleSubmit, toast]
    )

    const handleProviderSelect = (item: any) => {
        setSelectedProvider(item.value)
        setAuthMode('byok_key')
    }

    const handleKeySubmit = async (key: string) => {
        if (isStreaming) return
        setIsStreaming(true) // Prevent multi-submit

        let testProvider: any
        let testModel: string | undefined

        try {
            switch (selectedProvider) {
                case 'anthropic':
                    testProvider = new AnthropicProvider(key)
                    testModel = 'claude-3-5-sonnet-latest'
                    break
                case 'google':
                    testProvider = new GeminiProvider(key)
                    testModel = 'gemini-3.5-flash'
                    break
                case 'openai':
                    testProvider = new OpenAIProvider(undefined, key)
                    testModel = 'gpt-4o'
                    break
                case 'openrouter':
                    testProvider = new OpenRouterProvider(key)
                    testModel = 'meta-llama/llama-3.2-3b-instruct:free'
                    break
                case 'deepseek':
                    testProvider = new OpenAIProvider('https://api.deepseek.com', key)
                    testModel = 'deepseek-chat'
                    break
                case 'groq':
                    testProvider = new OpenAIProvider('https://api.groq.com/openai/v1', key)
                    testModel = 'llama3-8b-8192'
                    break
                case 'huggingface':
                    testProvider = new OpenAIProvider(
                        'https://api-inference.huggingface.co/v1',
                        key
                    )
                    testModel = 'meta-llama/Meta-Llama-3-8B-Instruct'
                    break
                case 'kimi':
                case 'moonshoot':
                    testProvider = new OpenAIProvider('https://api.moonshot.cn/v1', key)
                    testModel = 'moonshot-v1-8k'
                    break
                case 'mistral':
                    testProvider = new OpenAIProvider('https://api.mistral.ai/v1', key)
                    testModel = 'mistral-large-latest'
                    break
                case 'xai':
                    testProvider = new OpenAIProvider('https://api.x.ai/v1', key)
                    testModel = 'grok-beta'
                    break
                case 'zai':
                    testProvider = new OpenAIProvider('https://api.zai.ai/v1', key)
                    testModel = 'zai-v1'
                    break
                default:
                    testProvider = new OpenAIProvider(undefined, key)
                    testModel = 'gpt-4o'
            }

            // Dummy request to validate key
            const stream = testProvider.stream([{ role: 'user', content: 'Hi' }], [], undefined, {
                model: testModel,
            })
            await stream.next()

            const config = await loadConfig()
            config.providers[selectedProvider] = key
            config.activeProvider = selectedProvider
            config.activeModel = testModel
            await saveConfig(config)

            agent.setLLM(testProvider)
            agent.modelOptions = { model: testModel }
            setIsAuthenticated(true)
            setAuthMode('none')
            setApiKey('')

            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'status',
                            success: true,
                            label: MESSAGES.AUTH.API_KEY_SAVED(selectedProvider),
                        },
                    ],
                },
            ])
        } catch (err: any) {
            const errStr = (err?.message || JSON.stringify(err) || String(err)).toLowerCase()
            if (
                errStr.includes('429') ||
                errStr.includes('quota') ||
                errStr.includes('rate limit') ||
                errStr.includes('404') ||
                errStr.includes('not found')
            ) {
                // Key is valid, but rate limited or model not found. Save it anyway!
                const config = await loadConfig()
                config.providers[selectedProvider] = key
                config.activeProvider = selectedProvider
                config.activeModel = testModel
                await saveConfig(config)

                agent.setLLM(testProvider)
                agent.modelOptions = { model: testModel }
                setIsAuthenticated(true)
                setAuthMode('none')
                setApiKey('')

                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'status',
                                success: true,
                                label: `API Key saved for ${selectedProvider}`,
                            },
                        ],
                    },
                ])
            } else {
                setStaticMessages((prev) => [...prev, ...activeMessages])

                let cleanMessage = err?.message || String(err)
                try {
                    const parsed = JSON.parse(cleanMessage)
                    if (parsed.error?.message) {
                        cleanMessage = parsed.error.message
                        try {
                            const doubleParsed = JSON.parse(cleanMessage)
                            if (doubleParsed.error?.message) {
                                cleanMessage = doubleParsed.error.message
                            }
                        } catch {}
                    } else if (parsed.message) {
                        cleanMessage = parsed.message
                    }
                } catch {}

                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'status',
                                success: false,
                                label: `Invalid API Key for ${selectedProvider}`,
                            },
                            {
                                type: 'text',
                                content: cleanMessage,
                            },
                        ],
                    },
                ])
                setApiKey('')
            }
        } finally {
            setIsStreaming(false)
        }
    }

    const handleContextSelect = () => {}

    const handleLogoutSelect = async (value: string) => {
        const config = await loadConfig()
        let removedName = ''
        if (value === 'decemberToken') {
            config.decemberToken = undefined
            config.email = undefined
            setCurrentEmail(undefined)
            removedName = 'December Cloud Wallet'
        } else if (value.startsWith('provider:')) {
            const provider = value.split(':')[1]
            if (provider && config.providers) {
                delete config.providers[provider]
                removedName = `${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`
                if (config.activeProvider === provider) {
                    config.activeProvider = undefined
                }
            }
        }
        await saveConfig(config)
        setAuthMode('none')

        const providerConfig = await getProviderConfig()
        setIsAuthenticated(!!providerConfig)

        setStaticMessages((prev) => [...prev, ...activeMessages])
        setActiveMessages([
            {
                id: ++msgId,
                role: 'assistant',
                blocks: [{ type: 'text', content: `Removed credentials for: ${removedName}` }],
            },
        ])
    }

    return {
        toast,
        currentPlannedPrompt,
        setCurrentPlannedPrompt,
        grillMode,
        setGrillMode,
        planMode,
        setPlanMode,
        tasksData,
        setTasksData,
        taskSelectedIndex,
        setTaskSelectedIndex,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
        grillQuestions,
        setGrillQuestions,
        currentGrillIndex,
        setCurrentGrillIndex,
        grillAnswers,
        setGrillAnswers,
        grillPrompt,
        setGrillPrompt,
        customInputMode,
        setCustomInputMode,
        customAnswer,
        setCustomAnswer,
        staticMessages,
        setStaticMessages,
        staticKey,
        setStaticKey,
        activeMessages,
        setActiveMessages,
        isStreaming,
        setIsStreaming,
        isAuthenticated,
        setIsAuthenticated,
        currentEmail,
        setCurrentEmail,
        authMode,
        setAuthMode,
        selectedHookType,
        setSelectedHookType,
        hookMatchers,
        setHookMatchers,
        addingMatcher,
        setAddingMatcher,
        newMatcherRegex,
        setNewMatcherRegex,
        matcherIndex,
        setMatcherIndex,
        logoutItems,
        setLogoutItems,
        selectedProvider,
        setSelectedProvider,
        apiKey,
        setApiKey,
        openRouterModels,
        setOpenRouterModels,
        sessionItems,
        setSessionItems,
        sessionsData,
        setSessionsData,
        sessionPage,
        setSessionPage,
        sessionSelectedIndex,
        setSessionSelectedIndex,
        sessionRenameMode,
        setSessionRenameMode,
        sessionNewName,
        setSessionNewName,
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsNotifications,
        setSettingsNotifications,
        settingsShowTasks,
        setSettingsShowTasks,
        settingsShowTips,
        setSettingsShowTips,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsTelemetry,
        setSettingsTelemetry,
        settingsAutoUpdate,
        setSettingsAutoUpdate,
        handleSubmit,
        sessionRepository,
        handleSettingsMainSelect,
        handleSettingsAgentSelect,
        handleSettingsUISelect,
        handleSettingsKeysSelect,
        handleAuthMenuSelect,
        handleModelSelect,
        handleSessionSelect,
        handlePlanApprovalSelect,
        handleProviderSelect,
        handleKeySubmit,
        handleLogoutSelect,
        handleGrillSelect,
        pendingQuestions,
        setPendingQuestions,
    }
}
