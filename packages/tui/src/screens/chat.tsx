import { Box, Static, useApp, Text } from 'ink'
import { useState, useCallback } from 'react'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'

import type { MessageBlock } from '../components/messages/bot-message'
import { Agent, runAgentLoop, saveConfig, loadConfig, createProvider } from '@december/agent'
import { useTerminalColumns } from '../hooks/use-terminal-columns'

type Message = {
    id: number
    role: 'user' | 'assistant' | 'error'
    text?: string
    blocks?: MessageBlock[]
}

let msgId = 0

type AuthMode = 'none' | 'menu' | 'byok_provider' | 'byok_key'

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

    const handleSubmit = useCallback(
        async (text: string) => {
            if (text.trim() === '/exit') {
                exit()
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
                                case 'ToolCallStart':
                                    blocks.push({
                                        type: 'command',
                                        command: `${event.toolCall.name} ${event.toolCall.input}`,
                                        status: 'running',
                                    })
                                    break
                                case 'ToolCallResult':
                                    const lastCmd = blocks[blocks.length - 1]
                                    if (lastCmd && lastCmd.type === 'command') {
                                        lastCmd.status = event.result.error ? 'error' : 'success'
                                        lastCmd.output = event.result.error || event.result.result
                                    }
                                    break
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
                : selectedProvider === 'openrouter'
                  ? 'openrouter'
                  : 'openai'
        const testProvider = createProvider({
            provider: internalProvider as any,
            apiKey: key,
            model: undefined,
        })

        try {
            // Dummy request to validate key
            const stream = testProvider.stream([{ role: 'user', content: 'Hi' }], new Map())
            await stream.next()

            const config = await loadConfig()
            config.providers[selectedProvider] = key
            config.activeProvider = selectedProvider
            await saveConfig(config)

            agent.setLLM(testProvider)
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
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: ++msgId,
                    role: 'error',
                    text: `❌ Invalid API Key for ${selectedProvider}: ${err.message}`,
                },
            ])
            setApiKey('')
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

            {authMode === 'none' && <InputBar onSubmit={handleSubmit} disabled={isStreaming} />}

            {/* Inline Auth UI styled strictly like the native TUI dialogs */}
            {authMode === 'menu' && (
                <Box
                    flexDirection="column"
                    width={panelWidth}
                    borderStyle="single"
                    borderColor="#444444"
                    paddingX={1}
                    alignSelf="flex-end"
                >
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
                    />
                </Box>
            )}

            {authMode === 'byok_provider' && (
                <Box
                    flexDirection="column"
                    width={panelWidth}
                    borderStyle="single"
                    borderColor="#444444"
                    paddingX={1}
                    alignSelf="flex-end"
                >
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            LLM Provider
                        </Text>
                        <Text color="gray">select network</Text>
                    </Box>
                    <SelectInput
                        items={[
                            { label: 'Anthropic (Claude 3.5 Sonnet)', value: 'anthropic' },
                            { label: 'OpenAI (GPT-4o)', value: 'openai' },
                            { label: 'Google (Gemini 1.5 Pro)', value: 'google' },
                            { label: 'DeepSeek', value: 'deepseek' },
                            { label: 'Groq', value: 'groq' },
                            { label: 'OpenRouter', value: 'openrouter' },
                        ]}
                        onSelect={handleProviderSelect}
                    />
                </Box>
            )}

            {authMode === 'byok_key' && (
                <Box
                    flexDirection="column"
                    width={panelWidth}
                    borderStyle="single"
                    borderColor="#444444"
                    paddingX={1}
                    alignSelf="flex-end"
                >
                    <Box justifyContent="space-between" marginBottom={1}>
                        <Text bold color="white">
                            API Key
                        </Text>
                        <Text color="gray">{selectedProvider}</Text>
                    </Box>
                    <Box>
                        <Text color="gray">❭ </Text>
                        <TextInput
                            value={apiKey}
                            onChange={setApiKey}
                            onSubmit={handleKeySubmit}
                            mask="*"
                        />
                    </Box>
                </Box>
            )}
        </Box>
    )
}
