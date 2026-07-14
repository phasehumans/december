import {
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenRouterProvider,
} from '@december/providers'

import { loadConfig, saveConfig, getProviderConfig } from '../config'
import { MESSAGES } from '../constants/messages'
import { useCliStore } from '../store'
import { getToolSummary } from '../utils/formatters'

import { getNextMsgId } from './use-agent-runner'

import type { Message, MessageBlock } from '@december/tui'

export function useAuthHandlers(
    agent: any,
    onLogin?: () => Promise<{ token: string; email: string | null }>,
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void
    ) => Promise<{ token: string; email: string | null }>
) {
    const {
        isAuthenticated,
        setIsAuthenticated,
        setCurrentEmail,
        setAuthMode,
        selectedProvider,
        setSelectedProvider,
        setApiKey,
        activeMessages,
        setActiveMessages,
        setStaticMessages,
        setIsStreaming,
        isStreaming,
    } = useCliStore()

    const handleAuthMenuSelect = async (item: any) => {
        if (item.value === 'december') {
            setAuthMode('december_login_select')
        } else if (item.value === 'december_browser') {
            setAuthMode('none')
            setIsStreaming(true)
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: getNextMsgId(),
                    role: 'assistant',
                    blocks: [{ type: 'text', content: `Opening browser to log in...` }],
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
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [{ type: 'text', content: MESSAGES.AUTH.LOGIN_SUCCESS_DECEMBER }],
                    },
                ])
            } catch (err: any) {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    { id: getNextMsgId(), role: 'error', text: `Login failed: ${err.message}` },
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

                const codeMsgId = getNextMsgId()
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    {
                        id: codeMsgId,
                        role: 'assistant',
                        blocks: [{ type: 'text', content: `Generating device code...` }],
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
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [{ type: 'text', content: MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE }],
                    },
                ])
            } catch (err: any) {
                setStaticMessages((prev) => [...prev, ...activeMessages])
                setActiveMessages([
                    { id: getNextMsgId(), role: 'error', text: `Login failed: ${err.message}` },
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
                id: getNextMsgId(),
                role: 'assistant',
                blocks: [{ type: 'text', content: `Model successfully changed to ${item.value}!` }],
            },
        ])
    }

    const handleProviderSelect = (item: any) => {
        setSelectedProvider(item.value)
        setAuthMode('byok_key')
    }

    const handleKeySubmit = async (key: string) => {
        if (isStreaming) return
        setIsStreaming(true)

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
                    id: getNextMsgId(),
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
                        id: getNextMsgId(),
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
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: [
                            {
                                type: 'status',
                                success: false,
                                label: `Invalid API Key for ${selectedProvider}`,
                            },
                            { type: 'text', content: cleanMessage },
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
                id: getNextMsgId(),
                role: 'assistant',
                blocks: [{ type: 'text', content: `Removed credentials for: ${removedName}` }],
            },
        ])
    }

    const handleSessionSelect = async (item: any) => {
        setAuthMode('none')
        try {
            await agent.loadContext(item.value)

            const resumedMessages: Message[] = []
            for (const msg of agent.messages) {
                if (msg.role === 'user') {
                    resumedMessages.push({ id: getNextMsgId(), role: 'user', text: msg.content })
                } else if (msg.role === 'assistant') {
                    const blocks: MessageBlock[] = []

                    if (msg.content) {
                        blocks.push({ type: 'text', content: msg.content })
                    }

                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        for (const tc of msg.toolCalls) {
                            const toolMsg = agent.messages.find(
                                (m: any) => m.role === 'tool' && m.toolCallId === tc.id
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
                            id: getNextMsgId(),
                            role: 'assistant',
                            blocks,
                        })
                    }
                }
            }

            setStaticMessages(resumedMessages)
            setActiveMessages([
                {
                    id: getNextMsgId(),
                    role: 'assistant',
                    blocks: [{ type: 'text', content: `Resumed session: ${item.value}` }],
                },
            ])
        } catch (err: any) {
            setStaticMessages((prev) => [...prev, ...activeMessages])
            setActiveMessages([
                {
                    id: getNextMsgId(),
                    role: 'error',
                    text: `Failed to resume session: ${err.message}`,
                },
            ])
        }
    }

    return {
        handleAuthMenuSelect,
        handleModelSelect,
        handleProviderSelect,
        handleKeySubmit,
        handleLogoutSelect,
        handleSessionSelect,
    }
}
