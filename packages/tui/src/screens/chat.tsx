import { Box, Static, useApp, Text, useInput } from 'ink'
import { useState, useCallback } from 'react'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'

const CustomIndicator = ({ isSelected }: { isSelected?: boolean }) => (
    <Box marginRight={1}>
        <Text color={isSelected ? '#88C0D0' : 'transparent'}>{'❯'}</Text>
    </Box>
)

const CustomItem = ({ isSelected, label }: { isSelected?: boolean; label: string }) => (
    <Text color={isSelected ? '#88C0D0' : 'white'}>{label}</Text>
)

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'

import type { MessageBlock } from '../components/messages/bot-message'
import { Agent, runAgentLoop, saveConfig, loadConfig } from '@december/agent'
import {
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenRouterProvider,
} from '@december/providers'
import { useTerminalColumns } from '../hooks/use-terminal-columns'

type Message = {
    id: number
    role: 'user' | 'assistant' | 'error'
    text?: string
    blocks?: MessageBlock[]
}

let msgId = 0

type AuthMode = 'none' | 'menu' | 'byok_provider' | 'byok_key' | 'model_select'

export function Chat({
    agent,
    isAuthenticated: initialAuth,
}: {
    agent: Agent
    isAuthenticated: boolean
}) {
    const cols = useTerminalColumns()
    const panelWidth = Math.floor(cols * 0.45)

    const [staticMessages, setStaticMessages] = useState<Message[]>([])
    const [activeMessages, setActiveMessages] = useState<Message[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const { exit } = useApp()

    const [isAuthenticated, setIsAuthenticated] = useState(initialAuth)
    const [authMode, setAuthMode] = useState<AuthMode>('none')
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [apiKey, setApiKey] = useState('')

    useInput((input, key) => {
        if (key.escape) {
            if (authMode === 'byok_key') {
                setAuthMode('byok_provider')
            } else if (authMode === 'byok_provider') {
                setAuthMode('menu')
            } else if (authMode === 'menu' || authMode === 'model_select') {
                setAuthMode('none')
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
                config.activeProvider = undefined
                config.decemberToken = undefined
                await saveConfig(config)
                setIsAuthenticated(false)
                setAuthMode('none')
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: ++msgId,
                        role: 'assistant',
                        blocks: [{ type: 'text', content: '✅ Signed out successfully.' }],
                    },
                ])
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
                                    content: '🔒 You must log in first to configure a model.',
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
                                    '🔒 You are not logged in. Please use `/login` to configure your API key or log in via December.',
                            },
                        ],
                    },
                ])
                return
            }

            // Normal chat logic
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
                                    blocks.push({ type: 'text', content: 'Thinking...' })
                                    break
                                case 'StreamChunk':
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (lastBlock && lastBlock.type === 'text') {
                                        lastBlock.content =
                                            (lastBlock.content === 'Thinking...'
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
                                            blocks[blocks.length - 1].content === 'Thinking...'
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
                                        command: `${event.toolCall.name} ${event.toolCall.input}`,
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

    const handleAuthMenuSelect = (item: any) => {
        if (item.value === 'december') {
            // Mocking December Login for now
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: `🌐 Browser login flow would open http://localhost:8989 here.`,
                        },
                    ],
                },
            ])
            setAuthMode('none')
        } else if (item.value === 'byok') {
            setAuthMode('byok_provider')
        }
    }

    const handleModelSelect = async (item: any) => {
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
                blocks: [
                    { type: 'text', content: `✅ Model successfully changed to ${item.value}!` },
                ],
            },
        ])
    }

    const handleProviderSelect = (item: any) => {
        setSelectedProvider(item.value)
        setAuthMode('byok_key')
    }

    const handleKeySubmit = async (key: string) => {
        setIsStreaming(true) // Prevent multi-submit

        // Map to internal provider string
        const internalProvider =
            selectedProvider === 'anthropic'
                ? 'anthropic'
                : selectedProvider === 'google'
                  ? 'gemini'
                  : selectedProvider === 'openrouter'
                    ? 'openrouter'
                    : 'openai'
        let testProvider: any
        switch (internalProvider) {
            case 'openai':
                testProvider = new OpenAIProvider(undefined, key)
                break
            case 'anthropic':
                testProvider = new AnthropicProvider(key)
                break
            case 'gemini':
                testProvider = new GeminiProvider(key)
                break
            case 'openrouter':
                testProvider = new OpenRouterProvider(key)
                break
        }

        let testModel: string | undefined
        switch (internalProvider) {
            case 'anthropic':
                testModel = 'claude-3-5-sonnet-latest'
                break
            case 'gemini':
                testModel = 'gemini-2.5-pro'
                break
            case 'openai':
                testModel = 'gpt-4o'
                break
            case 'openrouter':
                testModel = 'openai/gpt-4o'
                break
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
                            content: `✅ Successfully validated and saved API key for ${selectedProvider}!`,
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
                                content: `⚠️ Key saved for ${selectedProvider}, but your account is currently rate-limited or out of quota!`,
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
                        text: `❌ Invalid API Key for ${selectedProvider}: ${err.message}`,
                    },
                ])
                setApiKey('')
            }
        } finally {
            setIsStreaming(false)
        }
    }

    return (
        <Box flexDirection="column" width="100%">
            <Header />

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

            {/* Inline Auth UI */}
            {authMode === 'menu' && (
                <Box flexDirection="column" width={panelWidth} paddingX={1} alignSelf="flex-start">
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            Authentication
                        </Text>
                        <Text color="gray">select method</Text>
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
                </Box>
            )}

            {authMode === 'byok_provider' && (
                <Box flexDirection="column" width={panelWidth} paddingX={1} alignSelf="flex-start">
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            LLM Provider
                        </Text>
                        <Text color="gray">select network</Text>
                    </Box>
                    <SelectInput
                        items={[
                            { label: 'Anthropic', value: 'anthropic' },
                            { label: 'Google', value: 'google' },
                            { label: 'OpenAI', value: 'openai' },
                            { label: 'OpenRouter', value: 'openrouter' },
                        ]}
                        onSelect={handleProviderSelect}
                        indicatorComponent={CustomIndicator}
                        itemComponent={CustomItem}
                    />
                </Box>
            )}

            {authMode === 'byok_key' && (
                <Box flexDirection="column" width={panelWidth} paddingX={1} alignSelf="flex-start">
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            API Key
                        </Text>
                        <Text color="gray">{selectedProvider}</Text>
                    </Box>
                    <Box>
                        <Text color="#88C0D0">❭ </Text>
                        <TextInput
                            value={apiKey}
                            onChange={setApiKey}
                            onSubmit={handleKeySubmit}
                            mask="*"
                        />
                    </Box>
                </Box>
            )}
            {authMode === 'model_select' && (
                <Box flexDirection="column" width={panelWidth} paddingX={1} alignSelf="flex-start">
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            Select Model
                        </Text>
                        <Text color="gray">{selectedProvider}</Text>
                    </Box>
                    <SelectInput
                        items={
                            selectedProvider === 'anthropic'
                                ? [
                                      {
                                          label: 'Claude 3.5 Sonnet',
                                          value: 'claude-3-5-sonnet-latest',
                                      },
                                      { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' },
                                      { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
                                  ]
                                : selectedProvider === 'google'
                                  ? [
                                        { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
                                        { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro' },
                                        {
                                            label: 'Gemini 3 Pro Preview',
                                            value: 'gemini-3-pro-preview',
                                        },
                                        { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
                                    ]
                                  : selectedProvider === 'openai'
                                    ? [
                                          { label: 'GPT-4o', value: 'gpt-4o' },
                                          { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                                          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
                                      ]
                                    : selectedProvider === 'openrouter'
                                      ? [
                                            {
                                                label: 'Anthropic: Claude 3.5 Sonnet',
                                                value: 'anthropic/claude-3.5-sonnet',
                                            },
                                            {
                                                label: 'Google: Gemini 1.5 Pro',
                                                value: 'google/gemini-1.5-pro',
                                            },
                                            { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
                                            {
                                                label: 'Meta: Llama 3 70B',
                                                value: 'meta-llama/llama-3-70b-instruct',
                                            },
                                        ]
                                      : []
                        }
                        onSelect={handleModelSelect}
                        indicatorComponent={CustomIndicator}
                        itemComponent={CustomItem}
                    />
                </Box>
            )}

            <InputBar
                onSubmit={handleSubmit}
                disabled={isStreaming || authMode !== 'none'}
                activeModel={agent.modelOptions?.model || 'unknown'}
            />
        </Box>
    )
}
