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

const getProviderModels = (provider: string) => {
    switch (provider) {
        case 'anthropic':
            return [
                { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-latest' },
                { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' },
                { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
            ]
        case 'google':
            return [
                { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
                { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro' },
                { label: 'Gemini 3 Pro Preview', value: 'gemini-3-pro-preview' },
                { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            ]
        case 'openai':
            return [
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            ]
        case 'openrouter':
            return [
                { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
                { label: 'Google: Gemini 1.5 Pro', value: 'google/gemini-1.5-pro' },
                { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
                { label: 'Meta: Llama 3 70B', value: 'meta-llama/llama-3-70b-instruct' },
            ]
        case 'deepseek':
            return [
                { label: 'DeepSeek Chat', value: 'deepseek-chat' },
                { label: 'DeepSeek Coder', value: 'deepseek-coder' },
            ]
        case 'groq':
            return [
                { label: 'Llama 3 8B', value: 'llama3-8b-8192' },
                { label: 'Llama 3 70B', value: 'llama3-70b-8192' },
                { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
            ]
        case 'huggingface':
            return [{ label: 'Llama 3 8B Instruct', value: 'meta-llama/Meta-Llama-3-8B-Instruct' }]
        case 'kimi':
        case 'moonshoot':
            return [
                { label: 'Moonshot v1 8K', value: 'moonshot-v1-8k' },
                { label: 'Moonshot v1 32K', value: 'moonshot-v1-32k' },
            ]
        case 'mistral':
            return [
                { label: 'Mistral Large', value: 'mistral-large-latest' },
                { label: 'Mistral Small', value: 'mistral-small-latest' },
            ]
        case 'xai':
            return [{ label: 'Grok Beta', value: 'grok-beta' }]
        case 'zai':
            return [{ label: 'ZAI v1', value: 'zai-v1' }]
        default:
            return [{ label: 'Default', value: 'default' }]
    }
}

const getModelLabel = (value: string) => {
    const allProviders = [
        'anthropic',
        'google',
        'openai',
        'openrouter',
        'deepseek',
        'groq',
        'huggingface',
        'kimi',
        'mistral',
        'xai',
        'zai',
    ]
    for (const p of allProviders) {
        const models = getProviderModels(p)
        const found = models.find((m) => m.value === value)
        if (found) return found.label
    }
    return value
}

const getModelContextWindow = (value: string) => {
    if (value.includes('gemini')) return 1000000
    if (value.includes('claude')) return 200000
    if (value.includes('gpt-4')) return 128000
    if (value.includes('gpt-3.5')) return 16385
    if (value.includes('32k')) return 32768
    if (value.includes('8192')) return 8192
    if (value.includes('8k')) return 8192
    return 100000
}

import { MessageList } from './chat/components/message-list'
import type { AuthMode, Message } from './chat/types'
import { InputBar } from '../components/input-bar'
import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { useToast } from '../providers/toast'

function parseErrorMessage(err: any): string {
    let errMsg = ''
    try {
        errMsg = err?.message || String(err)
        if (typeof errMsg !== 'string') {
            errMsg = JSON.stringify(errMsg)
        }
    } catch (e) {
        return 'Unknown error occurred.'
    }

    const extractMessage = (str: string): string | null => {
        if (!str) return null

        // 1. Try regex extraction first, since it's the most robust against broken JSON
        const msgMatch = str.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (msgMatch) {
            try {
                return JSON.parse(`"${msgMatch[1]}"`)
            } catch (e) {
                return msgMatch[1]
            }
        }

        // 2. Try JSON parse
        try {
            const parsed = JSON.parse(str)
            if (parsed && typeof parsed === 'object') {
                // If the error field itself is a stringified JSON, recurse
                if (typeof parsed.error === 'string' && parsed.error.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.error)
                    if (extracted) return extracted
                }
                if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.message)
                    if (extracted) return extracted
                }

                // Normal object access
                if (typeof parsed.error?.message === 'string') return parsed.error.message
                if (typeof parsed.message === 'string') return parsed.message
                if (typeof parsed.error === 'string') return parsed.error
            }
        } catch (e) {}

        // 3. Try JSON block extraction
        const firstBrace = str.indexOf('{')
        const lastBrace = str.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = str.slice(firstBrace, lastBrace + 1)
            try {
                const parsed = JSON.parse(jsonStr)
                if (parsed?.error?.message && typeof parsed.error.message === 'string')
                    return parsed.error.message
                if (parsed?.message && typeof parsed.message === 'string') return parsed.message
            } catch (e) {}
        }

        return null
    }

    const extracted = extractMessage(errMsg)
    if (extracted) return extracted

    return errMsg.replace(/^\[.*?Error\]:\s*/, '').trim()
}

import type { MessageBlock } from '../components/messages/bot-message'

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

const FALLBACK_OPENROUTER_MODELS = [
    { label: '(free) Google: Gemma 2 9B', value: 'google/gemma-2-9b-it:free' },
    { label: '(free) Meta: Llama 3 8B Instruct', value: 'meta-llama/llama-3-8b-instruct:free' },
    {
        label: '(free) Microsoft: Phi 3 Medium 128K Instruct',
        value: 'microsoft/phi-3-medium-128k-instruct:free',
    },
    { label: 'Google: Gemini 2.5 Flash', value: 'google/gemini-2.5-flash' },
    { label: 'Google: Gemini 2.5 Pro', value: 'google/gemini-2.5-pro' },
    { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'Meta: Llama 3.3 70B Instruct', value: 'meta-llama/llama-3.3-70b-instruct' },
]

let msgId = 0

export function Chat({
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
    const cols = useTerminalColumns()
    const panelWidth = Math.floor(cols * 0.45)

    const toast = useToast()
    const [currentPlannedPrompt, setCurrentPlannedPrompt] = useState<string | null>(null)
    const [planModeInput, setPlanModeInput] = useState('')
    const [grillModeInput, setGrillModeInput] = useState('')

    const [tasksData, setTasksData] = useState<BackgroundTask[]>([])
    const [taskSelectedIndex, setTaskSelectedIndex] = useState(0)
    const [taskViewingId, setTaskViewingId] = useState<string | null>(null)
    const [taskScrollOffset, setTaskScrollOffset] = useState(0)

    const [grillQuestions, setGrillQuestions] = useState<{ question: string; options: string[] }[]>(
        []
    )
    const [currentGrillIndex, setCurrentGrillIndex] = useState(0)
    const [grillAnswers, setGrillAnswers] = useState<string[]>([])
    const [grillPrompt, setGrillPrompt] = useState<string | null>(null)
    const [customInputMode, setCustomInputMode] = useState(false)
    const [customAnswer, setCustomAnswer] = useState('')

    const [staticMessages, setStaticMessages] = useState<Message[]>([
        { id: 'header', role: 'header' },
    ])
    const [staticKey, setStaticKey] = useState(0)
    const [activeMessages, setActiveMessages] = useState<Message[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const { exit } = useApp()

    const [isAuthenticated, setIsAuthenticated] = useState(initialAuth)
    const [currentEmail, setCurrentEmail] = useState<string | undefined>(userEmail)
    const [authMode, setAuthMode] = useState<AuthMode>('none')

    // Hooks state
    const [selectedHookType, setSelectedHookType] = useState<string | null>(null)
    const [hookMatchers, setHookMatchers] = useState<
        Record<string, { pattern: string; enabled: boolean }[]>
    >({})
    const [addingMatcher, setAddingMatcher] = useState(false)
    const [newMatcherRegex, setNewMatcherRegex] = useState('')
    const [matcherIndex, setMatcherIndex] = useState(0)

    const [logoutItems, setLogoutItems] = useState<{ label: string; value: string }[]>([])
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [apiKey, setApiKey] = useState('')
    const [openRouterModels, setOpenRouterModels] = useState<
        { label: string; value: string }[] | null
    >(null)
    const [sessionItems, setSessionItems] = useState<{ label: string; value: string }[]>([])
    const [sessionsData, setSessionsData] = useState<SessionInfo[]>([])
    const [sessionPage, setSessionPage] = useState(0)
    const [sessionSelectedIndex, setSessionSelectedIndex] = useState(0)
    const [sessionRenameMode, setSessionRenameMode] = useState(false)
    const [sessionNewName, setSessionNewName] = useState('')

    const [settingsNonWorkspace, setSettingsNonWorkspace] = useState(false)
    const [settingsNotifications, setSettingsNotifications] = useState(false)
    const [settingsShowTasks, setSettingsShowTasks] = useState(true)
    const [settingsShowTips, setSettingsShowTips] = useState(true)
    const [settingsToolPermission, setSettingsToolPermission] = useState<
        'always-proceed' | 'always-ask'
    >('always-proceed')
    const [settingsTelemetry, setSettingsTelemetry] = useState(true)
    const [settingsAutoUpdate, setSettingsAutoUpdate] = useState(true)

    useEffect(() => {
        if (authMode === 'model_select' && selectedProvider === 'openrouter') {
            fetch('https://openrouter.ai/api/v1/models')
                .then((res) => res.json())
                .then((data) => {
                    const models = data.data.map((m: any) => {
                        const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0'
                        return {
                            label: isFree ? `(free) ${m.name}` : m.name,
                            value: m.id,
                        }
                    })
                    models.sort((a: any, b: any) => {
                        if (a.label.startsWith('(free)') && !b.label.startsWith('(free)')) return -1
                        if (!a.label.startsWith('(free)') && b.label.startsWith('(free)')) return 1
                        return a.label.localeCompare(b.label)
                    })
                    setOpenRouterModels(models)
                })
                .catch(() => {
                    setOpenRouterModels(FALLBACK_OPENROUTER_MODELS)
                })
        }
    }, [authMode, selectedProvider])

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
                    toast.show({ variant: 'success', message: `Task ${currentTask.id} killed.` })
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
            } else if (authMode === 'plan_mode' || authMode === 'grill_mode') {
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
                authMode === 'tasks_mode'
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
                            content: '⏳ *Analyzing prompt and generating grill questions...*',
                        },
                    ],
                },
            ])

            try {
                const prompt = `You are a product manager interviewing a developer.
The user wants to implement: "${userPrompt}"
Generate 5 to 8 questions to clarify the requirements and align on a detailed implementation plan.
Each question must have exactly 3 options.
Return the output as a strict JSON array of objects with the following schema:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3"]
  }
]
Do not include any other text, markdown formatting, or code blocks. Return raw JSON only.`

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

            const planPrompt = `You are an autonomous software engineer.
The user wants to implement: "${originalPrompt}"
Here is the alignment interview results:
${grillQuestions.map((q, i) => `Q: ${q.question}\nA: ${answers[i]}`).join('\n\n')}

Please create a detailed, step-by-step implementation plan based on these requirements.
Do NOT execute any tools. Only describe the plan.
Start your response with '### Implementation Plan' and list the concrete steps.
Explain which files need to be created, modified, or deleted, and what the changes will be.`

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

            let isPlanningTurn = false

            if (text.trim().startsWith('/plan')) {
                const parts = text.trim().split(/\s+/)
                if (parts.length === 1) {
                    setAuthMode('plan_mode')
                    return
                } else {
                    // Update text to be just the prompt, and override isPlanningTurn locally
                    text = text.trim().slice(5).trim()
                    isPlanningTurn = true
                }
            }

            if (text.trim().startsWith('/grill-me')) {
                const parts = text.trim().split(/\s+/)
                if (parts.length === 1) {
                    setAuthMode('grill_mode')
                } else {
                    const grillPromptText = text.trim().slice(9).trim()
                    await generateGrillQuestions(grillPromptText)
                }
                return
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
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                { id: ++msgId, role: 'user', text },
                { id: ++msgId, role: 'assistant', blocks: [] },
            ])

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
            toast.show({ variant: 'success', message: `Default model updated to ${model}` })
        } else if (item.value.startsWith('tokens:')) {
            const tokens = parseInt(item.value.split(':')[1], 10)
            setSettingsMaxTokens(tokens)
            toast.show({ variant: 'success', message: `Max tokens set to ${tokens}` })
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
                                content: `Successfully logged in via December!`,
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
                                content: `Successfully logged in via device code!`,
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
                        blocks: [{ type: 'text', content: '❌ *Plan rejected by user.*' }],
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
                            label: `Successfully validated and saved API key for ${selectedProvider}!`,
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

    let authUI: React.ReactNode = null
    if (authMode === 'menu') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select authentication method:</Text>
                </Box>
                <SelectInput
                    items={[
                        { label: 'Login via December (Cloud Wallet)', value: 'december' },
                        { label: 'Bring Your Own Key (BYOK)', value: 'byok' },
                    ]}
                    onSelect={handleAuthMenuSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'december_login_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select December login method:</Text>
                </Box>
                <SelectInput
                    items={[
                        { label: 'Login via Browser (Local)', value: 'december_browser' },
                        {
                            label: 'Login via Device Code (Headless/SSH)',
                            value: 'december_headless',
                        },
                    ]}
                    onSelect={handleAuthMenuSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'byok_provider') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select API Provider:</Text>
                </Box>
                <SelectInput
                    items={[
                        { label: 'Anthropic', value: 'anthropic' },
                        { label: 'DeepSeek', value: 'deepseek' },
                        { label: 'Google', value: 'google' },
                        { label: 'Groq', value: 'groq' },
                        { label: 'Hugging Face', value: 'huggingface' },
                        { label: 'Kimi', value: 'kimi' },
                        { label: 'Mistral', value: 'mistral' },
                        { label: 'Moonshoot AI', value: 'moonshoot' },
                        { label: 'OpenAI', value: 'openai' },
                        { label: 'OpenRouter', value: 'openrouter' },
                        { label: 'xAI', value: 'xAI' },
                        { label: 'ZAI', value: 'zai' },
                    ]}
                    onSelect={handleProviderSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'byok_key') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Enter API Key for {selectedProvider}:</Text>
                </Box>
                <Box>
                    <Text color="#89B4F8" bold={false}>
                        ❭{' '}
                    </Text>
                    <TextInput
                        value={apiKey}
                        onChange={setApiKey}
                        onSubmit={handleKeySubmit}
                        mask="*"
                    />
                </Box>
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Submit</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'model_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select Model:</Text>
                </Box>
                <SelectInput
                    items={
                        selectedProvider === 'openrouter'
                            ? openRouterModels || [{ label: 'Loading models...', value: 'loading' }]
                            : getProviderModels(selectedProvider)
                    }
                    onSelect={handleModelSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'context_select') {
        const activeModelId = agent.modelOptions?.model || 'gemini-3.5-flash'
        const currentModelName = getModelLabel(activeModelId)
        const maxTokens = getModelContextWindow(activeModelId)

        const userTokens = Math.round(
            agent.messages
                .filter((m) => m.role === 'user')
                .reduce((acc, m) => acc + (m.content?.length || 0) / 4, 0)
        )
        const agentTokens = Math.round(
            agent.messages
                .filter((m) => m.role === 'assistant')
                .reduce((acc, m) => acc + (m.content?.length || 0) / 4, 0)
        )
        const toolTokens = Math.round(
            agent.messages.reduce(
                (acc, m) => acc + (m.toolCalls ? JSON.stringify(m.toolCalls).length / 4 : 0),
                0
            )
        )
        const sysTokens = Math.round((agent.systemPrompt?.length || 0) / 4)
        const totalTokens = userTokens + agentTokens + toolTokens + sysTokens
        const freeTokens = Math.max(0, maxTokens - totalTokens)

        const pct = (n: number) => ((n / maxTokens) * 100).toFixed(1)
        const formatK = (n: number) => (n > 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString())

        const totalSquares = 200
        const squares = []
        let filled = 0
        const addSquares = (count: number, char: string, color: string) => {
            for (let i = 0; i < count && filled < totalSquares; i++) {
                squares.push(
                    <Text key={filled} color={color}>
                        {char}
                    </Text>
                )
                filled++
            }
        }
        addSquares(Math.round((userTokens / maxTokens) * totalSquares), '●', '#89B4F8') // blue
        addSquares(Math.round((agentTokens / maxTokens) * totalSquares), '●', '#6EE7B7') // green
        addSquares(Math.round((toolTokens / maxTokens) * totalSquares), '●', '#FCD34D') // yellow
        addSquares(Math.round((sysTokens / maxTokens) * totalSquares), '●', '#AAAAAA') // grey

        while (filled < totalSquares) {
            squares.push(
                <Text key={filled} color="#444444">
                    □
                </Text>
            )
            filled++
        }

        const gridRows = []
        for (let i = 0; i < totalSquares; i += 20) {
            gridRows.push(
                <Box key={i} gap={1}>
                    {squares.slice(i, i + 20)}
                </Box>
            )
        }

        authUI = (
            <Box flexDirection="row" paddingX={1} gap={4}>
                <Box flexDirection="column">{gridRows}</Box>

                <Box flexDirection="column">
                    <Box gap={1}>
                        <Text color="#AAAAAA">
                            {currentModelName} · {formatK(totalTokens)}/{formatK(maxTokens)} tokens
                            ({pct(totalTokens)}%)
                        </Text>
                    </Box>
                    <Text color="white" marginTop={1}>
                        Token usage by category
                    </Text>
                    <Box flexDirection="column">
                        <Box gap={1}>
                            <Text color="#89B4F8">●</Text>
                            <Text color="#AAAAAA">
                                User messages: {formatK(userTokens)} tokens ({pct(userTokens)}%)
                            </Text>
                        </Box>
                        <Box gap={1}>
                            <Text color="#6EE7B7">●</Text>
                            <Text color="#AAAAAA">
                                Agent responses: {formatK(agentTokens)} tokens ({pct(agentTokens)}%)
                            </Text>
                        </Box>
                        <Box gap={1}>
                            <Text color="#FCD34D">●</Text>
                            <Text color="#AAAAAA">
                                Tool calls: {formatK(toolTokens)} tokens ({pct(toolTokens)}%)
                            </Text>
                        </Box>
                        <Box gap={1}>
                            <Text color="#AAAAAA">●</Text>
                            <Text color="#AAAAAA">
                                System prompt: {formatK(sysTokens)} tokens ({pct(sysTokens)}%)
                            </Text>
                        </Box>
                        <Box gap={1}>
                            <Text color="#444444">□</Text>
                            <Text color="#AAAAAA">
                                Free space: {formatK(freeTokens)} ({pct(freeTokens)}%)
                            </Text>
                        </Box>
                    </Box>
                    <Box marginTop={2} gap={1}>
                        <Text color="#AAAAAA">Press</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">to go back</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'logout_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select credential to remove:</Text>
                </Box>
                <SelectInput
                    items={logoutItems}
                    onSelect={(item) => handleLogoutSelect(item.value)}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'session_select') {
        const SESSION_PAGE_SIZE = 10
        const totalItems = sessionsData.length
        const maxPage = Math.max(0, Math.ceil(totalItems / SESSION_PAGE_SIZE) - 1)
        const startIndex = sessionPage * SESSION_PAGE_SIZE
        const visibleItems = sessionsData.slice(startIndex, startIndex + SESSION_PAGE_SIZE)

        const timeAgo = (date: Date) => {
            const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
            if (seconds < 60) return `${seconds}s ago`
            const minutes = Math.floor(seconds / 60)
            if (minutes < 60) return `${minutes}m ago`
            const hours = Math.floor(minutes / 60)
            if (hours < 24) return `${hours}h ago`
            const days = Math.floor(hours / 24)
            return `${days}d ago`
        }

        const handleRenameSubmit = (val: string) => {
            const absIndex = startIndex + sessionSelectedIndex
            const session = sessionsData[absIndex]
            const newName = val.trim()
            if (session && newName && newName !== session.id) {
                if (sessionRepository?.renameSession) {
                    sessionRepository.renameSession(session.id, newName).then(() => {
                        const nextData = [...sessionsData]
                        nextData[absIndex] = { ...session, id: newName, preview: newName }
                        setSessionsData(nextData)
                    })
                }
            }
            setSessionRenameMode(false)
            setSessionNewName('')
        }

        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Conversations
                    </Text>
                </Box>
                {visibleItems.map((session, idx) => {
                    const isSelected = idx === sessionSelectedIndex

                    if (isSelected && sessionRenameMode) {
                        return (
                            <Box key={session.id} flexDirection="row">
                                <Box width={2}>
                                    <Text color="#89B4F8">{'> '}</Text>
                                </Box>
                                <TextInput
                                    value={sessionNewName}
                                    onChange={setSessionNewName}
                                    onSubmit={handleRenameSubmit}
                                />
                            </Box>
                        )
                    }

                    const title = session.preview || session.id
                    const msgCount = `${session.messageCount} msgs`.padStart(10)
                    const timeStr = timeAgo(session.updatedAt).padStart(10)

                    return (
                        <Box key={session.id} flexDirection="row">
                            <Box width={2}>
                                <Text color={isSelected ? '#89B4F8' : 'white'}>
                                    {isSelected ? '> ' : '  '}
                                </Text>
                            </Box>
                            <Box width={85}>
                                <Text color={isSelected ? 'white' : '#AAAAAA'} wrap="truncate">
                                    {title}
                                </Text>
                            </Box>
                            <Box width={12}>
                                <Text color="#AAAAAA">{msgCount}</Text>
                            </Box>
                            <Box width={12}>
                                <Text color="#AAAAAA">{timeStr}</Text>
                            </Box>
                        </Box>
                    )
                })}

                {totalItems === 0 && (
                    <Box paddingLeft={2}>
                        <Text color="#555555">No conversations found.</Text>
                    </Box>
                )}

                {totalItems > 0 && (
                    <Box marginTop={1} paddingLeft={2}>
                        <Text color="#555555">
                            [{startIndex + 1}-{Math.min(startIndex + SESSION_PAGE_SIZE, totalItems)}{' '}
                            of {totalItems} items]
                        </Text>
                    </Box>
                )}

                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#AAAAAA">Keyboard:</Text>
                        <Text color="#89B4F8">↑/↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">←/→</Text>
                        <Text color="#AAAAAA">Page</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">f2</Text>
                        <Text color="#AAAAAA">Rename</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">ctrl+delete</Text>
                        <Text color="#AAAAAA">Delete</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">tab</Text>
                        <Text color="#AAAAAA">Switch Tab</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Go back</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'tasks_mode') {
        const getStatusColor = (status: string) => {
            switch (status) {
                case 'running':
                    return '#2ECC71'
                case 'completed':
                    return '#3498DB'
                case 'failed':
                    return '#E74C3C'
                case 'killed':
                    return '#F1C40F'
                default:
                    return 'white'
            }
        }

        if (taskViewingId) {
            const task = tasksData.find((t) => t.id === taskViewingId)
            if (task) {
                const outputLines = task.output.split('\n')
                const visibleLines = outputLines.slice(taskScrollOffset, taskScrollOffset + 15)
                authUI = (
                    <Box flexDirection="column" paddingX={1}>
                        <Box marginBottom={1} justifyContent="space-between">
                            <Text bold color="white">
                                Task: {task.id}
                            </Text>
                            <Text bold color={getStatusColor(task.status)}>
                                [{task.status.toUpperCase()}]
                            </Text>
                        </Box>
                        <Box marginBottom={1}>
                            <Text color="#AAAAAA" bold>
                                Cmd: {task.command}
                            </Text>
                        </Box>
                        <Box
                            borderColor="#333333"
                            borderStyle="round"
                            flexDirection="column"
                            minHeight={8}
                            paddingX={1}
                        >
                            {visibleLines.length === 0 ||
                            (visibleLines.length === 1 && visibleLines[0] === '') ? (
                                <Text color="gray">[No output recorded yet]</Text>
                            ) : (
                                visibleLines.map((line, idx) => (
                                    <Text key={idx} color="white">
                                        {line}
                                    </Text>
                                ))
                            )}
                        </Box>
                        <Box marginTop={1} justifyContent="space-between">
                            <Text color="gray">
                                Showing lines {Math.min(outputLines.length, taskScrollOffset + 1)}-
                                {Math.min(
                                    outputLines.length,
                                    taskScrollOffset + visibleLines.length
                                )}{' '}
                                of {outputLines.length}
                            </Text>
                        </Box>
                        <Box paddingTop={1}>
                            <Text color="#555555">
                                Keyboard: ↑/↓ Scroll Line · ←/→ Page · esc Back
                            </Text>
                        </Box>
                    </Box>
                )
            }
        } else {
            authUI = (
                <Box flexDirection="column" paddingX={1}>
                    <Box marginBottom={1}>
                        <Text bold color="white">
                            Tasks
                        </Text>
                    </Box>
                    {tasksData.length === 0 ? (
                        <Box paddingLeft={2}>
                            <Text color="#555555">No background tasks.</Text>
                        </Box>
                    ) : (
                        tasksData.map((task, idx) => {
                            const isSelected = idx === taskSelectedIndex
                            const truncatedCommand =
                                task.command.length > 50
                                    ? task.command.slice(0, 47) + '...'
                                    : task.command
                            return (
                                <Box key={task.id} flexDirection="row">
                                    <Box width={2}>
                                        <Text color={isSelected ? '#89B4F8' : 'white'}>
                                            {isSelected ? '> ' : '  '}
                                        </Text>
                                    </Box>
                                    <Box width={25}>
                                        <Text
                                            color={isSelected ? 'white' : '#AAAAAA'}
                                            wrap="truncate"
                                        >
                                            {task.id}
                                        </Text>
                                    </Box>
                                    <Box width={15}>
                                        <Text color={getStatusColor(task.status)}>
                                            [{task.status.toUpperCase()}]
                                        </Text>
                                    </Box>
                                    <Box>
                                        <Text color={isSelected ? 'white' : 'gray'}>
                                            {truncatedCommand}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })
                    )}
                    <Box paddingTop={1}>
                        <Box gap={1}>
                            <Text color="#AAAAAA">Keyboard:</Text>
                            <Text color="#89B4F8">↑/↓</Text>
                            <Text color="#AAAAAA">Navigate</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">←/→</Text>
                            <Text color="#AAAAAA">Page</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">enter</Text>
                            <Text color="#AAAAAA">View output</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">k</Text>
                            <Text color="#AAAAAA">Kill Task</Text>
                        </Box>
                    </Box>
                </Box>
            )
        }
    } else if (authMode === 'plan_mode') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        Plan Mode
                    </Text>
                    <Text color="#AAAAAA">{' Describe what you want to plan...'}</Text>
                </Box>
                <Box paddingLeft={1} paddingBottom={1} width="100%">
                    <Text color="#89B4F8"> {'>'} </Text>
                    <TextInput
                        value={planModeInput}
                        onChange={setPlanModeInput}
                        onSubmit={(val) => {
                            if (!val.trim()) return
                            setAuthMode('none')
                            setPlanModeInput('')
                            handleSubmit(`/plan ${val.trim()}`)
                        }}
                    />
                </Box>
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Submit</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'grill_mode') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        Grill Mode
                    </Text>
                    <Text color="#AAAAAA">{' Describe what you want to be grilled about...'}</Text>
                </Box>
                <Box paddingLeft={1} paddingBottom={1} width="100%">
                    <Text color="#89B4F8"> {'>'} </Text>
                    <TextInput
                        value={grillModeInput}
                        onChange={setGrillModeInput}
                        onSubmit={(val) => {
                            if (!val.trim()) return
                            setAuthMode('none')
                            setGrillModeInput('')
                            handleSubmit(`/grill-me ${val.trim()}`)
                        }}
                    />
                </Box>
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Submit</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Cancel</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'plan_approve') {
        const planItems = [
            { label: 'Approve and Execute', value: 'approve' },
            { label: 'Reject / Cancel', value: 'reject' },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="#F1C40F" bold>
                        Plan generated. Please approve or reject:
                    </Text>
                </Box>
                <SelectInput
                    items={planItems}
                    onSelect={handlePlanApprovalSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Select</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'grill_question') {
        const q = grillQuestions[currentGrillIndex]
        if (q) {
            const items = [
                ...q.options.map((opt, i) => ({ label: `${i + 1}. ${opt}`, value: opt })),
                { label: `${q.options.length + 1}. Write-in...`, value: 'custom' },
            ]
            authUI = (
                <Box flexDirection="column" paddingX={1}>
                    <Box marginBottom={1} flexDirection="column">
                        <Text color="#89B4F8" bold>
                            Question {currentGrillIndex + 1}/{grillQuestions.length}:
                        </Text>
                        <Text color="white" bold>
                            {q.question}
                        </Text>
                    </Box>
                    {!customInputMode ? (
                        <>
                            <SelectInput
                                items={items}
                                onSelect={handleGrillSelect}
                                indicatorComponent={CustomIndicator}
                                itemComponent={CustomItem}
                            />
                            <Box paddingTop={1}>
                                <Box gap={1}>
                                    <Text color="#89B4F8">↑↓</Text>
                                    <Text color="#AAAAAA">Navigate</Text>
                                    <Text color="#AAAAAA">·</Text>
                                    <Text color="#89B4F8">enter</Text>
                                    <Text color="#AAAAAA">Select</Text>
                                    <Text color="#AAAAAA">·</Text>
                                    <Text color="#89B4F8">esc</Text>
                                    <Text color="#AAAAAA">Cancel Grill</Text>
                                </Box>
                            </Box>
                        </>
                    ) : (
                        <Box flexDirection="column" gap={1}>
                            <Box flexDirection="row" gap={1}>
                                <Text color="#89B4F8">Your answer:</Text>
                                <TextInput
                                    value={customAnswer}
                                    onChange={setCustomAnswer}
                                    onSubmit={(value) => {
                                        const answer = value.trim()
                                        if (answer.length === 0) return

                                        setCustomInputMode(false)
                                        setCustomAnswer('')

                                        const nextAnswers = [...grillAnswers, answer]
                                        setGrillAnswers(nextAnswers)

                                        if (currentGrillIndex + 1 < grillQuestions.length) {
                                            setCurrentGrillIndex(currentGrillIndex + 1)
                                        } else {
                                            void generatePlanFromGrill(nextAnswers)
                                        }
                                    }}
                                />
                            </Box>
                            <Box paddingTop={1}>
                                <Box gap={1}>
                                    <Text color="#89B4F8">enter</Text>
                                    <Text color="#AAAAAA">Submit</Text>
                                    <Text color="#AAAAAA">·</Text>
                                    <Text color="#89B4F8">esc</Text>
                                    <Text color="#AAAAAA">Back</Text>
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Box>
            )
        }
    } else if (authMode === 'settings_main') {
        const mainItems = [
            {
                label: `Non-Workspace Access     [${settingsNonWorkspace ? 'on' : 'off'}]`,
                value: 'nonWorkspaceAccess',
            },
            {
                label: `Notifications            [${settingsNotifications ? 'on' : 'off'}]`,
                value: 'notifications',
            },
            {
                label: `Show Active Tasks        [${settingsShowTasks ? 'on' : 'off'}]`,
                value: 'showActiveTasks',
            },
            {
                label: `Show Tips                [${settingsShowTips ? 'on' : 'off'}]`,
                value: 'showTips',
            },
            {
                label: `Tool Permission          [${settingsToolPermission}]`,
                value: 'toolPermission',
            },
            {
                label: `Telemetry                [${settingsTelemetry ? 'on' : 'off'}]`,
                value: 'telemetry',
            },
            {
                label: `Auto Update              [${settingsAutoUpdate ? 'on' : 'off'}]`,
                value: 'autoUpdate',
            },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Settings
                    </Text>
                </Box>
                <SelectInput
                    items={mainItems}
                    onSelect={handleSettingsMainSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Toggle</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Close</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'hooks') {
        const hookItems = [
            { label: 'PreToolUse', value: 'PreToolUse', description: 'Before tool execution' },
            { label: 'PostToolUse', value: 'PostToolUse', description: 'After tool execution' },
            {
                label: 'PreInvocation',
                value: 'PreInvocation',
                description: 'Before each LLM invocation',
            },
            {
                label: 'PostInvocation',
                value: 'PostInvocation',
                description: 'After each LLM invocation',
            },
            { label: 'Stop', value: 'Stop', description: 'When agent tries to exit' },
        ]

        if (!selectedHookType) {
            const HookCustomItem = ({ label }: { label?: string }) => {
                const item = hookItems.find((i) => i.label === label)
                return (
                    <Box>
                        <Box width={16}>
                            <Text color={item ? 'white' : '#AAAAAA'}>{label}</Text>
                        </Box>
                        <Text color="#AAAAAA">{item?.description}</Text>
                    </Box>
                )
            }

            const handleHookSelect = (item: any) => {
                setSelectedHookType(item.value)
                setMatcherIndex(0)
            }

            authUI = (
                <Box flexDirection="column">
                    <Box paddingLeft={2} paddingBottom={1} flexDirection="column">
                        <Text bold color="white">
                            {' '}
                            Hooks
                        </Text>
                        <Text color="#AAAAAA"> 5 hook types</Text>
                    </Box>

                    <Box paddingLeft={2}>
                        <SelectInput
                            items={hookItems}
                            onSelect={handleHookSelect}
                            indicatorComponent={CustomIndicator}
                            itemComponent={HookCustomItem}
                        />
                    </Box>

                    <Box paddingLeft={2} paddingTop={1} paddingBottom={1}>
                        <Box gap={1}>
                            <Text color="#89B4F8">↑/↓</Text>
                            <Text color="#AAAAAA">Navigate</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">enter</Text>
                            <Text color="#AAAAAA">Select</Text>
                        </Box>
                    </Box>
                </Box>
            )
        } else if (addingMatcher) {
            const hookDesc = hookItems.find((h) => h.value === selectedHookType)?.description || ''

            const handleAddMatcherSubmit = (val: string) => {
                if (val.trim()) {
                    setHookMatchers((prev) => {
                        const existing = prev[selectedHookType] || []
                        return {
                            ...prev,
                            [selectedHookType]: [...existing, { pattern: val, enabled: true }],
                        }
                    })
                    toast.show({ message: `Added matcher: ${val}` })
                }
                setAddingMatcher(false)
                setNewMatcherRegex('')
            }

            authUI = (
                <Box flexDirection="column">
                    <Box paddingLeft={2} paddingBottom={1} flexDirection="column">
                        <Text bold color="white">
                            {' '}
                            Add new matcher for {selectedHookType}
                        </Text>
                        <Text color="#AAAAAA"> {hookDesc}</Text>
                    </Box>

                    <Box paddingLeft={2} paddingBottom={1}>
                        <Text color="white">Matcher:</Text>
                    </Box>

                    <Box paddingLeft={2} paddingBottom={1}>
                        <Text color="#89B4F8"> {'>'} </Text>
                        <TextInput
                            value={newMatcherRegex}
                            onChange={setNewMatcherRegex}
                            onSubmit={handleAddMatcherSubmit}
                        />
                    </Box>

                    <Box paddingLeft={2} paddingBottom={1} flexDirection="column">
                        <Text color="#AAAAAA">Examples:</Text>
                        <Text color="#AAAAAA">• Write (single tool)</Text>
                        <Text color="#AAAAAA">• Write|Edit (multiple tools)</Text>
                        <Text color="#AAAAAA">• Web.* (regex pattern)</Text>
                    </Box>

                    <Box paddingLeft={2} paddingTop={1} paddingBottom={1}>
                        <Box gap={1}>
                            <Text color="#89B4F8">enter</Text>
                            <Text color="#AAAAAA">Confirm</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">esc</Text>
                            <Text color="#AAAAAA">Cancel</Text>
                        </Box>
                    </Box>
                </Box>
            )
        } else {
            const hookDesc = hookItems.find((h) => h.value === selectedHookType)?.description || ''
            const matchers = hookMatchers[selectedHookType] || []

            const matcherItems = [
                { label: '+ Add new matcher...', value: 'add_new' },
                { label: '+ Match all (no filter)', value: 'match_all' },
            ]

            matchers.forEach((m, idx) => {
                matcherItems.push({
                    label: `${m.enabled ? '✓' : '✗'} ${m.pattern}`,
                    value: `matcher_${idx}`,
                })
            })

            authUI = (
                <Box flexDirection="column">
                    <Box paddingLeft={2} paddingBottom={1} flexDirection="column">
                        <Text bold color="white">
                            {' '}
                            {selectedHookType} — Matchers
                        </Text>
                        <Text color="#AAAAAA"> {hookDesc}</Text>
                    </Box>

                    <Box paddingLeft={2} flexDirection="column">
                        {matcherItems.map((item, idx) => {
                            const isSelected = idx === matcherIndex
                            const isAdd = item.value === 'add_new' || item.value === 'match_all'
                            const isEnabled = item.label.startsWith('✓')
                            return (
                                <Box key={item.value}>
                                    <CustomIndicator isSelected={isSelected} />
                                    {isAdd ? (
                                        <Text color={isSelected ? '#89B4F8' : 'white'}>
                                            {item.label}
                                        </Text>
                                    ) : (
                                        <Text
                                            color={
                                                isSelected
                                                    ? '#89B4F8'
                                                    : isEnabled
                                                      ? 'white'
                                                      : '#555555'
                                            }
                                        >
                                            {item.label}
                                        </Text>
                                    )}
                                </Box>
                            )
                        })}
                        {matchers.length === 0 && (
                            <Box>
                                <Box marginRight={1}>
                                    <Text> </Text>
                                </Box>
                                <Text color="#555555">No hooks configured</Text>
                            </Box>
                        )}
                    </Box>

                    <Box paddingLeft={2} paddingTop={1} paddingBottom={1}>
                        <Box gap={1}>
                            <Text color="#89B4F8">↑/↓</Text>
                            <Text color="#AAAAAA">Navigate</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">enter</Text>
                            <Text color="#AAAAAA">Select</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">e</Text>
                            <Text color="#AAAAAA">Toggle</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">backspace</Text>
                            <Text color="#AAAAAA">Delete</Text>
                            <Text color="#AAAAAA">·</Text>
                            <Text color="#89B4F8">esc</Text>
                            <Text color="#AAAAAA">Back</Text>
                        </Box>
                    </Box>
                </Box>
            )
        }
    }

    return (
        <Box flexDirection="column" width="100%">
            <MessageList
                staticKey={staticKey}
                staticMessages={staticMessages}
                activeMessages={activeMessages}
                agent={agent}
                isAuthenticated={isAuthenticated}
                cliVersion={cliVersion}
                userEmail={currentEmail}
            />

            <InputBar
                onSubmit={handleSubmit}
                disabled={authMode !== 'none'}
                placeholder="Ask December to build..."
                activeModel={
                    agent.modelOptions?.model
                        ? getModelLabel(agent.modelOptions.model)
                        : getModelLabel('gemini-3.5-flash')
                }
                authUI={authUI}
                agent={agent}
                resetChat={() => {
                    console.clear()
                    setStaticMessages([{ id: `header-${Date.now()}`, role: 'header' }])
                    setStaticKey((k) => k + 1)
                    setActiveMessages([])
                }}
                customInputMode={false}
            />
        </Box>
    )
}
