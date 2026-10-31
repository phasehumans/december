import { Agent, runAgentLoop } from '@december/agent'
import {
    getCleanProviderDisplayName,
    PROVIDER_BILLING_LINKS,
    SkillDiscoveryEngine,
} from '@december/shared'
import { type Message, type CodeSearchResultItem, openPlanInPager } from '@december/tui'
import { useEffect, useCallback, useState, useRef } from 'react'

import {
    loadConfig,
    saveConfig,
    resolveSwitchTarget,
    applyProviderSwitch,
    getConfiguredProviders,
    formatProviderName,
} from '../config'
import { AUTH_REQUIRED_NOTICE } from '../constants/messages'
import {
    getAskPrompt,
    getPlanPrompt,
    getPlanExecutionPrompt,
    getPlanRefinePrompt,
} from '../constants/prompts'
import { useCliStore } from '../store'
import { setupAgentInterceptors } from '../store/interceptors'
import { taskManager } from '../task-manager'
import { startDirectCommand } from '../utils/direct-shell'
import { parseError } from '../utils/error-parser'
import { getProviderModels } from '../utils/models'
import { fetchOpenRouterModels } from '../utils/openrouter-models'
import { fetchProviderBalance } from '../utils/provider-balance'
import { instantiateProvider } from '../utils/provider-factory'
import { getWeeklyUsageSummary, loadUsageLedger } from '../utils/usage-tracker'

import {
    getNextMsgId,
    processAgentStream,
    convertAgentMessagesToTuiMessages,
} from './use-agent-runner'
import { useAuthHandlers } from './use-auth-handlers'
import { useSettingsHandlers } from './use-settings-handlers'

// formatters and msgid extracted

export function useAgentSession({
    agent,
    isAuthenticated: initialAuth,
    authMethod: initialAuthMethod,
    hasBothAuth: initialHasBothAuth,
    hasDecember: initialHasDecember,
    decemberEmail: initialDecemberEmail,
    settingsAuthPriority: initialSettingsAuthPriority,
    cliVersion,
    userEmail,
    sessionRepository,
    onLogin,
    onLoginHeadless,
}: {
    agent: Agent
    isAuthenticated: boolean
    authMethod?: 'byok' | 'december' | 'env' | 'subscription'
    hasBothAuth?: boolean
    hasDecember?: boolean
    decemberEmail?: string
    settingsAuthPriority?: 'byok' | 'december' | 'subscription'
    cliVersion?: string
    userEmail?: string
    sessionRepository?: any
    onLogin?: (
        onCode: (code: string, uri: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
}) {
    const state = useCliStore()
    const {
        isAuthenticated,
        setIsAuthenticated,
        authMethod,
        setAuthMethod,
        hasBothAuth,
        setHasBothAuth,
        hasDecember,
        setHasDecember,
        decemberEmail,
        setDecemberEmail,
        settingsAuthPriority,
        setSettingsAuthPriority,
        currentEmail,
        setCurrentEmail,
        authMode,
        previousAuthMode,
        setAuthMode,
        helpInitialTab,
        setHelpInitialTab,
        memoryInitialTab,
        setMemoryInitialTab,
        logoutItems,
        setLogoutItems,
        switchItems,
        setSwitchItems,
        selectedProvider,
        setSelectedProvider,
        activeModel,
        setActiveModel,
        apiKey,
        setApiKey,
        authError,
        setAuthError,
        openRouterModels,
        setOpenRouterModels,
        planWorkflow,
        setPlanWorkflow,
        interactivePlanGoalMode,
        setInteractivePlanGoalMode,
        currentPlannedPrompt,
        setCurrentPlannedPrompt,
        currentPlanText,
        setCurrentPlanText,
        currentPlanQAPairs,
        setCurrentPlanQAPairs,
        planRefineMode,
        setPlanRefineMode,
        planRefineFeedback,
        setPlanRefineFeedback,
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
        queuedPrompts,
        setQueuedPrompts,
        pendingQuestions,
        setPendingQuestions,
        pendingToolCall,
        setPendingToolCall,
        toasts,
        addToast,
        setShouldExit,
        tasksData,
        setTasksData,
        taskSelectedIndex,
        setTaskSelectedIndex,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
        sessionRenameMode,
        setSessionRenameMode,
        sessionNewName,
        setSessionNewName,
        sessionItems,
        setSessionItems,
        sessionsData,
        setSessionsData,
        sessionPage,
        setSessionPage,
        sessionSelectedIndex,
        setSessionSelectedIndex,

        settingsPathGuard,
        setSettingsPathGuard,
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsCompactMode,
        setSettingsCompactMode,
        settingsSoundEffects,
        setSettingsSoundEffects,
        settingsAutoScroll,
        setSettingsAutoScroll,
        settingsStreamSpeed,
        setSettingsStreamSpeed,
        settingsSelectedIndex,
        setSettingsSelectedIndex,
        settingsThinkingLevel,
        setSettingsThinkingLevel,
        settingsSteeringMode,
        setSettingsSteeringMode,
        settingsFollowUpMode,
        setSettingsFollowUpMode,
        settingsBrowserVisible,
        setSettingsBrowserVisible,
        btwState,
        setBtwState,
        rewindItems,
        setRewindItems,
        codeSearchQuery,
        setCodeSearchQuery,
        codeSearchResults,
        setCodeSearchResults,
        prefillPrompt,
        setPrefillPrompt,
        fileViewTarget,
        setFileViewTarget,
    } = state

    const [expandCommands, setExpandCommands] = useState(false)
    const toggleExpandCommands = useCallback(() => {
        setExpandCommands((prev) => !prev)
    }, [])

    const [detectedSubscriptions, setDetectedSubscriptions] = useState<Record<string, any>>({})
    const [configuredProviders, setConfiguredProviders] = useState<Record<string, string>>({})
    const [configuredSubscriptions, setConfiguredSubscriptions] = useState<Record<string, any>>({})
    const [unlinkedSubscriptions, setUnlinkedSubscriptions] = useState<string[]>([])
    const [usageData, setUsageData] = useState<any>(null)

    useEffect(() => {
        import('../auth/subscriptions/subscription-manager')
            .then(({ detectAllSubscriptions }) => detectAllSubscriptions())
            .then((detected) => {
                if (detected) setDetectedSubscriptions(detected)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        loadConfig()
            .then((c) => {
                setConfiguredProviders(c.providers || {})
                setConfiguredSubscriptions(c.subscriptions || {})
                setUnlinkedSubscriptions(c.unlinkedSubscriptions || [])
            })
            .catch(() => {
                // Intentionally swallowed: config load failure
            })
    }, [authMode])

    useEffect(() => {
        useCliStore.setState((prev) => ({
            ...prev,
            isAuthenticated: initialAuth,
            authMethod: initialAuthMethod,
            hasBothAuth: initialHasBothAuth !== undefined ? initialHasBothAuth : prev.hasBothAuth,
            hasDecember: initialHasDecember !== undefined ? initialHasDecember : prev.hasDecember,
            decemberEmail:
                initialDecemberEmail !== undefined ? initialDecemberEmail : prev.decemberEmail,
            settingsAuthPriority:
                initialSettingsAuthPriority !== undefined
                    ? initialSettingsAuthPriority
                    : prev.settingsAuthPriority,
            currentEmail: userEmail !== undefined ? userEmail : prev.currentEmail,
        }))
    }, [
        initialAuth,
        initialAuthMethod,
        initialHasBothAuth,
        initialHasDecember,
        initialDecemberEmail,
        initialSettingsAuthPriority,
        userEmail,
    ])

    useEffect(() => {
        if (agent) {
            setupAgentInterceptors(agent, {
                setAuthMode,
                setPendingQuestions,
                setPendingToolCall,
            })
        }
    }, [agent, setAuthMode, setPendingQuestions, setPendingToolCall])

    useEffect(() => {
        if (!agent) return
        const hydrateInitialSession = async () => {
            try {
                await agent.loadContext()
            } catch {
                // Intentionally swallowed: ignore initial context loading errors
            }
            const nonSystem = (agent.messages || []).filter((m: any) => m.role !== 'system')
            if (nonSystem.length > 0) {
                const currentStatic = useCliStore.getState().staticMessages
                if (currentStatic.length > 1) {
                    return
                }
                const resumed = convertAgentMessagesToTuiMessages(agent.messages)
                if (resumed.length > 0) {
                    setStaticMessages([{ id: 'header', role: 'header' }, ...resumed])
                    setStaticKey((k: number) => k + 1)
                }
            }
        }
        hydrateInitialSession()
    }, [agent, setStaticMessages, setStaticKey])

    const activeShellAbortRef = useRef<(() => void) | null>(null)
    const btwAbortRef = useRef<AbortController | null>(null)

    // hooks state

    useEffect(() => {
        const update = () => {
            setTasksData([...taskManager.getTasks()])
        }
        if (authMode === 'tasks_mode') {
            update()
            taskManager.on('change', update)
            const interval = setInterval(update, 1000)
            return () => {
                taskManager.off('change', update)
                clearInterval(interval)
            }
        }

        update()
        taskManager.on('task:added', update)
        taskManager.on('task:completed', update)
        taskManager.on('task:killed', update)
        return () => {
            taskManager.off('task:added', update)
            taskManager.off('task:completed', update)
            taskManager.off('task:killed', update)
        }
    }, [authMode, setTasksData])

    useEffect(() => {
        const handleCompleted = (task: any) => {
            if (authMode !== 'tasks_mode') {
                const cleanCmd = (task.command || '').replace(/\r?\n+/g, ' ').trim()
                const preview = cleanCmd.length > 30 ? cleanCmd.slice(0, 27) + '...' : cleanCmd
                if (task.status === 'completed') {
                    addToast(`Task [${task.id}] completed: ${preview}`, 'success')
                } else if (task.status === 'failed') {
                    addToast(
                        `Task [${task.id}] failed (exit ${task.exitCode ?? 1}): ${preview}`,
                        'error'
                    )
                }
            }
        }
        taskManager.on('task:completed', handleCompleted)
        return () => {
            taskManager.off('task:completed', handleCompleted)
        }
    }, [authMode, addToast])

    useEffect(() => {
        if (selectedProvider === 'openrouter' || authMode === 'model_select') {
            loadConfig().then((config) => {
                if (config.activeProvider === 'openrouter' || selectedProvider === 'openrouter') {
                    const apiKey = config.providers?.openrouter
                    fetchOpenRouterModels(apiKey).then((models) => {
                        setOpenRouterModels(models)
                    })
                }
            })
        }
    }, [authMode, selectedProvider, setOpenRouterModels])

    useEffect(() => {
        loadConfig()
            .then(async () => {
                const { getProviderConfig } = await import('../config')
                const providerConfig = await getProviderConfig()
                if (providerConfig?.provider && providerConfig?.apiKey) {
                    const { fetchLiveProviderModels } = await import('../utils/models')
                    fetchLiveProviderModels(
                        providerConfig.provider,
                        providerConfig.apiKey,
                        providerConfig.baseURL
                    ).catch(() => {
                        // Intentionally swallowed: background live model fetch failure
                    })
                }
            })
            .catch(() => {
                // Intentionally swallowed: config load failure
            })
    }, [])

    const handleKillTask = useCallback(
        (taskId: string) => {
            taskManager.killTask(taskId)
            setTasksData([...taskManager.getTasks()])
        },
        [setTasksData]
    )

    const handleClearCompletedTasks = useCallback(() => {
        taskManager.clearCompleted()
        setTasksData([...taskManager.getTasks()])
    }, [setTasksData])

    const handleRemoveTask = useCallback(
        (taskId: string) => {
            taskManager.removeTask(taskId)
            setTasksData([...taskManager.getTasks()])
        },
        [setTasksData]
    )

    const handleKillAllTasks = useCallback(() => {
        const count = taskManager.killAll()
        setTasksData([...taskManager.getTasks()])
        if (count > 0) {
            addToast(`Killed ${count} background task${count === 1 ? '' : 's'}.`, 'info')
        }
    }, [setTasksData, addToast])

    const generatePlanRefinement = useCallback(
        async (feedback: string) => {
            const originalPrompt =
                currentPlannedPrompt || useCliStore.getState().currentPlannedPrompt || ''
            const previousPlan = currentPlanText || useCliStore.getState().currentPlanText || ''
            const qaPairs = currentPlanQAPairs || useCliStore.getState().currentPlanQAPairs || []

            if (!originalPrompt || !previousPlan) return

            const refinePrompt = getPlanRefinePrompt(
                originalPrompt,
                previousPlan,
                feedback,
                qaPairs
            )

            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
            const assistantMsgId = getNextMsgId()
            setActiveMessages([
                {
                    id: getNextMsgId(),
                    role: 'user',
                    text: `Refine plan: "${feedback}"`,
                },
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    blocks: [{ type: 'text', content: 'Thinking...' }],
                },
            ])
            let planSuccess = false
            const errorContext = {
                provider: agent?.modelOptions?.provider || useCliStore.getState().selectedProvider,
                model: agent?.modelOptions?.model || useCliStore.getState().activeModel,
            }
            try {
                const stream = runAgentLoop(agent, refinePrompt)
                await processAgentStream({
                    stream,
                    setActiveMessages,
                    assistantMsgId,
                    context: errorContext,
                })
                planSuccess = true
            } catch (err: any) {
                const parsed = parseError(err, errorContext)
                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: getNextMsgId(),
                        role: 'error',
                        text: parsed.message,
                        cause: parsed.cause,
                        hint: parsed.hint,
                    },
                ])
            } finally {
                setIsStreaming(false)
                const assistantMsg = useCliStore
                    .getState()
                    .activeMessages.find((m) => m.id === assistantMsgId)
                const textContent =
                    assistantMsg?.blocks
                        ?.filter((b: any) => b.type === 'text')
                        .map((b: any) => b.content)
                        .join('') ||
                    assistantMsg?.text ||
                    ''
                if (textContent) {
                    setCurrentPlanText(textContent)
                }

                setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                setActiveMessages([])
                if (planSuccess) {
                    setPlanWorkflow({
                        phase: 'reviewing',
                        prompt: originalPrompt,
                        planText: textContent,
                        qaPairs,
                    })
                    setAuthMode('none')
                } else {
                    setPlanWorkflow({ phase: 'idle' })
                    setAuthMode('none')
                }
            }
        },
        [
            agent,
            currentPlannedPrompt,
            currentPlanText,
            currentPlanQAPairs,
            setActiveMessages,
            setAuthMode,
            setCurrentPlanText,
            setIsStreaming,
            setPlanWorkflow,
            setStaticMessages,
        ]
    )

    const generatePlanFromGoal = useCallback(
        async (goal: string) => {
            const trimmedGoal = goal.trim()
            if (!trimmedGoal) return

            if (!isAuthenticated) {
                const userMsg: Message = {
                    id: getNextMsgId(),
                    role: 'user',
                    text: `/plan ${trimmedGoal}`,
                }
                const noticeMsg: Message = {
                    id: getNextMsgId(),
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: AUTH_REQUIRED_NOTICE,
                        },
                    ],
                }
                setStaticMessages((prev) => [
                    ...prev,
                    ...useCliStore.getState().activeMessages,
                    userMsg,
                    noticeMsg,
                ])
                setActiveMessages([])
                return
            }

            setCurrentPlannedPrompt(trimmedGoal)
            setCurrentPlanQAPairs([])
            const planPrompt = getPlanPrompt(trimmedGoal, [])

            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
            const assistantMsgId = getNextMsgId()
            setActiveMessages([
                {
                    id: getNextMsgId(),
                    role: 'user',
                    text: `/plan ${trimmedGoal}`,
                },
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    blocks: [{ type: 'text', content: 'Thinking...' }],
                },
            ])
            let planSuccess = false
            const errorContext = {
                provider: agent?.modelOptions?.provider || useCliStore.getState().selectedProvider,
                model: agent?.modelOptions?.model || useCliStore.getState().activeModel,
            }
            try {
                const stream = runAgentLoop(agent, planPrompt)
                await processAgentStream({
                    stream,
                    setActiveMessages,
                    assistantMsgId,
                    context: errorContext,
                })
                planSuccess = true
            } catch (err: any) {
                const parsed = parseError(err, errorContext)
                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: getNextMsgId(),
                        role: 'error',
                        text: parsed.message,
                        cause: parsed.cause,
                        hint: parsed.hint,
                    },
                ])
            } finally {
                setIsStreaming(false)
                const assistantMsg = useCliStore
                    .getState()
                    .activeMessages.find((m) => m.id === assistantMsgId)
                const textContent =
                    assistantMsg?.blocks
                        ?.filter((b: any) => b.type === 'text')
                        .map((b: any) => b.content)
                        .join('') ||
                    assistantMsg?.text ||
                    ''
                if (textContent) {
                    setCurrentPlanText(textContent)
                }

                setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                setActiveMessages([])
                if (planSuccess) {
                    setPlanWorkflow({
                        phase: 'reviewing',
                        prompt: trimmedGoal,
                        planText: textContent,
                        qaPairs: [],
                    })
                    setAuthMode('none')
                } else {
                    setPlanWorkflow({ phase: 'idle' })
                    setAuthMode('none')
                }
            }
        },
        [
            agent,
            isAuthenticated,
            setActiveMessages,
            setAuthMode,
            setCurrentPlanText,
            setCurrentPlanQAPairs,
            setCurrentPlannedPrompt,
            setIsStreaming,
            setPlanWorkflow,
            setStaticMessages,
        ]
    )

    const fetchUsageData = useCallback(async () => {
        const currentModel = agent?.modelOptions?.model || 'gemini-3.6-flash'
        const rawProvider = selectedProvider || (agent?.llm as any)?.id || ''
        const provider = rawProvider || (authMethod === 'december' ? 'december' : undefined)

        // 1. Calculate session usage from current messages
        const allMsgs = [
            ...useCliStore.getState().staticMessages,
            ...useCliStore.getState().activeMessages,
        ]
        let sessionInputTokens = 0
        let sessionOutputTokens = 0
        let sessionCacheTokens = 0
        let sessionRequests = 0

        for (const msg of allMsgs) {
            if (msg.usage) {
                sessionInputTokens += msg.usage.promptTokens || 0
                sessionOutputTokens += msg.usage.completionTokens || 0
                sessionCacheTokens += (msg.usage as any).cacheReadInputTokens || 0
                sessionRequests++
            }
        }

        // 2. Fetch rolling weekly summary from local ledger
        let weeklyStats: any
        try {
            weeklyStats = await getWeeklyUsageSummary()
        } catch {
            // Intentionally swallowed: local usage summary fetch fallback
        }

        // 3. Load daily ledger for past 7 days
        const now = new Date()
        const dailyUsage: any[] = []
        try {
            const ledger = await loadUsageLedger()
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
                const dateKey = d.toISOString().slice(0, 10)
                const day = ledger.days[dateKey]
                const tokens = (day?.inputTokens || 0) + (day?.outputTokens || 0)
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
                const formattedDate = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                })
                dailyUsage.push({
                    date: dateKey,
                    dayName,
                    formattedDate,
                    tokens,
                    isToday: i === 0,
                })
            }
        } catch {
            // Intentionally swallowed: daily ledger load fallback
        }

        // 4. Fetch provider balance if supported / applicable
        let balanceInfo: any
        const config = await loadConfig()
        if (authMethod === 'december' && config.decemberToken) {
            try {
                const serverUrl = process.env.SERVER_URL || 'https://api.trydecember.com'
                const overviewRes = await fetch(`${serverUrl}/api/v1/billing/overview`, {
                    headers: { Authorization: `Bearer ${config.decemberToken}` },
                    signal: AbortSignal.timeout(2000),
                })
                if (overviewRes.ok) {
                    const overviewJson = (await overviewRes.json()) as any
                    const balanceCents = overviewJson.data?.creditBalance ?? 0
                    balanceInfo = {
                        supported: true,
                        balance: `$${(balanceCents / 100).toFixed(2)}`,
                        currency: 'USD',
                    }
                }
            } catch {
                // Intentionally swallowed: network error fetching december wallet balance
            }
        } else if (authMethod === 'byok' || !authMethod) {
            const activeKey =
                apiKey ||
                config.providers?.[provider || ''] ||
                (provider ? process.env[`${provider.toUpperCase()}_API_KEY`] : undefined)
            if (activeKey) {
                try {
                    balanceInfo = await fetchProviderBalance(provider, activeKey, 2000)
                } catch {
                    // Intentionally swallowed: live balance fetch failure
                }
            }
        }

        const providerKey = (provider || 'google').toLowerCase()
        const data = {
            model: currentModel,
            provider: providerKey,
            providerDisplayName: getCleanProviderDisplayName(providerKey, currentModel),
            billingUrl: PROVIDER_BILLING_LINKS[providerKey],
            balance: balanceInfo,
            sessionStats: {
                requests: sessionRequests,
                inputTokens: sessionInputTokens,
                outputTokens: sessionOutputTokens,
                cacheReadTokens: sessionCacheTokens,
                totalTokens: sessionInputTokens + sessionOutputTokens,
            },
            weeklyStats,
            dailyUsage: dailyUsage.length > 0 ? dailyUsage : undefined,
        }
        setUsageData(data)
        return data
    }, [agent, selectedProvider, authMethod, apiKey])

    const handleOpenBilling = useCallback(async (url?: string) => {
        if (url) {
            try {
                const { openUrl } = await import('../utils/open')
                await openUrl(url)
            } catch {
                // Intentionally swallowed: headless browser open fallback
            }
        }
    }, [])

    const handleDismissBtw = useCallback(() => {
        if (btwAbortRef.current) {
            btwAbortRef.current.abort()
            btwAbortRef.current = null
        }
        setBtwState(null)
    }, [setBtwState])

    const handleSideQuestion = useCallback(
        async (question: string) => {
            if (!agent) {
                addToast('No active agent session.', 'error')
                return
            }

            if (btwAbortRef.current) {
                btwAbortRef.current.abort()
            }
            const controller = new AbortController()
            btwAbortRef.current = controller

            setBtwState({
                question,
                answer: '',
                status: 'loading',
            })

            try {
                const { runSideQuestion } = await import('@december/agent')
                await runSideQuestion(agent, question, {
                    signal: controller.signal,
                    onChunk: (chunk) => {
                        setBtwState((prev) => {
                            if (!prev) return null
                            return {
                                ...prev,
                                status: 'streaming',
                                answer: prev.answer + chunk,
                            }
                        })
                    },
                })
                setBtwState((prev) => (prev ? { ...prev, status: 'complete' } : null))
            } catch (err: any) {
                if (controller.signal.aborted) {
                    return
                }
                setBtwState((prev) =>
                    prev ? { ...prev, status: 'error', error: err?.message || String(err) } : null
                )
            } finally {
                if (btwAbortRef.current === controller) {
                    btwAbortRef.current = null
                }
            }
        },
        [agent, addToast, setBtwState]
    )

    const handleRewindSelect = useCallback(
        async (targetTurn: number) => {
            if (!agent) return
            try {
                addToast(`Rewinding workspace to Turn ${targetTurn}...`, 'info')
                const result = await agent.rollbackToTurn(targetTurn)

                setActiveMessages((prev) => {
                    let userCount = 0
                    let cutIdx = -1
                    for (let i = 0; i < prev.length; i++) {
                        if (prev[i]?.role === 'user') {
                            userCount++
                            if (userCount === targetTurn) {
                                cutIdx = i
                                break
                            }
                        }
                    }
                    return cutIdx !== -1 ? prev.slice(0, cutIdx) : prev
                })

                const count = result.restoredFiles.length + result.deletedFiles.length
                addToast(
                    `Rewound to Turn ${targetTurn}. (${count} file${count === 1 ? '' : 's'} affected)`,
                    'success'
                )
                setAuthMode('none')
            } catch (e: any) {
                addToast(`Failed to rewind: ${e.message}`, 'error')
            }
        },
        [agent, addToast, setActiveMessages, setAuthMode]
    )

    const onClearPrefillPrompt = useCallback(() => {
        setPrefillPrompt(null)
    }, [setPrefillPrompt])

    const handleCodeSearchOpen = useCallback(
        (item: CodeSearchResultItem) => {
            setFileViewTarget({
                filePath: item.file,
                initialLine: item.line,
                returnAuthMode: 'code_search',
            })
            setAuthMode('file_view')
        },
        [setFileViewTarget, setAuthMode]
    )

    const handleFileViewClose = useCallback(() => {
        const returnMode = fileViewTarget?.returnAuthMode || 'none'
        const returnQuery = fileViewTarget?.returnQuery
        setFileViewTarget(null)
        setAuthMode(returnMode)
        if (returnQuery) {
            setPrefillPrompt(returnQuery)
        }
    }, [fileViewTarget, setFileViewTarget, setAuthMode, setPrefillPrompt])

    const handleCodeSearchInsert = useCallback(
        (item: CodeSearchResultItem) => {
            setAuthMode('none')
            setPrefillPrompt(`@${item.file}:${item.line} `)
        },
        [setAuthMode, setPrefillPrompt]
    )

    const handleFileViewInsertContext = useCallback(
        (file: string, line?: number) => {
            setFileViewTarget(null)
            setAuthMode('none')
            setPrefillPrompt(line ? `@${file}:${line} ` : `@${file} `)
        },
        [setFileViewTarget, setAuthMode, setPrefillPrompt]
    )

    const handleSubmit = useCallback(
        async (text: string, options?: { returnQuery?: string }) => {
            if (text.trim() === '/exit') {
                setShouldExit(true)
                process.exit(0)
                return
            }

            if (text.trim() === '/btw' || text.trim().startsWith('/btw ')) {
                const question = text.trim().slice(4).trim()
                if (!question) {
                    addToast('Usage: /btw <question> (e.g. /btw what port does redis use?)', 'info')
                    return
                }
                handleSideQuestion(question)
                return
            }

            if (text.trim().startsWith('!')) {
                const rawCmd = text.trim().slice(1).trim()
                if (!rawCmd) {
                    addToast('Usage: !<command> (e.g. !git status)', 'info')
                    return
                }

                const userMsgId = getNextMsgId()
                const assistantMsgId = getNextMsgId()

                setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                setActiveMessages([
                    {
                        id: userMsgId,
                        role: 'user',
                        text: `!${rawCmd}`,
                    },
                    {
                        id: assistantMsgId,
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'command',
                                toolName: 'bash',
                                command: rawCmd,
                                status: 'running',
                                output: '',
                            },
                        ],
                    },
                ])

                setIsStreaming(true)

                const { promise, abort } = startDirectCommand(rawCmd, {
                    timeoutMs: 20_000,
                    onData: (chunk) => {
                        setActiveMessages((prev) =>
                            prev.map((msg) => {
                                if (msg.id !== assistantMsgId) return msg
                                const blocks = msg.blocks || []
                                const newBlocks = blocks.map((b) => {
                                    if (b.type === 'command' && b.command === rawCmd) {
                                        return {
                                            ...b,
                                            output: (b.output || '') + chunk,
                                        }
                                    }
                                    return b
                                })
                                return { ...msg, blocks: newBlocks }
                            })
                        )
                    },
                    onBackground: (taskId) => {
                        addToast(
                            `Command moved to background (${taskId}). Use /tasks to view logs.`,
                            'info'
                        )
                        setActiveMessages((prev) =>
                            prev.map((msg) => {
                                if (msg.id !== assistantMsgId) return msg
                                const blocks = msg.blocks || []
                                const newBlocks = blocks.map((b) => {
                                    if (b.type === 'command' && b.command === rawCmd) {
                                        return {
                                            ...b,
                                            status: 'success' as const,
                                            output:
                                                (b.output || '') +
                                                `\n[Moved to background task: ${taskId}. Use /tasks to inspect.]`,
                                        }
                                    }
                                    return b
                                })
                                return { ...msg, blocks: newBlocks }
                            })
                        )
                    },
                })

                activeShellAbortRef.current = abort

                try {
                    const result = await promise
                    if (!result.isBackground) {
                        setActiveMessages((prev) =>
                            prev.map((msg) => {
                                if (msg.id !== assistantMsgId) return msg
                                const blocks = msg.blocks || []
                                const newBlocks = blocks.map((b) => {
                                    if (b.type === 'command' && b.command === rawCmd) {
                                        return {
                                            ...b,
                                            status: (result.exitCode === 0
                                                ? 'success'
                                                : 'error') as 'success' | 'error',
                                            output: result.output,
                                        }
                                    }
                                    return b
                                })
                                return { ...msg, blocks: newBlocks }
                            })
                        )

                        // Append to agent.messages so LLM has context for subsequent user turns
                        if (agent && agent.messages) {
                            agent.messages.push({
                                role: 'user',
                                content: `!${rawCmd}`,
                            })
                            agent.messages.push({
                                role: 'assistant',
                                content: `[Direct Shell Output: ${rawCmd}]\n${result.output}`,
                            })
                        }
                    }
                } finally {
                    activeShellAbortRef.current = null
                    setIsStreaming(false)
                    setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                    setActiveMessages([])
                }
                return
            }

            if (text.trim() === '/auth status' || text.trim() === '/auth') {
                const config = await loadConfig()
                const { getAuthStatus } = await import('../config')
                const authStatus = await getAuthStatus()
                const subKeys = config.subscriptions ? Object.keys(config.subscriptions) : []
                const byokKeys = config.providers ? Object.keys(config.providers) : []

                let subLines = ''
                if (subKeys.length > 0) {
                    for (const k of subKeys) {
                        const sub = config.subscriptions![k]
                        const typeStr = sub.subscriptionType ? ` [${sub.subscriptionType}]` : ''
                        const userStr =
                            sub.email || sub.accountName ? ` (${sub.email || sub.accountName})` : ''
                        const expStr = sub.expiresAt
                            ? sub.expiresAt > Date.now()
                                ? 'Valid'
                                : 'Expired (will auto-refresh)'
                            : 'Active'
                        subLines += `\n• **${k.toUpperCase()}**${typeStr}${userStr}: ${expStr}`
                    }
                } else {
                    subLines = '\n*(None detected. Run /auth import or /login <provider>)*'
                }

                let byokLines = ''
                if (byokKeys.length > 0) {
                    for (const k of byokKeys) {
                        byokLines += `\n• **${k.toUpperCase()}**`
                    }
                } else {
                    byokLines = '\n*(None configured)*'
                }

                const decStatus = config.decemberToken
                    ? `Connected ${config.email ? `(${config.email})` : ''}`
                    : 'Not connected'

                const card = `### Authentication & Subscription Status

**Subscriptions:**${subLines}

**BYOK API Keys:**${byokLines}

**December Cloud Wallet:**
${decStatus}

**Active Auth Priority:** \`${config.authPriority || authStatus.authPriority}\`
**Active Provider:** \`${config.activeProvider || 'none'}\` (Model: \`${config.activeModel || 'default'}\`)`

                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [{ type: 'text', content: card }],
                    },
                ])
                return
            }

            if (text.trim() === '/auth import') {
                addToast('Scanning local directories for subscriptions...', 'info')
                const { importLocalSubscriptions } =
                    await import('../auth/subscriptions/subscription-manager')
                const result = await importLocalSubscriptions()
                if (result.imported.length === 0) {
                    addToast('No local subscription credentials found.', 'info')
                } else {
                    addToast(
                        `Imported ${result.imported.length} subscription(s): ${result.imported.join(', ')}`,
                        'success'
                    )
                    const { getProviderConfig, getAuthStatus } = await import('../config')
                    const providerConfig = await getProviderConfig()
                    const authStatus = await getAuthStatus()

                    if (providerConfig && agent) {
                        const llm = instantiateProvider(
                            providerConfig.provider,
                            providerConfig.apiKey,
                            {
                                authMethod: providerConfig.authMethod,
                                subscription: providerConfig.subscription,
                                headers: providerConfig.headers,
                                baseURL: providerConfig.baseURL,
                            }
                        )
                        agent.setLLM(llm)
                        agent.modelOptions = { ...agent.modelOptions, model: providerConfig.model }
                        setActiveModel(providerConfig.model)
                        setSelectedProvider(providerConfig.provider)
                        setIsAuthenticated(true)
                        setAuthMethod(providerConfig.authMethod)
                        setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                        setSettingsAuthPriority(authStatus.authPriority)
                    }
                }
                return
            }

            if (text.trim() === '/mcp' || text.trim().startsWith('/mcp ')) {
                const manager = agent?.mcpClientManager
                const servers = manager ? manager.getAllServers() : []
                if (!manager || servers.length === 0) {
                    const { loadMcpConfig } = await import('@december/tools')
                    const cfg = await loadMcpConfig({ workspaceDir: process.cwd() })
                    const count = Object.keys(cfg).length
                    if (count === 0) {
                        const notice = `### Model Context Protocol (MCP)\n\nNo MCP servers configured.\n\nTo configure an MCP server, add an \`mcpServers\` entry to \`~/.december/config.json\` or project \`.december/mcp.json\`.\n\n\`\`\`json\n{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"]\n    }\n  }\n}\n\`\`\``
                        setActiveMessages((prev) => [
                            ...prev,
                            {
                                id: getNextMsgId(),
                                role: 'assistant',
                                blocks: [{ type: 'text', content: notice }],
                            },
                        ])
                        return
                    }
                }

                let content = `### Model Context Protocol (MCP) Servers\n\n`
                if (servers.length === 0) {
                    content += `No active MCP servers connected.`
                } else {
                    for (const s of servers) {
                        const typeStr =
                            s.config && 'command' in s.config && s.config.command ? 'stdio' : 'sse'
                        const statusTag =
                            s.status === 'connected'
                                ? '🟢 Connected'
                                : s.status === 'error'
                                  ? '🔴 Error'
                                  : '⚪ Disconnected'
                        content += `#### **${s.name}** (${typeStr}) - ${statusTag}\n`
                        if (s.error) {
                            content += `*Error: ${s.error}*\n`
                        }
                        if (s.tools && s.tools.length > 0) {
                            content += `**Tools (${s.tools.length}):**\n`
                            for (const tool of s.tools) {
                                const desc = tool.description
                                    ? `: ${tool.description.split('\n')[0]}`
                                    : ''
                                content += `- \`${tool.name}\`${desc}\n`
                            }
                        } else if (s.status === 'connected') {
                            content += `*No tools exported by this server*\n`
                        }
                        content += `\n`
                    }
                }

                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [{ type: 'text', content: content.trim() }],
                    },
                ])
                return
            }

            if (text.trim().startsWith('/login ')) {
                const targetProvider = text.trim().slice('/login '.length).trim().toLowerCase()
                if (targetProvider) {
                    try {
                        const { loginSubscription } =
                            await import('../auth/subscriptions/subscription-manager')
                        addToast(
                            `Initiating subscription login for ${targetProvider.toUpperCase()}...`,
                            'info'
                        )
                        await loginSubscription(targetProvider)
                        const { getProviderConfig, getAuthStatus } = await import('../config')
                        const providerConfig = await getProviderConfig()
                        const authStatus = await getAuthStatus()

                        if (providerConfig && agent) {
                            const llm = instantiateProvider(
                                providerConfig.provider,
                                providerConfig.apiKey,
                                {
                                    authMethod: providerConfig.authMethod,
                                    subscription: providerConfig.subscription,
                                    headers: providerConfig.headers,
                                    baseURL: providerConfig.baseURL,
                                }
                            )
                            agent.setLLM(llm)
                            agent.modelOptions = {
                                ...agent.modelOptions,
                                model: providerConfig.model,
                            }
                            setActiveModel(providerConfig.model)
                            setSelectedProvider(providerConfig.provider)
                            setIsAuthenticated(true)
                            setAuthMethod(providerConfig.authMethod)
                            setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                            setSettingsAuthPriority(authStatus.authPriority)
                        }
                        if (providerConfig?.subscription) {
                            const { formatSubscriptionToast } =
                                await import('../auth/subscriptions/formatters')
                            addToast(
                                formatSubscriptionToast(
                                    providerConfig.subscription,
                                    providerConfig.model
                                ),
                                'success'
                            )
                        } else {
                            const { formatSubscriptionDisplayName } =
                                await import('../auth/subscriptions/formatters')
                            addToast(
                                `Connected to ${formatSubscriptionDisplayName(targetProvider)}`,
                                'success'
                            )
                        }
                    } catch (e: any) {
                        addToast(`Login failed: ${e.message}`, 'error')
                    }
                    return
                }
            }

            if (text.trim().startsWith('/switch ')) {
                const targetProvider = text.trim().slice('/switch '.length).trim().toLowerCase()
                if (targetProvider) {
                    const config = await loadConfig()
                    const target = resolveSwitchTarget(config, targetProvider)
                    if (!target) {
                        addToast(`Provider "${targetProvider}" is not configured.`, 'error')
                        return
                    }

                    const { config: updatedConfig, model } = applyProviderSwitch(config, target)
                    await saveConfig(updatedConfig)

                    const { getProviderConfig, getAuthStatus } = await import('../config')
                    const providerConfig = await getProviderConfig()
                    const authStatus = await getAuthStatus()

                    setIsAuthenticated(!!providerConfig)
                    setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                    setSettingsAuthPriority(authStatus.authPriority)

                    if (providerConfig && agent) {
                        const llm = instantiateProvider(
                            providerConfig.provider,
                            providerConfig.apiKey,
                            {
                                authMethod: providerConfig.authMethod,
                                subscription: providerConfig.subscription,
                                headers: providerConfig.headers,
                                baseURL: providerConfig.baseURL,
                            }
                        )
                        agent.setLLM(llm)
                        agent.modelOptions = {
                            ...agent.modelOptions,
                            model: providerConfig.model,
                        }
                        setActiveModel(providerConfig.model)
                        setSelectedProvider(providerConfig.provider)
                        setAuthMethod(providerConfig.authMethod)
                    }

                    if (providerConfig?.apiKey) {
                        const { fetchLiveProviderModels } = await import('../utils/models')
                        fetchLiveProviderModels(
                            providerConfig.provider,
                            providerConfig.apiKey,
                            providerConfig.baseURL
                        ).catch(() => {
                            // Intentionally swallowed: background live model fetch failure
                        })
                    }

                    const displayName = formatProviderName(target.provider)
                    addToast(
                        `Switched active provider to ${displayName} (${target.authPriority}) • ${model}`,
                        'success'
                    )
                    return
                }
            }

            if (text.trim() === '/switch') {
                const config = await loadConfig()
                const configuredList = getConfiguredProviders(config)
                if (configuredList.length === 0) {
                    addToast(
                        'No configured providers found. Use /login or "december key" to configure one.',
                        'info'
                    )
                    return
                }

                const menuItems = configuredList.map((item) => ({
                    label: item.label,
                    value: item.value,
                    model: item.model,
                    isActive: item.isActive,
                }))

                setSwitchItems(menuItems)
                setAuthMode('switch_select')
                return
            }

            if (text.trim() === '/login') {
                setAuthMode('menu')
                return
            }

            if (text.trim() === '/new') {
                if (agent) {
                    await agent.newContext()
                }
                console.clear()
                setStaticMessages([{ id: 'header-' + Date.now(), role: 'header' }])
                setStaticKey((k: number) => k + 1)
                setActiveMessages([])
                setQueuedPrompts([])
                addToast('Started a new conversation.', 'success')
                return
            }

            if (text.trim() === '/clear') {
                if (agent) {
                    await agent.clearContext()
                }
                console.clear()
                setStaticMessages([{ id: 'header-' + Date.now(), role: 'header' }])
                setStaticKey((k: number) => k + 1)
                setActiveMessages([])
                setQueuedPrompts([])
                addToast('Cleared conversation history.', 'success')
                return
            }

            if (text.trim() === '/fork') {
                if (agent) {
                    const newId = await agent.forkContext()
                    addToast(`Forked to new session: ${newId}`, 'success')
                } else {
                    addToast('Agent not available to fork session.', 'error')
                }
                return
            }

            if (text.trim() === '/voice') {
                const { isVoiceConfigured, getVoiceSetupNotice } = await import('../utils/audio')
                const status = await isVoiceConfigured()
                if (!status.available) {
                    const userMsg: Message = {
                        id: getNextMsgId(),
                        role: 'user',
                        displayText: '/voice',
                        text: '/voice',
                    }
                    const noticeMsg: Message = {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: getVoiceSetupNotice(status),
                            },
                        ],
                    }
                    setStaticMessages((prev) => [
                        ...prev,
                        ...useCliStore.getState().activeMessages,
                        userMsg,
                        noticeMsg,
                    ])
                    setActiveMessages([])
                    return
                }
            }

            if (text.trim() === '/copy') {
                try {
                    const { writeToClipboard } = await import('@december/tui')
                    const assistantMsgs = (agent?.messages || []).filter(
                        (m: any) => m.role === 'assistant'
                    )
                    const lastAgentMsg =
                        assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1] : null

                    let textToCopy = ''
                    if (
                        lastAgentMsg &&
                        typeof lastAgentMsg.content === 'string' &&
                        lastAgentMsg.content.trim()
                    ) {
                        textToCopy = lastAgentMsg.content
                    } else {
                        const allMsgs = [
                            ...useCliStore.getState().staticMessages,
                            ...useCliStore.getState().activeMessages,
                        ]
                        const lastAssistant = [...allMsgs]
                            .reverse()
                            .find((m) => m.role === 'assistant' && m.blocks)
                        if (lastAssistant && lastAssistant.blocks) {
                            textToCopy = lastAssistant.blocks
                                .map((b: any) => b.content || '')
                                .join('\n')
                                .trim()
                        }
                    }

                    if (textToCopy) {
                        writeToClipboard(textToCopy)
                        addToast('Copied last planner response to clipboard!', 'success')
                    } else {
                        addToast('No planner response found to copy.', 'error')
                    }
                } catch {
                    // Intentionally swallowed: clipboard write error fallback
                    addToast('Failed to write to clipboard.', 'error')
                }
                return
            }

            const trimmedCmd = text.trim().toLowerCase()
            if (trimmedCmd === '/changelog') {
                const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(
                    /\/$/,
                    ''
                )
                const targetUrl = `${baseUrl}/docs/changelog/`

                addToast('Opening changelog in your browser...', 'info')

                try {
                    const { openUrl } = await import('../utils/open')
                    await openUrl(targetUrl)
                    addToast('Opened changelog in browser.', 'success')
                } catch {
                    // Intentionally swallowed: fallback URL displayed in toast
                    addToast(`Changelog: ${targetUrl}`, 'info')
                }
                return
            }

            if (trimmedCmd === '/docs' || trimmedCmd.startsWith('/docs ')) {
                const parts = text.trim().split(/\s+/)
                const section = parts[1]
                const { resolveDocsSectionPath } = await import('../commands')
                const sectionPath = resolveDocsSectionPath(section)
                const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(
                    /\/$/,
                    ''
                )
                const targetUrl = `${baseUrl}/docs${sectionPath}`

                addToast('Opening documentation in your browser...', 'info')

                try {
                    const { openUrl } = await import('../utils/open')
                    await openUrl(targetUrl)
                    addToast('Opened documentation in browser.', 'success')
                } catch {
                    // Intentionally swallowed: fallback URL displayed in toast
                    addToast(`Docs: ${targetUrl}`, 'info')
                }
                return
            }

            if (
                trimmedCmd === '/open' ||
                trimmedCmd.startsWith('/open ') ||
                trimmedCmd.startsWith('/open\t')
            ) {
                const fs = await import('node:fs')
                const path = await import('node:path')
                const rawArg = text.trim().slice(5).trim()
                let targetArg = rawArg || '.'
                let targetLine = 1

                const lineMatch = targetArg.match(/^(.+?):(\d+)$/)
                if (lineMatch && targetArg !== '.') {
                    targetArg = lineMatch[1] ?? targetArg
                    targetLine = parseInt(lineMatch[2] ?? '1', 10) || 1
                }
                const fullPath = path.resolve(process.cwd(), targetArg)

                if (targetArg !== '.' && !fs.existsSync(fullPath)) {
                    addToast(`File not found: ${rawArg}`, 'error')
                    return
                }

                let isDirectory = false
                try {
                    const stat = fs.statSync(fullPath)
                    isDirectory = stat.isDirectory()
                } catch {
                    // Intentionally swallowed: fallback to file view if stat fails
                }

                if (targetArg === '.' || isDirectory) {
                    addToast('Opening workspace in editor...', 'info')
                    try {
                        const { openPath } = await import('../utils/open')
                        await openPath(fullPath)
                        addToast('Opened workspace in editor.', 'success')
                    } catch {
                        // Intentionally swallowed: fallback toast on open error
                        addToast('Failed to open workspace', 'error')
                    }
                    return
                }

                setFileViewTarget({
                    filePath: targetArg,
                    initialLine: targetLine,
                    returnQuery: options?.returnQuery,
                })
                setAuthMode('file_view')
                return
            }

            if (
                trimmedCmd === '/codesearch' ||
                trimmedCmd.startsWith('/codesearch ') ||
                trimmedCmd.startsWith('/codesearch\t')
            ) {
                const query = text.trim().slice(11).trim()

                if (!query) {
                    addToast('Usage: /codesearch <query>', 'error')
                    return
                }

                try {
                    addToast(`Searching for "${query}"...`, 'info')
                    const { localOperations } = await import('../local-operations')
                    const path = await import('node:path')
                    const output = await localOperations.search.grep('.', query)
                    const lines = output ? output.split('\n').filter((l) => Boolean(l.trim())) : []
                    const items: CodeSearchResultItem[] = []

                    for (const line of lines) {
                        const firstColon = line.indexOf(':')
                        if (firstColon === -1) continue
                        const secondColon = line.indexOf(':', firstColon + 1)
                        if (secondColon === -1) continue
                        const rawFile = line.slice(0, firstColon)
                        const lineNumStr = line.slice(firstColon + 1, secondColon)
                        const lineNum = parseInt(lineNumStr, 10)
                        if (isNaN(lineNum)) continue
                        const content = line.slice(secondColon + 1).trim()
                        const file = path.isAbsolute(rawFile)
                            ? path.relative(process.cwd(), rawFile)
                            : rawFile
                        items.push({
                            file,
                            line: lineNum,
                            content,
                        })
                    }

                    setCodeSearchQuery(query)
                    setCodeSearchResults(items.slice(0, 100))
                    setAuthMode('code_search')
                } catch {
                    // Intentionally swallowed: fallback toast on code search failure
                    addToast(`Code search failed for "${query}"`, 'error')
                }
                return
            }

            if (text.trim() === '/ask') {
                addToast(
                    'Please enter your question after /ask (e.g. /ask how does auth work?)',
                    'info'
                )
                return
            }

            if (text.trim() === '/init') {
                addToast(
                    'The /init command has been removed. Create AGENTS.md in project root for instructions.',
                    'info'
                )
                return
            }

            if (text.trim() === '/update') {
                const { performCliUpdate } = await import('../utils/updater')
                const result = await performCliUpdate({
                    onProgress: (msg) => addToast(msg, 'info'),
                    onSuccess: async () => {
                        if (agent) {
                            await agent.saveContext().catch(() => {
                                // Intentionally swallowed: context save failure before update is non-fatal
                            })
                        }
                    },
                })

                if (result.method === 'source') {
                    addToast(
                        'Running December CLI from local source. Run "git pull && bun install && bun --cwd apps/cli run build" to update.',
                        'info'
                    )
                } else if (result.method === 'npx') {
                    addToast(
                        'Running December CLI via npx/bunx. You are automatically using the latest version.',
                        'info'
                    )
                } else if (result.alreadyUpToDate) {
                    addToast(
                        `You are already using the latest version (v${result.installedVersion || result.targetVersion}).`,
                        'success'
                    )
                } else if (result.success && result.verified) {
                    const verStr = result.installedVersion ? ` to v${result.installedVersion}` : ''
                    if (result.collisionFixed) {
                        addToast(
                            'Aligned multiple installation paths so your terminal runs the latest version.',
                            'info'
                        )
                    }
                    addToast(
                        `December CLI updated successfully${verStr} via ${result.method}! Run "december" to start your updated session.`,
                        'success'
                    )
                    if (result.shellHashNotice) {
                        addToast(
                            'Tip: If your active terminal still executes an older version, run "hash -r" (bash) or "rehash" (zsh) or restart terminal.',
                            'info'
                        )
                    }
                } else if (!result.verified && result.shadowingBinary) {
                    addToast(
                        `Updated to v${result.installedVersion || result.targetVersion}, but terminal still runs v${result.activeVersion || 'older'} from ${result.activeBinaryPath || result.shadowingBinary.path}. Run: rm "${result.shadowingBinary.path}"`,
                        'warning'
                    )
                } else {
                    const hintCmd = result.sudoCmd || result.manualCmd
                    addToast(
                        `Update failed (${result.method}): ${result.error || 'Unknown error'}. Try: ${hintCmd}`,
                        'error'
                    )
                }
                return
            }

            if (text.trim() === '/context') {
                setAuthMode('context_select')
                return
            }

            if (text.trim() === '/model') {
                const { getAuthStatus } = await import('../config')
                const status = await getAuthStatus()
                if (
                    !isAuthenticated ||
                    (!status.hasByok && !status.hasDecember && !status.hasSubscription)
                ) {
                    const userMsg: Message = { id: getNextMsgId(), role: 'user', text }
                    const noticeMsg: Message = {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: AUTH_REQUIRED_NOTICE,
                            },
                        ],
                    }
                    setStaticMessages((prev) => [
                        ...prev,
                        ...useCliStore.getState().activeMessages,
                        userMsg,
                        noticeMsg,
                    ])
                    setActiveMessages([])
                    return
                }
                loadConfig().then(async (config) => {
                    const { getProviderConfig } = await import('../config')
                    const providerConfig = await getProviderConfig()
                    const activeProvider = config.activeProvider || providerConfig?.provider || ''
                    setSelectedProvider(activeProvider)
                    if (activeProvider && providerConfig?.apiKey) {
                        const { fetchLiveProviderModels } = await import('../utils/models')
                        fetchLiveProviderModels(
                            activeProvider,
                            providerConfig.apiKey,
                            providerConfig.baseURL
                        ).catch(() => {})
                    }
                    setAuthMode('model_select')
                })
                return
            }

            if (text.trim() === '/resume' || text.trim().startsWith('/resume ')) {
                const resumeQuery = text.trim().slice('/resume'.length).trim().toLowerCase()
                if (!sessionRepository) {
                    const userMsg: Message = { id: getNextMsgId(), role: 'user', text }
                    const noticeMsg: Message = {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [{ type: 'text', content: 'Session repository not available.' }],
                    }
                    setStaticMessages((prev) => [
                        ...prev,
                        ...useCliStore.getState().activeMessages,
                        userMsg,
                        noticeMsg,
                    ])
                    setActiveMessages([])
                    return
                }
                sessionRepository.listSessions().then((sessions: any[]) => {
                    if (sessions.length === 0) {
                        addToast('No previous sessions found.', 'info')
                        return
                    }
                    let matchedSessions = sessions
                    if (resumeQuery) {
                        matchedSessions = sessions.filter((s: any) => {
                            const preview = (s.preview || s.title || '').toLowerCase()
                            const id = (s.id || '').toLowerCase()
                            return preview.includes(resumeQuery) || id.includes(resumeQuery)
                        })
                        if (matchedSessions.length === 0) {
                            addToast(
                                `No sessions found matching "${resumeQuery}". Showing all sessions.`,
                                'info'
                            )
                            matchedSessions = sessions
                        }
                    }
                    setSessionsData(matchedSessions)
                    setSessionPage(0)
                    setSessionSelectedIndex(0)
                    setSessionRenameMode(false)
                    setAuthMode('session_select')
                })
                return
            }

            if (text.trim() === '/settings') {
                loadConfig().then((config) => {
                    setSettingsPathGuard(config.pathGuard !== false)
                    setSettingsNonWorkspace(config.nonWorkspaceAccess ?? false)
                    setSettingsToolPermission(config.toolPermission ?? 'always-proceed')
                    setSettingsThinkingLevel(config.thinkingLevel ?? 'auto')
                    setSettingsSteeringMode(config.steeringMode ?? 'all')
                    setSettingsFollowUpMode(config.followUpMode ?? 'all')
                    setSettingsBrowserVisible(config.browserVisible !== false)
                    setAuthMode('settings_main')
                })
                return
            }

            const isEffortCmd = trimmedCmd === '/effort' || trimmedCmd.startsWith('/effort ')
            if (isEffortCmd) {
                const parts = text.trim().split(/\s+/)
                const rawArg = parts[1]?.toLowerCase()

                const currentModel = activeModel || agent?.modelOptions?.model || 'december-auto'
                const { supportsModelThinking } = await import('@december/providers')
                const isSupported = supportsModelThinking(currentModel)

                if (!isSupported) {
                    addToast(
                        `Reasoning is not supported by ${currentModel}. Use /model to switch engines.`,
                        'warning'
                    )
                    return
                }

                const validLevels = ['auto', 'off', 'low', 'medium', 'high'] as const
                type ValidLevel = (typeof validLevels)[number]

                if (rawArg) {
                    if (validLevels.includes(rawArg as ValidLevel)) {
                        const targetLevel = rawArg as ValidLevel
                        const config = await loadConfig()
                        config.thinkingLevel = targetLevel
                        setSettingsThinkingLevel(targetLevel)
                        if (agent) {
                            agent.thinkingLevel = targetLevel
                            agent.modelOptions = {
                                ...agent.modelOptions,
                                thinkingLevel: targetLevel,
                            }
                        }
                        await saveConfig(config)
                        const displayLevel =
                            targetLevel.charAt(0).toUpperCase() + targetLevel.slice(1)
                        addToast(`Reasoning set to ${displayLevel}.`, 'success')
                    } else {
                        addToast(
                            `Invalid reasoning level "${rawArg}". Valid options: auto, off, low, medium, high`,
                            'error'
                        )
                    }
                    return
                }

                const config = await loadConfig()
                setSettingsThinkingLevel(config.thinkingLevel ?? 'auto')
                setAuthMode('reasoning_select')
                return
            }

            if (text.trim() === '/help' || text.trim().startsWith('/help ')) {
                const rawArg = text.trim().slice(5).trim().toLowerCase()
                if (rawArg === 'commands' || rawArg === 'command') {
                    setHelpInitialTab('commands')
                } else if (rawArg === 'shortcuts' || rawArg === 'shortcut' || rawArg === 'keys') {
                    setHelpInitialTab('shortcuts')
                } else {
                    setHelpInitialTab('general')
                }
                setAuthMode('help')
                return
            }

            if (text.trim() === '/shortcuts') {
                setHelpInitialTab('shortcuts')
                setAuthMode('help')
                return
            }

            if (text.trim() === '/tasks') {
                setAuthMode('tasks_mode')
                return
            }

            if (text.trim() === '/diff' || text.trim().startsWith('/diff ')) {
                setAuthMode('diff_view')
                return
            }

            if (
                text.trim() === '/skills' ||
                text.trim() === '/skill' ||
                text.trim() === '/skills list' ||
                text.trim() === '/skill list'
            ) {
                setAuthMode('skills')
                return
            }

            if (
                text.trim() === '/memory' ||
                text.trim().startsWith('/memory ') ||
                text.trim() === '/rules' ||
                text.trim().startsWith('/rules ')
            ) {
                const isRules = text.trim() === '/rules' || text.trim().startsWith('/rules ')
                setMemoryInitialTab(isRules ? 'rules' : 'memory')
                setAuthMode('memory_view')
                return
            }

            if (text.trim() === '/undo') {
                if (!agent) {
                    addToast('No active agent session.', 'error')
                    return
                }
                try {
                    addToast('Reverting last agent turn...', 'info')
                    const result = await agent.rollbackLastTurn()

                    setActiveMessages((prev) => {
                        let lastUserIdx = -1
                        for (let i = prev.length - 1; i >= 0; i--) {
                            if (prev[i]?.role === 'user') {
                                lastUserIdx = i
                                break
                            }
                        }
                        return lastUserIdx !== -1 ? prev.slice(0, lastUserIdx) : []
                    })

                    const count = result.restoredFiles.length + result.deletedFiles.length
                    addToast(
                        `Undid Turn ${result.targetTurn}. (${count} file${count === 1 ? '' : 's'} affected)`,
                        'success'
                    )
                } catch (e: any) {
                    addToast(`Failed to undo: ${e.message}`, 'error')
                }
                return
            }

            if (text.trim() === '/rewind' || text.trim().startsWith('/rewind ')) {
                if (!agent) {
                    addToast('No active agent session.', 'error')
                    return
                }
                try {
                    const { getSnapshotManager } = await import('@december/tools')
                    const manager = getSnapshotManager(agent.workspaceDir || process.cwd())
                    await manager.init()
                    const snapshots = manager.getSnapshots()
                    if (snapshots.length === 0) {
                        addToast('No turn snapshots recorded in this session.', 'info')
                        return
                    }
                    setRewindItems(snapshots)
                    setAuthMode('rewind_select')
                } catch (e: any) {
                    addToast(`Failed to open rewind menu: ${e.message}`, 'error')
                }
                return
            }

            if (text.trim() === '/usage') {
                await fetchUsageData()
                setAuthMode('usage')
                return
            }

            if (text.trim() === '/feedback') {
                const url = 'https://github.com/phasehumans/december/issues/new/choose'
                addToast('Opening feedback in your browser...', 'info')
                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'text',
                                content: `Have feedback, found a bug, or have a feature request? Let us know:\n\n• **GitHub:** [phasehumans/december/issues](${url})\n• **Email:** [team@trydecember.com](mailto:team@trydecember.com)`,
                            },
                        ],
                    },
                ])
                try {
                    const { openUrl } = await import('../utils/open')
                    await openUrl(url)
                    addToast('Opened feedback in browser.', 'success')
                } catch {
                    // Intentionally swallowed: fallback URL displayed in message
                }
                return
            }

            if (interactivePlanGoalMode) {
                setInteractivePlanGoalMode(false)
                const goal = text.trim()
                if (goal) {
                    await generatePlanFromGoal(goal)
                    return
                } else {
                    addToast('Plan creation cancelled.', 'info')
                    return
                }
            }

            if (planRefineMode) {
                setPlanRefineMode(false)
                const feedback = text.trim()
                if (feedback) {
                    await generatePlanRefinement(feedback)
                    return
                }
            }

            const rawUserPrompt = text.trim()
            if (!rawUserPrompt) return

            if (!isAuthenticated) {
                const userMsg: Message = { id: getNextMsgId(), role: 'user', text: rawUserPrompt }
                const noticeMsg: Message = {
                    id: getNextMsgId(),
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: AUTH_REQUIRED_NOTICE,
                        },
                    ],
                }
                setStaticMessages((prev) => [
                    ...prev,
                    ...useCliStore.getState().activeMessages,
                    userMsg,
                    noticeMsg,
                ])
                setActiveMessages([])
                return
            }

            // normal chat logic
            if (isStreaming) {
                setQueuedPrompts((prev) => [...prev, rawUserPrompt])
                return
            }

            let currentRawPrompt: string | undefined = rawUserPrompt
            while (currentRawPrompt) {
                const promptToProcess = currentRawPrompt
                let displayText = promptToProcess
                let executionPrompt = promptToProcess
                let isAskPrompt = false

                if (
                    promptToProcess.trim() === '/ask' ||
                    promptToProcess.trim().startsWith('/ask ') ||
                    promptToProcess.trim().startsWith('/ask\t')
                ) {
                    const question = promptToProcess
                        .trim()
                        .replace(/^\/ask\s*/, '')
                        .trim()
                    if (question) {
                        isAskPrompt = true
                        executionPrompt = getAskPrompt(question)
                        displayText = `/ask ${question}`
                    }
                }

                // Check if input matches an installed skill (e.g. /skill:audit or /skill:tdd or /tdd [args])
                if (!isAskPrompt && promptToProcess.startsWith('/')) {
                    const [firstToken, ...restArgs] = promptToProcess.split(/\s+/)
                    let potentialCmd = firstToken ? firstToken.slice(1).toLowerCase() : ''
                    const isExplicitSkillPrefix = potentialCmd.startsWith('skill:')
                    if (isExplicitSkillPrefix) {
                        potentialCmd = potentialCmd.slice('skill:'.length)
                    }

                    // Core built-ins take priority unless explicitly prefixed with /skill:
                    const coreBuiltins = new Set([
                        'ask',
                        'changelog',
                        'clear',
                        'codesearch',
                        'context',
                        'copy',
                        'diff',
                        'docs',
                        'exit',
                        'feedback',
                        'fork',
                        'init',
                        'login',
                        'model',
                        'new',
                        'open',
                        'resume',
                        'rewind',
                        'settings',
                        'skill',
                        'skills',
                        'tasks',
                        'undo',
                        'update',
                        'usage',
                    ])

                    if (isExplicitSkillPrefix || !coreBuiltins.has(potentialCmd)) {
                        try {
                            const engine = new SkillDiscoveryEngine({ workspaceDir: process.cwd() })
                            const skills = engine.discoverAllSkills()
                            const matchedSkill = skills.find(
                                (s) => s.name.toLowerCase() === potentialCmd
                            )
                            if (matchedSkill) {
                                const fullArgs = restArgs.join(' ').trim()
                                const taskDetail = fullArgs
                                    ? `for: "${fullArgs}"`
                                    : 'based on the conversation context or prompt the user to clarify requirements if needed'
                                executionPrompt = `Execute skill '${matchedSkill.name}' ${taskDetail}. Use the 'run_skill' tool to delegate this procedure to an isolated subagent.`
                                displayText = promptToProcess
                            }
                        } catch {
                            // Intentionally swallowed: fallback to standard prompt if skill resolution fails
                        }
                    }
                }

                if (executionPrompt.includes('@') && !executionPrompt.includes('<context_file')) {
                    try {
                        const { resolveContextMentions } = await import('@december/shared')
                        const resolved = await resolveContextMentions(executionPrompt)
                        executionPrompt = resolved.expandedPrompt
                    } catch {
                        // Intentionally swallowed: keep executionPrompt on resolution error
                    }
                }

                setIsStreaming(true)
                const assistantMsgId = getNextMsgId()
                const newUserMsg: Message = { id: getNextMsgId(), role: 'user', text: displayText }
                setStaticMessages((prev) => {
                    const currentActive = useCliStore.getState().activeMessages.filter((m) => {
                        if (m.role === 'assistant') {
                            return (
                                (m.blocks && m.blocks.length > 0) ||
                                Boolean(m.text && m.text.trim())
                            )
                        }
                        return true
                    })
                    return [...prev, ...currentActive, newUserMsg]
                })
                setActiveMessages([
                    {
                        id: assistantMsgId,
                        role: 'assistant',
                        blocks: [{ type: 'text', content: 'Thinking...' }],
                    },
                ])

                const errorContext = {
                    provider:
                        agent?.modelOptions?.provider || useCliStore.getState().selectedProvider,
                    model: agent?.modelOptions?.model || useCliStore.getState().activeModel,
                }
                try {
                    const stream = runAgentLoop(agent, {
                        content: executionPrompt,
                        displayText,
                        readOnly: isAskPrompt,
                    })
                    await processAgentStream({
                        stream,
                        setActiveMessages,
                        assistantMsgId,
                        context: errorContext,
                    })
                } catch (err: any) {
                    const parsed = parseError(err, errorContext)
                    setActiveMessages((prev) => [
                        ...prev,
                        {
                            id: getNextMsgId(),
                            role: 'error',
                            text: parsed.message,
                            cause: parsed.cause,
                            hint: parsed.hint,
                        },
                    ])
                } finally {
                    setIsStreaming(false)
                    setStaticMessages((prev) => {
                        const currentActive = useCliStore.getState().activeMessages.filter((m) => {
                            if (m.role === 'assistant') {
                                return (
                                    (m.blocks && m.blocks.length > 0) ||
                                    Boolean(m.text && m.text.trim())
                                )
                            }
                            return true
                        })
                        return [...prev, ...currentActive]
                    })
                    setActiveMessages([])
                }

                const nextQueue = useCliStore.getState().queuedPrompts
                if (nextQueue.length > 0) {
                    currentRawPrompt = nextQueue[0]
                    useCliStore.getState().setQueuedPrompts(nextQueue.slice(1))
                } else {
                    currentRawPrompt = undefined
                }
            }
        },
        [
            agent,
            fetchUsageData,
            isAuthenticated,
            isStreaming,
            generatePlanFromGoal,
            generatePlanRefinement,
            interactivePlanGoalMode,
            planRefineMode,
            sessionRepository,
            setInteractivePlanGoalMode,
            setPlanRefineMode,
            setQueuedPrompts,
            addToast,
            setActiveMessages,
            setAuthMode,
            setIsStreaming,
            setSelectedProvider,
            setSessionPage,
            setSessionRenameMode,
            setSessionSelectedIndex,
            setSessionsData,
            setSettingsFollowUpMode,
            setSettingsNonWorkspace,
            setSettingsPathGuard,
            setSettingsSteeringMode,
            setSettingsThinkingLevel,
            setSettingsToolPermission,
            setSettingsBrowserVisible,
            setShouldExit,
            setStaticMessages,
            setStaticKey,
            setActiveModel,
            setAuthMethod,
            setHasBothAuth,
            setIsAuthenticated,
            setSettingsAuthPriority,
            setSwitchItems,
            handleSideQuestion,
        ]
    )

    const { handleSettingsMainSelect, handleReasoningSelect } = useSettingsHandlers()

    const {
        handleAuthMenuSelect,
        handleModelSelect,
        handleProviderSelect,
        handleByokSelect,
        handleSubscriptionSelect,
        handleKeySubmit,
        handleLogoutSelect,
        handleDeleteProvider,
        handleSwitchSelect,
        handleSessionSelect,
        handleOpenDeviceAuthUrl,
        handleAbortAuth,
    } = useAuthHandlers(agent, onLogin, onLoginHeadless)

    const handleAbort = useCallback(() => {
        if (activeShellAbortRef.current) {
            activeShellAbortRef.current()
            activeShellAbortRef.current = null
        }
        if (handleAbortAuth) {
            handleAbortAuth()
        }
        if (isStreaming && agent) {
            agent.abort()
            setQueuedPrompts([])
        }
        if (useCliStore.getState().planWorkflow.phase === 'executing') {
            setPlanWorkflow({ phase: 'idle' })
        }
    }, [isStreaming, agent, setQueuedPrompts, setPlanWorkflow, handleAbortAuth])

    const handlePlanApprovalSelect = useCallback(
        async (item: any) => {
            const originalPrompt =
                currentPlannedPrompt || useCliStore.getState().currentPlannedPrompt || ''
            const planText = currentPlanText || useCliStore.getState().currentPlanText || ''
            const qaPairs = currentPlanQAPairs || useCliStore.getState().currentPlanQAPairs || []

            if (item.value === 'view') {
                addToast('Opened plan in pager/editor', 'info')
                await openPlanInPager(planText, 'december-plan')
                return
            }

            if (item.value === 'refine') {
                setAuthMode('none')
                setPlanRefineMode(true)
                setPlanWorkflow({
                    phase: 'refining',
                    prompt: originalPrompt,
                    previousPlan: planText,
                    feedback: '',
                })
                addToast('Enter feedback in the prompt bar to refine the plan', 'info')
                return
            }

            setAuthMode('none')

            if (item.value === 'approve') {
                setCurrentPlannedPrompt(null)
                setCurrentPlanText(null)
                setCurrentPlanQAPairs([])
                setPlanRefineMode(false)

                if (originalPrompt) {
                    setPlanWorkflow({
                        phase: 'executing',
                        prompt: originalPrompt,
                        planText,
                    })

                    const executionDirective = getPlanExecutionPrompt(
                        originalPrompt,
                        planText,
                        qaPairs
                    )
                    const displayText = `Approved implementation plan for: "${originalPrompt}". Executing now...`

                    setIsStreaming(true)
                    const assistantMsgId = getNextMsgId()
                    const newUserMsg: Message = {
                        id: getNextMsgId(),
                        role: 'user',
                        text: displayText,
                    }
                    setStaticMessages((prev) => {
                        const currentActive = useCliStore.getState().activeMessages.filter((m) => {
                            if (m.role === 'assistant') {
                                return (
                                    (m.blocks && m.blocks.length > 0) ||
                                    Boolean(m.text && m.text.trim())
                                )
                            }
                            return true
                        })
                        return [...prev, ...currentActive, newUserMsg]
                    })
                    setActiveMessages([
                        {
                            id: assistantMsgId,
                            role: 'assistant',
                            blocks: [{ type: 'text', content: 'Thinking...' }],
                        },
                    ])

                    const errorContext = {
                        provider:
                            agent?.modelOptions?.provider ||
                            useCliStore.getState().selectedProvider,
                        model: agent?.modelOptions?.model || useCliStore.getState().activeModel,
                    }
                    try {
                        const stream = runAgentLoop(agent, {
                            content: executionDirective,
                            displayText,
                        })
                        await processAgentStream({
                            stream,
                            setActiveMessages,
                            assistantMsgId,
                            context: errorContext,
                        })
                    } catch (err: any) {
                        const parsed = parseError(err, errorContext)
                        setActiveMessages((prev) => [
                            ...prev,
                            {
                                id: getNextMsgId(),
                                role: 'error',
                                text: parsed.message,
                                cause: parsed.cause,
                                hint: parsed.hint,
                            },
                        ])
                    } finally {
                        setIsStreaming(false)
                        setPlanWorkflow({ phase: 'idle' })
                        setStaticMessages((prev) => {
                            const currentActive = useCliStore
                                .getState()
                                .activeMessages.filter((m) => {
                                    if (m.role === 'assistant') {
                                        return (
                                            (m.blocks && m.blocks.length > 0) ||
                                            Boolean(m.text && m.text.trim())
                                        )
                                    }
                                    return true
                                })
                            return [...prev, ...currentActive]
                        })
                        setActiveMessages([])
                    }
                }
            } else {
                setCurrentPlannedPrompt(null)
                setCurrentPlanText(null)
                setCurrentPlanQAPairs([])
                setPlanRefineMode(false)
                setPlanWorkflow({ phase: 'idle' })
                addToast('Plan rejected.', 'error')
            }
        },
        [
            agent,
            currentPlannedPrompt,
            currentPlanText,
            currentPlanQAPairs,
            addToast,
            setAuthMode,
            setCurrentPlannedPrompt,
            setCurrentPlanText,
            setCurrentPlanQAPairs,
            setPlanRefineMode,
            setPlanWorkflow,
            setIsStreaming,
            setActiveMessages,
            setStaticMessages,
        ]
    )

    const handleContextSelect = () => {}

    const handleStartVoice = useCallback(
        async (callbacks: {
            onTranscript: (text: string, isFinal: boolean) => void
            onError: (err: Error) => void
        }) => {
            const { isVoiceConfigured, getVoiceSetupNotice, startVoiceDictation } =
                await import('../utils/audio')
            const status = await isVoiceConfigured()

            if (!status.hasBinary) {
                const userMsg: Message = {
                    id: getNextMsgId(),
                    role: 'user',
                    displayText: '/voice',
                    text: '/voice',
                }
                const noticeMsg: Message = {
                    id: getNextMsgId(),
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: getVoiceSetupNotice(status),
                        },
                    ],
                }
                setStaticMessages((prev) => [
                    ...prev,
                    ...useCliStore.getState().activeMessages,
                    userMsg,
                    noticeMsg,
                ])
                setActiveMessages([])
                return null
            }

            if (!status.hasKey) {
                useCliStore.getState().setSelectedProvider('deepgram')
                useCliStore.getState().setApiKey('')
                useCliStore.getState().setAuthError(null)
                useCliStore.getState().setAuthMode('byok_key')
                return null
            }

            return await startVoiceDictation(callbacks)
        },
        [setStaticMessages, setActiveMessages]
    )

    return {
        onStartVoice: handleStartVoice,
        currentPlannedPrompt,
        setCurrentPlannedPrompt,
        currentPlanText,
        setCurrentPlanText,
        currentPlanQAPairs,
        setCurrentPlanQAPairs,
        planRefineMode,
        setPlanRefineMode,
        planRefineFeedback,
        setPlanRefineFeedback,
        generatePlanRefinement,
        generatePlanFromGoal,
        planWorkflow,
        setPlanWorkflow,
        interactivePlanGoalMode,
        setInteractivePlanGoalMode,
        planSummary: currentPlannedPrompt ? `Plan: ${currentPlannedPrompt}` : undefined,
        tasksData,
        tasks: tasksData,
        setTasksData,
        taskSelectedIndex,
        setTaskSelectedIndex,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
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
        authMethod,
        hasBothAuth,
        hasDecember,
        setHasDecember,
        decemberEmail,
        setDecemberEmail,
        settingsAuthPriority,
        currentEmail,
        setCurrentEmail,
        authMode,
        previousAuthMode,
        setAuthMode,
        helpInitialTab,
        setHelpInitialTab,
        memoryInitialTab,
        setMemoryInitialTab,
        logoutItems,
        setLogoutItems,
        switchItems,
        setSwitchItems,
        selectedProvider,
        setSelectedProvider,
        apiKey,
        setApiKey,
        authError,
        setAuthError,
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
        settingsPathGuard,
        setSettingsPathGuard,
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsThinkingLevel,
        setSettingsThinkingLevel,
        settingsSteeringMode,
        setSettingsSteeringMode,
        settingsFollowUpMode,
        setSettingsFollowUpMode,
        settingsBrowserVisible,
        setSettingsBrowserVisible,
        handleSubmit,
        sessionRepository,
        handleSettingsMainSelect,
        handleReasoningSelect,
        handleAuthMenuSelect,
        handleModelSelect,
        handleSessionSelect,
        handlePlanApprovalSelect,
        handleProviderSelect,
        handleByokSelect,
        handleSubscriptionSelect,
        handleKeySubmit,
        handleLogoutSelect,
        handleDeleteProvider,
        handleSwitchSelect,
        pendingQuestions,
        setPendingQuestions,
        getProviderModels,
        handleAbort,
        handleKillTask,
        handleClearCompletedTasks,
        handleRemoveTask,
        handleKillAllTasks,
        toasts,
        addToast,
        expandCommands,
        toggleExpandCommands,
        queuedPrompts,
        setQueuedPrompts,
        pendingToolCall,
        setPendingToolCall,
        activeModel,
        setActiveModel,
        detectedSubscriptions,
        configuredProviders,
        configuredSubscriptions,
        unlinkedSubscriptions,
        usageData,
        setUsageData,
        handleRefreshUsage: fetchUsageData,
        handleOpenBilling,
        onRefresh: fetchUsageData,
        onOpenBilling: handleOpenBilling,
        isInline: useCliStore((state) => state.isInline),
        setIsInline: useCliStore((state) => state.setIsInline),
        handleOpenDeviceAuthUrl,
        handleAbortAuth,
        pendingDeviceAuthUrl: useCliStore((state) => state.pendingDeviceAuthUrl),
        setPendingDeviceAuthUrl: useCliStore((state) => state.setPendingDeviceAuthUrl),
        btwState,
        handleDismissBtw,
        handleSideQuestion,
        rewindItems,
        setRewindItems,
        onSelectTurn: handleRewindSelect,
        handleRewindSelect,
        codeSearchQuery,
        codeSearchResults,
        onOpenCodeSearchResult: handleCodeSearchOpen,
        onInsertCodeSearchResult: handleCodeSearchInsert,
        prefillPrompt,
        onClearPrefillPrompt,
        fileViewTarget,
        filePath: fileViewTarget?.filePath,
        initialLine: fileViewTarget?.initialLine,
        onCloseFileView: handleFileViewClose,
        onInsertContext: handleFileViewInsertContext,
    }
}
