import { Box, Static, useApp, Text, useInput } from 'ink'
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

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { BtwMessage } from '../components/btw-message'
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'
import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { useToast } from '../providers/toast'

function parseErrorMessage(err: any): string {
    let errMsg = err?.message || String(err)
    try {
        // Repeatedly try parsing if it's double-stringified
        let parsed = JSON.parse(errMsg)
        if (typeof parsed.error === 'string') {
            try {
                parsed = JSON.parse(parsed.error)
            } catch (e) {}
        }

        if (parsed.error?.message) {
            return typeof parsed.error.message === 'string'
                ? parsed.error.message
                : JSON.stringify(parsed.error.message)
        } else if (parsed.message) {
            return typeof parsed.message === 'string'
                ? parsed.message
                : JSON.stringify(parsed.message)
        } else if (parsed.error && typeof parsed.error === 'string') {
            return parsed.error
        }
    } catch (e) {
        // Regex fallback if it's wrapped in other text
        const match = errMsg.match(/\{[\s\S]*\}/)
        if (match) {
            try {
                let parsed = JSON.parse(match[0])
                if (typeof parsed.error === 'string') {
                    try {
                        parsed = JSON.parse(parsed.error)
                    } catch (e) {}
                }
                if (parsed.error?.message) return parsed.error.message
                if (parsed.message) return parsed.message
            } catch (e) {}
        }
    }
    return errMsg
}

import type { MessageBlock } from '../components/messages/bot-message'

import { Agent, runAgentLoop, saveConfig, loadConfig, getProviderConfig } from '@december/agent'
import type { FileSessionRepository, SessionInfo } from '@december/agent'
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

type Message = {
    id: number | string
    role: 'user' | 'assistant' | 'error' | 'header'
    text?: string
    blocks?: MessageBlock[]
    isBtw?: boolean
    btwQuery?: string
}

let msgId = 0

type AuthMode =
    | 'none'
    | 'menu'
    | 'december_login_select'
    | 'byok_provider'
    | 'byok_key'
    | 'model_select'
    | 'logout_select'
    | 'session_select'
    | 'plan_approve'
    | 'grill_question'
    | 'settings_main'
    | 'settings_agent'
    | 'settings_ui'
    | 'settings_keys'
    | 'settings_prompt'

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
    const [planMode, setPlanMode] = useState(false)
    const [currentPlannedPrompt, setCurrentPlannedPrompt] = useState<string | null>(null)

    const [grillMode, setGrillMode] = useState(false)
    const [grillQuestions, setGrillQuestions] = useState<{ question: string; options: string[] }[]>(
        []
    )
    const [currentGrillIndex, setCurrentGrillIndex] = useState(0)
    const [grillAnswers, setGrillAnswers] = useState<string[]>([])
    const [grillPrompt, setGrillPrompt] = useState<string | null>(null)
    const [customInputMode, setCustomInputMode] = useState(false)

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
    const [logoutItems, setLogoutItems] = useState<{ label: string; value: string }[]>([])
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [apiKey, setApiKey] = useState('')
    const [openRouterModels, setOpenRouterModels] = useState<
        { label: string; value: string }[] | null
    >(null)
    const [sessionItems, setSessionItems] = useState<{ label: string; value: string }[]>([])

    // Dummy settings states
    const [settingsSoundEnabled, setSettingsSoundEnabled] = useState(true)
    const [settingsDensity, setSettingsDensity] = useState<'compact' | 'spacious'>('compact')
    const [settingsDefaultModel, setSettingsDefaultModel] = useState('gemini-2.5-flash')
    const [settingsMaxTokens, setSettingsMaxTokens] = useState(4096)
    const [settingsGeminiKey, setSettingsGeminiKey] = useState('configured')
    const [settingsOpenrouterKey, setSettingsOpenrouterKey] = useState('not-configured')

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

    useInput((input, key) => {
        if (key.escape || (input === 'c' && key.ctrl)) {
            if (isStreaming) {
                agent.abort()
                setIsStreaming(false)
            } else if (authMode === 'grill_question' && customInputMode) {
                setCustomInputMode(false)
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
                authMode === 'settings_agent' ||
                authMode === 'settings_ui' ||
                authMode === 'settings_keys' ||
                authMode === 'settings_prompt'
            ) {
                setAuthMode('settings_main')
            } else if (
                authMode === 'menu' ||
                authMode === 'model_select' ||
                authMode === 'logout_select' ||
                authMode === 'session_select' ||
                authMode === 'plan_approve' ||
                authMode === 'settings_main'
            ) {
                if (authMode === 'plan_approve') {
                    setCurrentPlannedPrompt(null)
                    toast.show({ variant: 'error', message: 'Plan cancelled.' })
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

                const stream = agent.llm.stream([{ role: 'user', content: prompt }])
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
                toast.show({ variant: 'error', message: 'Failed to generate grill questions.' })
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'error',
                        text: `Failed to start interview: ${err.message}`,
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
                    const items = sessions.map((s) => {
                        const date = new Date(s.updatedAt)
                        const timeStr = date.toLocaleString()
                        const preview = s.preview ? ` — ${s.preview}` : ''
                        return {
                            label: `${s.id} (${timeStr}, ${s.messageCount} msgs)${preview}`,
                            value: s.id,
                        }
                    })
                    setSessionItems(items)
                    setAuthMode('session_select')
                })
                return
            }

            if (text.trim() === '/plan') {
                setPlanMode((prev) => {
                    const next = !prev
                    toast.show({
                        variant: 'success',
                        message: next ? 'Planning mode enabled.' : 'Planning mode disabled.',
                    })
                    return next
                })
                return
            }

            if (text.trim().startsWith('/grill-me')) {
                const parts = text.trim().split(/\s+/)
                if (parts.length === 1) {
                    setGrillMode((prev) => {
                        const next = !prev
                        toast.show({
                            variant: 'success',
                            message: next
                                ? 'Grill mode enabled. Describe what you want to grill...'
                                : 'Grill mode disabled.',
                        })
                        return next
                    })
                } else {
                    const grillPromptText = text.trim().slice(9).trim()
                    setGrillMode(false)
                    await generateGrillQuestions(grillPromptText)
                }
                return
            }

            if (text.trim() === '/settings') {
                setAuthMode('settings_main')
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

            if (text.startsWith('/btw ')) {
                const btwMsgId = ++msgId
                setActiveMessages((prev) => [
                    ...prev,
                    {
                        id: btwMsgId,
                        role: 'assistant',
                        isBtw: true,
                        btwQuery: text,
                        blocks: [{ type: 'text', content: '' }],
                    },
                ])
                ;(async () => {
                    try {
                        const messages = [
                            ...agent.convertToLlm(agent.messages),
                            { role: 'user', content: text },
                        ] as any[]
                        const stream = agent.llm.stream(messages)

                        let accumulatedText = ''
                        for await (const chunk of stream) {
                            if (chunk.type === 'text') {
                                accumulatedText += chunk.text
                                setActiveMessages((prev) =>
                                    prev.map((msg) => {
                                        if (msg.id !== btwMsgId) return msg
                                        return {
                                            ...msg,
                                            blocks: [{ type: 'text', content: accumulatedText }],
                                        }
                                    })
                                )
                            }
                        }
                    } catch (err: any) {
                        const errMsg = parseErrorMessage(err)

                        setActiveMessages((prev) =>
                            prev.map((msg) => {
                                if (msg.id !== btwMsgId) return msg
                                return {
                                    ...msg,
                                    blocks: [{ type: 'text', content: `**Error:** ${errMsg}` }],
                                }
                            })
                        )
                    }
                })()
                return
            }

            if (authMode === 'grill_question' && customInputMode) {
                setCustomInputMode(false)
                const answer = text.trim()
                const nextAnswers = [...grillAnswers, answer]
                setGrillAnswers(nextAnswers)

                if (currentGrillIndex + 1 < grillQuestions.length) {
                    setCurrentGrillIndex(currentGrillIndex + 1)
                } else {
                    await generatePlanFromGrill(nextAnswers)
                }
                return
            }

            // Normal chat logic
            if (isStreaming) {
                agent.steer({ role: 'user', content: text, isUI: true })
                setActiveMessages((prev) => [...prev, { id: ++msgId, role: 'user', text }])
                return
            }

            const isGrillTurn = grillMode
            if (isGrillTurn) {
                setGrillMode(false)
                await generateGrillQuestions(text)
                return
            }

            const isPlanningTurn = planMode

            if (isPlanningTurn) {
                setCurrentPlannedPrompt(text)
                setPlanMode(false)
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
            planMode,
            grillMode,
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

    const handleSettingsMainSelect = (item: any) => {
        setAuthMode(`settings_${item.value}` as AuthMode)
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
                        { label: 'xAI', value: 'xai' },
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
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color="white">Select a session to resume:</Text>
                </Box>
                <SelectInput
                    items={sessionItems}
                    onSelect={handleSessionSelect}
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
                ...q.options.map((opt) => ({ label: opt, value: opt })),
                { label: 'Write custom answer...', value: 'custom' },
            ]
            authUI = (
                <Box flexDirection="column" paddingX={1}>
                    <Box marginBottom={1} flexDirection="column">
                        <Text color="#89B4F8" bold>
                            [GRILL] Question {currentGrillIndex + 1} of {grillQuestions.length}:
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
                        <Box>
                            <Text color="#AAAAAA">
                                Please type your answer in the prompt bar above and press Enter.
                            </Text>
                        </Box>
                    )}
                </Box>
            )
        }
    } else if (authMode === 'settings_main') {
        const mainItems = [
            { label: '⚙️  Agent Configuration', value: 'agent' },
            { label: '🎨  Interface Settings', value: 'ui' },
            { label: '🔑  API Key Management', value: 'keys' },
            { label: '📝  View System Prompt', value: 'prompt' },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        Select Settings Category:
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
                        <Text color="#AAAAAA">Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Close</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'settings_agent') {
        const agentItems = [
            {
                label: `Default Model: [${settingsDefaultModel}]`,
                value:
                    settingsDefaultModel === 'gemini-2.5-flash'
                        ? 'model:gemini-2.5-pro'
                        : 'model:gemini-2.5-flash',
            },
            {
                label: `Max Tokens: [${settingsMaxTokens}]`,
                value: settingsMaxTokens === 4096 ? 'tokens:8192' : 'tokens:4096',
            },
            { label: '◀  Back to Categories', value: 'back' },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        ⚙️ Agent Configuration:
                    </Text>
                </Box>
                <SelectInput
                    items={agentItems}
                    onSelect={handleSettingsAgentSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">↑↓</Text>
                        <Text color="#AAAAAA">Navigate</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">enter</Text>
                        <Text color="#AAAAAA">Toggle/Select</Text>
                        <Text color="#AAAAAA">·</Text>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Back</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'settings_ui') {
        const uiItems = [
            {
                label: `Notification Sounds: [${settingsSoundEnabled ? 'Enabled' : 'Disabled'}]`,
                value: 'sound',
            },
            {
                label: `Layout Density: [${settingsDensity === 'compact' ? 'Compact' : 'Spacious'}]`,
                value: 'density',
            },
            { label: '◀  Back to Categories', value: 'back' },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        🎨 Interface Settings:
                    </Text>
                </Box>
                <SelectInput
                    items={uiItems}
                    onSelect={handleSettingsUISelect}
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
                        <Text color="#AAAAAA">Back</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'settings_keys') {
        const keyItems = [
            {
                label: `Gemini API Key: [${settingsGeminiKey === 'configured' ? '✓ Configured' : '✗ Not Set'}]`,
                value: 'gemini',
            },
            {
                label: `OpenRouter API Key: [${settingsOpenrouterKey === 'configured' ? '✓ Configured' : '✗ Not Set'}]`,
                value: 'openrouter',
            },
            { label: '◀  Back to Categories', value: 'back' },
        ]
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        🔑 API Key Management:
                    </Text>
                </Box>
                <SelectInput
                    items={keyItems}
                    onSelect={handleSettingsKeysSelect}
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
                        <Text color="#AAAAAA">Back</Text>
                    </Box>
                </Box>
            </Box>
        )
    } else if (authMode === 'settings_prompt') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="#89B4F8">
                        📝 December System Prompt:
                    </Text>
                </Box>
                <Text color="#AAAAAA">
                    "You are December, an autonomous software engineer. You have access to tools.
                    When executing code, please use JSON schemas for tool inputs. Before using a
                    tool, you MUST enclose your thought process inside thought tags."
                </Text>
                <Box paddingTop={1}>
                    <Box gap={1}>
                        <Text color="#89B4F8">esc</Text>
                        <Text color="#AAAAAA">Back to Categories</Text>
                    </Box>
                </Box>
            </Box>
        )
    }

    return (
        <Box flexDirection="column" width="100%">
            <Static key={staticKey} items={staticMessages}>
                {(msg) => {
                    if (msg.role === 'header')
                        return (
                            <Header key={msg.id} cliVersion={cliVersion} userEmail={currentEmail} />
                        )
                    if (msg.isBtw)
                        return (
                            <BtwMessage
                                key={msg.id}
                                query={msg.btwQuery ?? ''}
                                blocks={msg.blocks ?? []}
                            />
                        )
                    if (msg.role === 'user')
                        return <UserMessage key={msg.id} message={msg.text ?? ''} />
                    if (msg.role === 'error')
                        return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                    return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
                }}
            </Static>

            {activeMessages.map((msg) => {
                if (msg.isBtw)
                    return (
                        <BtwMessage
                            key={msg.id}
                            query={msg.btwQuery ?? ''}
                            blocks={msg.blocks ?? []}
                        />
                    )
                if (msg.role === 'user')
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                if (msg.role === 'error')
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
            })}

            <InputBar
                onSubmit={handleSubmit}
                disabled={
                    authMode !== 'none' && !(authMode === 'grill_question' && customInputMode)
                }
                placeholder={
                    planMode
                        ? 'Describe what you want to plan...'
                        : grillMode
                          ? 'Describe what you want to grill...'
                          : 'Ask December to build...'
                }
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
                planMode={planMode}
                grillMode={grillMode}
                customInputMode={customInputMode}
            />
        </Box>
    )
}
