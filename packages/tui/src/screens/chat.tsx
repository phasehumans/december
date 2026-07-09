import { Box, Static, useApp, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import { useState, useCallback, useEffect } from 'react'

const CustomIndicator = ({ isSelected }: { isSelected?: boolean }) => (
    <Box marginRight={1}>
        <Text color={isSelected ? 'white' : '#888888'} bold={isSelected}>
            {isSelected ? '●' : ' '}
        </Text>
    </Box>
)

const CustomItem = ({ isSelected, label }: { isSelected?: boolean; label: string }) => (
    <Text color={isSelected ? 'white' : '#888888'} bold={isSelected}>
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
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'
import { useTerminalColumns } from '../hooks/use-terminal-columns'

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
    id: number
    role: 'user' | 'assistant' | 'error'
    text?: string
    blocks?: MessageBlock[]
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

    const [staticMessages, setStaticMessages] = useState<Message[]>([])
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
            } else if (authMode === 'byok_key') {
                setAuthMode('byok_provider')
            } else if (authMode === 'byok_provider' || authMode === 'december_login_select') {
                setAuthMode('menu')
            } else if (
                authMode === 'menu' ||
                authMode === 'model_select' ||
                authMode === 'logout_select' ||
                authMode === 'session_select'
            ) {
                setAuthMode('none')
            } else if (input === 'c' && key.ctrl) {
                exit()
                process.exit(0)
            }
        }
    })

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

            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                { id: ++msgId, role: 'user', text },
                { id: ++msgId, role: 'assistant', blocks: [] },
            ])

            const assistantMsgId = msgId

            try {
                const stream = runAgentLoop(agent, text)

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
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (
                                        lastBlock &&
                                        lastBlock.type === 'text' &&
                                        (lastBlock.content === 'Working...' ||
                                            lastBlock.content === 'Thinking...' ||
                                            lastBlock.content.startsWith('Rate limit hit'))
                                    ) {
                                        lastBlock.content = `\n\n**Agent Error:** ${event.error}\n`
                                    } else {
                                        blocks.push({
                                            type: 'text',
                                            content: `\n\n**Agent Error:** ${event.error}\n`,
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
            }
        },
        [exit, agent, activeMessages, isAuthenticated]
    )

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
                                    content: `Please open ${uri} on any device and enter code: ${code}\nWaiting for authorization...`,
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

    const handleProviderSelect = (item: any) => {
        setSelectedProvider(item.value)
        setAuthMode('byok_key')
    }

    const handleKeySubmit = async (key: string) => {
        setIsStreaming(true) // Prevent multi-submit

        let testProvider: any
        let testModel: string | undefined

        switch (selectedProvider) {
            case 'anthropic':
                testProvider = new AnthropicProvider(key)
                testModel = 'claude-3-5-sonnet-latest'
                break
            case 'google':
                testProvider = new GeminiProvider(key)
                testModel = 'gemini-2.5-pro'
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
                testProvider = new OpenAIProvider('https://api-inference.huggingface.co/v1', key)
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

        try {
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
                            type: 'text',
                            content: `Successfully validated and saved API key for ${selectedProvider}!`,
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
                                type: 'text',
                                content: `Key saved for ${selectedProvider}, but your account is currently rate-limited or out of quota!`,
                            },
                        ],
                    },
                ])
            } else {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'error',
                        text: `Invalid API Key for ${selectedProvider}: ${err.message}`,
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
                    <Text bold color="white">
                        Select authentication method:
                    </Text>
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
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'december_login_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Select December login method:
                    </Text>
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
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'byok_provider') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Select API Provider:
                    </Text>
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
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'byok_key') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Enter API Key for {selectedProvider}:
                    </Text>
                </Box>
                <Box>
                    <Text color="white" bold>
                        ●{' '}
                    </Text>
                    <TextInput
                        value={apiKey}
                        onChange={setApiKey}
                        onSubmit={handleKeySubmit}
                        mask="*"
                    />
                </Box>
                <Box paddingTop={1}>
                    <Text color="gray">enter submit escape cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'model_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Select Model:
                    </Text>
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
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'logout_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Select credential to remove:
                    </Text>
                </Box>
                <SelectInput
                    items={logoutItems}
                    onSelect={(item) => handleLogoutSelect(item.value)}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    } else if (authMode === 'session_select') {
        authUI = (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text bold color="white">
                        Select a session to resume:
                    </Text>
                </Box>
                <SelectInput
                    items={sessionItems}
                    onSelect={handleSessionSelect}
                    indicatorComponent={CustomIndicator}
                    itemComponent={CustomItem}
                />
                <Box paddingTop={1}>
                    <Text color="gray">↑↓ navigate enter select escape/ctrl+c cancel</Text>
                </Box>
            </Box>
        )
    }

    return (
        <Box flexDirection="column" width="100%">
            <Header cliVersion={cliVersion} userEmail={currentEmail} />

            <Static items={staticMessages}>
                {(msg) => {
                    if (msg.role === 'user')
                        return <UserMessage key={msg.id} message={msg.text ?? ''} />
                    if (msg.role === 'error')
                        return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                    return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
                }}
            </Static>

            {activeMessages.map((msg) => {
                if (msg.role === 'user')
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                if (msg.role === 'error')
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
            })}

            <InputBar
                onSubmit={handleSubmit}
                disabled={authMode !== 'none'}
                activeModel={
                    agent.modelOptions?.model ? getModelLabel(agent.modelOptions.model) : 'unknown'
                }
                authUI={authUI}
            />
        </Box>
    )
}
