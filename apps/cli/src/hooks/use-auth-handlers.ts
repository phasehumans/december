import {
    loadConfig,
    saveConfig,
    getProviderConfig,
    getConfiguredProviders,
    resolveSwitchTarget,
    applyProviderSwitch,
    formatProviderName,
} from '../config'
import { MESSAGES } from '../constants/messages'
import { useCliStore } from '../store'
import { parseError } from '../utils/error-parser'
import { getProviderModels } from '../utils/models'
import { instantiateProvider } from '../utils/provider-factory'

import { getNextMsgId, convertAgentMessagesToTuiMessages } from './use-agent-runner'

export function useAuthHandlers(
    agent: any,
    onLogin?: (
        onCode: (code: string, uri: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>,
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
) {
    const {
        setIsAuthenticated,
        setCurrentEmail,
        setAuthMode,
        setSelectedProvider,
        setActiveModel,
        setApiKey,
        setActiveMessages,
        setStaticMessages,
        setIsStreaming,
        setHasBothAuth,
        setSettingsAuthPriority,
        setAuthMethod,
        setStaticKey,
        setAuthError,
        addToast,
        setSwitchItems,
    } = useCliStore.getState()

    const deviceAuthAbortRef = { current: null as AbortController | null }

    const handleAuthMenuSelect = async (item: any) => {
        if (item.value === 'subscriptions' || item.value === 'subscription_select') {
            setAuthMode('subscription_select')
            return
        }

        if (item.value === 'byok') {
            setAuthMode('byok_provider')
            return
        }

        if (item.value === 'december' || item.value === 'december_headless') {
            if (useCliStore.getState().isStreaming) {
                return
            }

            const hasDecember =
                useCliStore.getState().hasDecember ||
                useCliStore.getState().authMethod === 'december'
            if (!item.force && hasDecember) {
                setAuthMode('menu')
                return
            }

            setAuthMode('none')
            setIsStreaming(true)

            const authAbortController = new AbortController()
            deviceAuthAbortRef.current = authAbortController

            let codeMsgId: string | number | null = null
            try {
                const loginFn = onLogin || onLoginHeadless
                if (!loginFn) {
                    throw new Error('Login functionality is not provided by the host environment.')
                }

                codeMsgId = getNextMsgId()
                setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                setActiveMessages([
                    {
                        id: codeMsgId,
                        role: 'assistant',
                        blocks: [{ type: 'text', content: 'Generating December login code...' }],
                    },
                ])

                const onCode = (code: string, uri: string) => {
                    const fullUrl = uri.includes('?')
                        ? `${uri}&code=${encodeURIComponent(code)}`
                        : `${uri}?code=${encodeURIComponent(code)}`

                    useCliStore.getState().setPendingDeviceAuthUrl(fullUrl)

                    setActiveMessages([
                        {
                            id: codeMsgId,
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content: `\nConfirm code: \`${code}\`\nOpen URL: [${fullUrl}](${fullUrl})\n\nPress [o] to open in browser · Esc to cancel\nWaiting for approval...`,
                                },
                            ],
                        },
                    ])
                }

                const { token, email } = await loginFn(onCode, authAbortController.signal)
                useCliStore.getState().setPendingDeviceAuthUrl(null)

                const config = await loadConfig()
                config.decemberToken = token
                config.authPriority = 'december'
                config.activeModel = 'december-auto'
                if (email) {
                    config.email = email
                    setCurrentEmail(email)
                }
                await saveConfig(config)

                const providerConfig = await getProviderConfig()
                const { getAuthStatus } = await import('../config')
                const authStatus = await getAuthStatus()

                if (providerConfig) {
                    const provider = instantiateProvider(
                        providerConfig.provider,
                        providerConfig.apiKey,
                        {
                            authMethod: providerConfig.authMethod,
                            subscription: providerConfig.subscription,
                            headers: providerConfig.headers,
                            baseURL: providerConfig.baseURL,
                        }
                    )
                    agent.setLLM(provider)
                    const activeModel =
                        providerConfig.authMethod === 'december'
                            ? 'december-auto'
                            : providerConfig.model
                    config.activeModel = activeModel
                    await saveConfig(config)
                    agent.modelOptions = { ...agent.modelOptions, model: activeModel }
                    setActiveModel(activeModel)
                    setSelectedProvider(providerConfig.provider)
                    setIsAuthenticated(true)
                    setAuthMethod(providerConfig.authMethod)
                    setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                    setSettingsAuthPriority(authStatus.authPriority)
                    useCliStore.getState().setHasDecember(authStatus.hasDecember)
                    if (email || config.email) {
                        useCliStore.getState().setDecemberEmail(email || config.email)
                    }
                }

                const cleanActiveMessages = useCliStore.getState().activeMessages.map((m) => {
                    if (m.id === codeMsgId) {
                        return {
                            ...m,
                            blocks: m.blocks?.map((b) => {
                                if (b.type === 'text') {
                                    return {
                                        ...b,
                                        content: b.content
                                            .replace(/\n\s*Waiting for approval\.\.\./g, '')
                                            .replace(/\n\s*Press \[o\].*$/gm, '')
                                            .trim(),
                                    }
                                }
                                return b
                            }),
                        }
                    }
                    return m
                })
                setStaticMessages((prev) => [...prev, ...cleanActiveMessages])

                const successBlocks: any[] = [
                    {
                        type: 'text',
                        content: `\n${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}`,
                        color: '#6EE7B7',
                    },
                ]

                if (providerConfig?.authMethod === 'december' && token) {
                    try {
                        const serverUrl = process.env.SERVER_URL || 'https://api.trydecember.com'
                        const overviewRes = await fetch(`${serverUrl}/api/v1/billing/overview`, {
                            headers: { Authorization: `Bearer ${token}` },
                            signal: AbortSignal.timeout(2000),
                        })
                        if (overviewRes.ok) {
                            const overviewJson = (await overviewRes.json()) as any
                            const balanceCents = overviewJson.data?.creditBalance ?? 0
                            if (balanceCents <= 0) {
                                successBlocks.push({
                                    type: 'text',
                                    content: `\nYour December Wallet balance is $0.00.\nTo add credits, visit [https://app.trydecember.com/settings/billing](https://app.trydecember.com/settings/billing).\nYou can also connect an AI Subscription or API key anytime with \`/login\`.`,
                                })
                            } else {
                                successBlocks.push({
                                    type: 'text',
                                    content: `\nDecember Wallet: $${(balanceCents / 100).toFixed(2)}. Ready to code!`,
                                })
                            }
                        }
                    } catch {
                        // Intentionally swallowed: network error fetching december wallet balance on login
                    }
                }

                setActiveMessages([
                    {
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks: successBlocks,
                    },
                ])
            } catch (err: any) {
                useCliStore.getState().setPendingDeviceAuthUrl(null)
                const cleanActiveMessages = useCliStore.getState().activeMessages.map((m) => {
                    if (m.id === codeMsgId) {
                        return {
                            ...m,
                            blocks: m.blocks?.map((b) => {
                                if (b.type === 'text') {
                                    return {
                                        ...b,
                                        content: b.content
                                            .replace(/\n\s*Waiting for approval\.\.\./g, '')
                                            .replace(/\n\s*Press \[o\].*$/gm, '')
                                            .trim(),
                                    }
                                }
                                return b
                            }),
                        }
                    }
                    return m
                })
                setStaticMessages((prev) => [...prev, ...cleanActiveMessages])

                if (err?.name === 'AbortError' || err?.message?.includes('cancelled')) {
                    setActiveMessages([
                        {
                            id: getNextMsgId(),
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content:
                                        'Login cancelled. Run /login anytime to connect an account.',
                                    color: '#888888',
                                },
                            ],
                        },
                    ])
                    setAuthMode('none')
                    return
                }
                const parsed = parseError(err)
                let cleanMsg = parsed.message
                if (
                    cleanMsg.includes('fetch failed') ||
                    cleanMsg.includes('ECONNREFUSED') ||
                    cleanMsg.includes('ENOTFOUND') ||
                    cleanMsg.includes('Failed to fetch') ||
                    cleanMsg.includes('Unable to connect')
                ) {
                    cleanMsg =
                        'Unable to connect to December. Check your connection and run /login again.'
                } else if (cleanMsg.toLowerCase().includes('expired')) {
                    cleanMsg = 'Device code expired. Run /login to generate a new code.'
                }
                const errorText = `Login failed: ${cleanMsg}`
                setAuthError(errorText)
                setActiveMessages([
                    {
                        id: getNextMsgId(),
                        role: 'error',
                        text: errorText,
                        cause: parsed.cause,
                        hint:
                            parsed.hint ||
                            'Check your network connection or verify the authentication endpoint.',
                    },
                ])
                setAuthMode('none')
            } finally {
                useCliStore.getState().setPendingDeviceAuthUrl(null)
                deviceAuthAbortRef.current = null
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
        if (config.activeProvider) {
            config.lastUsedModels = config.lastUsedModels || {}
            config.lastUsedModels[config.activeProvider] = item.value
        }
        await saveConfig(config)
        if (agent) {
            agent.modelOptions = { ...agent.modelOptions, model: item.value }
        }
        setActiveModel(item.value)
        setAuthMode('none')
        addToast(`Model changed to ${item.value}`, 'success')
    }

    const handleSubscriptionSelect = async (item: any) => {
        const config = await loadConfig()

        const { getSubscriptionAdapter, verifyAndResolveSubscription, loginSubscription } =
            await import('../auth/subscriptions/subscription-manager')
        const {
            formatSubscriptionToast,
            formatSubscriptionCard,
            formatSubscriptionSuccessMessage,
        } = await import('../auth/subscriptions/formatters')

        if (getSubscriptionAdapter(item.value)) {
            const { getDefaultModelForProvider } = await import('../utils/models')
            const { getAuthStatus } = await import('../config')

            // Step 1: Check and auto-verify local credentials if present (skip if forceLogin requested)
            if (!item.forceLogin) {
                const verifiedBundle = await verifyAndResolveSubscription(item.value)
                if (verifiedBundle) {
                    const targetModel = getDefaultModelForProvider(item.value)
                    const llm = instantiateProvider(
                        verifiedBundle.provider,
                        verifiedBundle.accessToken,
                        {
                            authMethod: 'subscription',
                            subscription: verifiedBundle,
                            baseURL: verifiedBundle.endpoint,
                        }
                    )
                    if (agent) {
                        agent.setLLM(llm)
                        agent.modelOptions = { ...agent.modelOptions, model: targetModel }
                    }
                    setActiveModel(targetModel)
                    setSelectedProvider(verifiedBundle.provider)
                    setIsAuthenticated(true)
                    setAuthMethod('subscription')

                    const authStatus = await getAuthStatus()
                    setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                    setSettingsAuthPriority(authStatus.authPriority)

                    const { loadConfig, saveConfig } = await import('../config')
                    const updatedConfig = await loadConfig()
                    if (updatedConfig.unlinkedSubscriptions?.length) {
                        const removeKeys = new Set([item.value, verifiedBundle.provider])
                        if (
                            removeKeys.has('gemini') ||
                            removeKeys.has('google') ||
                            removeKeys.has('antigravity')
                        ) {
                            removeKeys.add('gemini')
                            removeKeys.add('google')
                            removeKeys.add('antigravity')
                        } else if (removeKeys.has('claude') || removeKeys.has('anthropic')) {
                            removeKeys.add('claude')
                            removeKeys.add('anthropic')
                        } else if (
                            removeKeys.has('codex') ||
                            removeKeys.has('openai') ||
                            removeKeys.has('chatgpt')
                        ) {
                            removeKeys.add('codex')
                            removeKeys.add('openai')
                            removeKeys.add('chatgpt')
                        } else if (removeKeys.has('copilot') || removeKeys.has('github')) {
                            removeKeys.add('copilot')
                            removeKeys.add('github')
                        }
                        updatedConfig.unlinkedSubscriptions =
                            updatedConfig.unlinkedSubscriptions.filter((p) => !removeKeys.has(p))
                    }
                    updatedConfig.activeProvider = item.value
                    updatedConfig.activeModel = targetModel
                    updatedConfig.authPriority = 'subscription'
                    await saveConfig(updatedConfig)

                    const { fetchLiveProviderModels } = await import('../utils/models')
                    fetchLiveProviderModels(
                        verifiedBundle.provider,
                        verifiedBundle.accessToken,
                        verifiedBundle.endpoint
                    ).catch(() => {})

                    setAuthMode('none')
                    addToast(formatSubscriptionToast(verifiedBundle, targetModel), 'success')
                    return
                }
            }

            // Step 2: If no local credentials, launch interactive OAuth/device flow or key prompt
            const adapter = getSubscriptionAdapter(item.value)
            const isOauthProvider =
                item.value === 'copilot' ||
                item.value === 'claude' ||
                item.value === 'codex' ||
                item.value === 'gemini'

            if (isOauthProvider) {
                setAuthMode('none')
                setIsStreaming(true)
                let codeMsgId: string | null = null
                try {
                    codeMsgId = getNextMsgId()
                    setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
                    setActiveMessages([
                        {
                            id: codeMsgId,
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content: `Initiating ${item.value.toUpperCase()} subscription verification...`,
                                },
                            ],
                        },
                    ])

                    const onCode = (code: string, uri: string) => {
                        let promptText = `\nPlease open [${uri}](${uri}) in your browser to authorize.`
                        if (code && !code.endsWith('-AUTH')) {
                            promptText = `\nPlease open [${uri}](${uri}) on your device and enter code: \`${code}\``
                        }
                        if (item.value === 'copilot') {
                            promptText +=
                                '\n*(Note: Ensure your browser is logged into the GitHub account that owns your active Copilot subscription)*'
                        }
                        setActiveMessages([
                            {
                                id: codeMsgId,
                                role: 'assistant',
                                blocks: [
                                    {
                                        type: 'text',
                                        content: promptText,
                                    },
                                    {
                                        type: 'text',
                                        content:
                                            'Waiting for authorization and subscription verification...',
                                    },
                                ],
                            },
                        ])
                    }

                    const bundle = await loginSubscription(item.value, onCode)
                    const targetModel = getDefaultModelForProvider(item.value)
                    const llm = instantiateProvider(bundle.provider, bundle.accessToken, {
                        authMethod: 'subscription',
                        subscription: bundle,
                        baseURL: bundle.endpoint,
                    })
                    if (agent) {
                        agent.setLLM(llm)
                        agent.modelOptions = { ...agent.modelOptions, model: targetModel }
                    }
                    setActiveModel(targetModel)
                    setSelectedProvider(bundle.provider)
                    setIsAuthenticated(true)
                    setAuthMethod('subscription')

                    const { loadConfig, saveConfig } = await import('../config')
                    const updatedConfig = await loadConfig()
                    if (updatedConfig.unlinkedSubscriptions?.length) {
                        const removeKeys = new Set([item.value, bundle.provider])
                        if (
                            removeKeys.has('gemini') ||
                            removeKeys.has('google') ||
                            removeKeys.has('antigravity')
                        ) {
                            removeKeys.add('gemini')
                            removeKeys.add('google')
                            removeKeys.add('antigravity')
                        } else if (removeKeys.has('claude') || removeKeys.has('anthropic')) {
                            removeKeys.add('claude')
                            removeKeys.add('anthropic')
                        } else if (
                            removeKeys.has('codex') ||
                            removeKeys.has('openai') ||
                            removeKeys.has('chatgpt')
                        ) {
                            removeKeys.add('codex')
                            removeKeys.add('openai')
                            removeKeys.add('chatgpt')
                        } else if (removeKeys.has('copilot') || removeKeys.has('github')) {
                            removeKeys.add('copilot')
                            removeKeys.add('github')
                        }
                        updatedConfig.unlinkedSubscriptions =
                            updatedConfig.unlinkedSubscriptions.filter((p) => !removeKeys.has(p))
                    }
                    updatedConfig.activeProvider = bundle.provider
                    updatedConfig.activeModel = targetModel
                    updatedConfig.authPriority = 'subscription'
                    await saveConfig(updatedConfig)

                    const authStatus = await getAuthStatus()
                    setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                    setSettingsAuthPriority(authStatus.authPriority)

                    const cleanActiveMessages = useCliStore.getState().activeMessages.map((m) => {
                        if (m.id === codeMsgId) {
                            return {
                                ...m,
                                blocks: m.blocks
                                    ?.filter(
                                        (b) =>
                                            b.type !== 'text' ||
                                            !b.content.includes('Waiting for authorization')
                                    )
                                    .map((b) => {
                                        if (b.type === 'text') {
                                            return {
                                                ...b,
                                                content: b.content
                                                    .replace(
                                                        /\n\s*Waiting for authorization.*$/gm,
                                                        ''
                                                    )
                                                    .trim(),
                                            }
                                        }
                                        return b
                                    }),
                            }
                        }
                        return m
                    })
                    setStaticMessages((prev) => [...prev, ...cleanActiveMessages])
                    setActiveMessages([
                        {
                            id: getNextMsgId(),
                            role: 'assistant',
                            blocks: [
                                {
                                    type: 'text',
                                    content: `\n${formatSubscriptionSuccessMessage(bundle.provider)}`,
                                    color: '#6EE7B7',
                                },
                                {
                                    type: 'text',
                                    content: formatSubscriptionCard(bundle, targetModel),
                                },
                            ],
                        },
                    ])
                    const { fetchLiveProviderModels } = await import('../utils/models')
                    fetchLiveProviderModels(
                        bundle.provider,
                        bundle.accessToken,
                        bundle.endpoint
                    ).catch(() => {})

                    addToast(formatSubscriptionToast(bundle, targetModel), 'success')
                } catch (err: any) {
                    const parsed = parseError(err)
                    const errorText =
                        parsed.message.startsWith('Subscription verification failed') ||
                        parsed.message.startsWith('No active GitHub Copilot subscription')
                            ? parsed.message
                            : `Subscription verification failed: ${parsed.message}`
                    setAuthError(errorText)
                    const cleanActiveMessages = useCliStore.getState().activeMessages.map((m) => {
                        if (m.id === codeMsgId) {
                            return {
                                ...m,
                                blocks: m.blocks
                                    ?.filter(
                                        (b) =>
                                            b.type !== 'text' ||
                                            !b.content.includes('Waiting for authorization')
                                    )
                                    .map((b) => {
                                        if (b.type === 'text') {
                                            return {
                                                ...b,
                                                content: b.content
                                                    .replace(
                                                        /\n\s*Waiting for authorization.*$/gm,
                                                        ''
                                                    )
                                                    .trim(),
                                            }
                                        }
                                        return b
                                    }),
                            }
                        }
                        return m
                    })
                    setStaticMessages((prev) => [...prev, ...cleanActiveMessages])
                    setActiveMessages([
                        {
                            id: getNextMsgId(),
                            role: 'error',
                            text: errorText,
                            cause: parsed.cause,
                            hint: parsed.hint,
                        },
                    ])
                } finally {
                    setIsStreaming(false)
                }
                return
            } else {
                setSelectedProvider(item.value)
                setAuthMode('byok_key')
                return
            }
        }
    }

    const handleProviderSelect = async (item: any) => {
        const config = await loadConfig()

        if (config.providers && config.providers[item.value] && !item.forceNewKey) {
            const key = config.providers[item.value]
            config.activeProvider = item.value
            config.authPriority = 'byok'

            const { getDefaultModelForProvider } = await import('../utils/models')
            const targetModel = getDefaultModelForProvider(item.value)
            config.activeModel = targetModel
            await saveConfig(config)

            const llm = instantiateProvider(item.value, key)
            if (agent) {
                agent.setLLM(llm)
                agent.modelOptions = { ...agent.modelOptions, model: targetModel }
            }
            setActiveModel(targetModel)

            const { getAuthStatus, getProviderConfig } = await import('../config')
            const authStatus = await getAuthStatus()
            const newProviderConfig = await getProviderConfig()
            if (newProviderConfig) {
                setAuthMethod(newProviderConfig.authMethod)
            }
            setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
            setSettingsAuthPriority(authStatus.authPriority)
            setIsAuthenticated(true)
            setSelectedProvider(item.value)

            const { fetchLiveProviderModels } = await import('../utils/models')
            fetchLiveProviderModels(item.value, key).catch(() => {})

            setAuthMode('none')
            addToast(
                `Switched active provider to ${item.value.toUpperCase()} (${targetModel})`,
                'success'
            )
        } else {
            setSelectedProvider(item.value)
            setApiKey('')
            setAuthError(null)
            setAuthMode('byok_key')
        }
    }

    const handleKeySubmit = async (key: string) => {
        if (useCliStore.getState().isStreaming) return
        const trimmedKey = key.trim()
        if (!trimmedKey) return

        const selectedProvider = useCliStore.getState().selectedProvider

        if (selectedProvider === 'deepgram') {
            setIsStreaming(true)
            setAuthError(null)

            try {
                const res = await fetch('https://api.deepgram.com/v1/projects', {
                    headers: { Authorization: `Token ${trimmedKey}` },
                })

                if (!res.ok) {
                    throw new Error(
                        'Invalid Deepgram API key. Please check your key from console.deepgram.com.'
                    )
                }

                const config = await loadConfig()
                config.providers = config.providers || {}
                config.providers.deepgram = trimmedKey
                await saveConfig(config)

                setApiKey('')
                setAuthMode('none')
                addToast('Saved Deepgram API key for voice dictation.', 'success')
            } catch (err: any) {
                setAuthError(err.message || 'Failed to verify Deepgram API key.')
            } finally {
                setIsStreaming(false)
            }
            return
        }

        setIsStreaming(true)
        setAuthError(null)

        let testProvider: any
        let testModel: string | undefined

        try {
            testProvider = instantiateProvider(selectedProvider, trimmedKey)
            const providerModels = getProviderModels(selectedProvider)
            const candidateModels =
                providerModels && providerModels.length > 0
                    ? providerModels.map((m) => m.value)
                    : ['gpt-4o']

            let lastProbeErr: any
            let lowCreditErr: any
            let lowCreditModel: string | undefined
            let probeSuccess = false

            for (const modelToTest of candidateModels.slice(0, 4)) {
                testModel = modelToTest
                const probeAbortController = new AbortController()
                const probeTimeout = setTimeout(() => {
                    probeAbortController.abort(
                        new Error('Connection timed out while verifying API key.')
                    )
                }, 8000)

                try {
                    const stream = testProvider.stream(
                        [{ role: 'user', content: 'Hi' }],
                        undefined,
                        undefined,
                        {
                            model: testModel,
                            max_tokens: 16,
                        },
                        probeAbortController.signal
                    )
                    try {
                        await stream.next()
                        probeSuccess = true
                        break
                    } finally {
                        clearTimeout(probeTimeout)
                        probeAbortController.abort()
                        await stream.return?.()
                    }
                } catch (probeErr: any) {
                    lastProbeErr = probeErr
                    const errText =
                        `${probeErr?.message || ''} ${probeErr?.code || ''} ${probeErr?.error?.code || ''} ${String(probeErr)}`.toLowerCase()
                    if (
                        errText.includes('401') ||
                        errText.includes('unauthorized') ||
                        errText.includes('invalid api key') ||
                        errText.includes('incorrect api key')
                    ) {
                        throw probeErr
                    }
                    if (
                        errText.includes('402') ||
                        errText.includes('credits') ||
                        errText.includes('payment') ||
                        errText.includes('afford') ||
                        errText.includes('budget') ||
                        errText.includes('balance') ||
                        errText.includes('insufficient_quota')
                    ) {
                        if (!lowCreditErr) {
                            lowCreditErr = probeErr
                            lowCreditModel = testModel
                        }
                        break
                    }
                    if (
                        errText.includes('timed out') ||
                        errText.includes('timeout') ||
                        probeErr?.name === 'AbortError'
                    ) {
                        break
                    }
                }
            }

            if (!probeSuccess && (lowCreditErr || lastProbeErr)) {
                if (lowCreditModel) {
                    testModel = lowCreditModel
                }
                throw lowCreditErr || lastProbeErr
            }

            const { getDefaultModelForProvider } = await import('../utils/models')
            const finalModel = testModel || getDefaultModelForProvider(selectedProvider)

            const config = await loadConfig()
            config.providers = config.providers || {}
            config.providers[selectedProvider] = trimmedKey
            config.activeProvider = selectedProvider
            config.activeModel = finalModel
            config.authPriority = 'byok'
            await saveConfig(config)

            const { fetchLiveProviderModels } = await import('../utils/models')
            fetchLiveProviderModels(selectedProvider, trimmedKey).catch(() => {})

            if (agent) {
                agent.setLLM(testProvider)
                agent.modelOptions = { ...agent.modelOptions, model: finalModel }
            }
            setActiveModel(finalModel)
            setIsAuthenticated(true)
            setSelectedProvider(selectedProvider)
            setAuthMethod('byok')

            const { getAuthStatus, getProviderConfig } = await import('../config')
            const authStatus = await getAuthStatus()
            const newProviderConfig = await getProviderConfig()
            if (newProviderConfig) {
                setAuthMethod(newProviderConfig.authMethod)
            }
            setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
            setSettingsAuthPriority(authStatus.authPriority)

            setAuthMode('none')
            setApiKey('')
            addToast(MESSAGES.AUTH.API_KEY_SAVED(selectedProvider), 'success')
        } catch (err: any) {
            const errStr =
                `${err?.message || ''} ${err?.code || ''} ${err?.error?.code || ''} ${String(err)}`.toLowerCase()
            const isTimeout =
                err?.name === 'AbortError' ||
                errStr.includes('aborted') ||
                errStr.includes('timed out') ||
                errStr.includes('timeout')
            const isLowCredit =
                errStr.includes('402') ||
                errStr.includes('credits') ||
                errStr.includes('payment') ||
                errStr.includes('afford') ||
                errStr.includes('budget') ||
                errStr.includes('balance') ||
                errStr.includes('insufficient_quota')

            if (
                errStr.includes('429') ||
                errStr.includes('quota') ||
                errStr.includes('rate limit') ||
                errStr.includes('404') ||
                errStr.includes('not found') ||
                errStr.includes('503') ||
                errStr.includes('无可用渠道') ||
                errStr.includes('no available channel') ||
                errStr.includes('platform_keys_unavailable') ||
                errStr.includes('byok_keys_required') ||
                errStr.includes('tier_opt_in_required') ||
                errStr.includes('no_provider_available') ||
                isLowCredit
            ) {
                const { getDefaultModelForProvider } = await import('../utils/models')
                const finalModel = testModel || getDefaultModelForProvider(selectedProvider)

                const config = await loadConfig()
                config.providers = config.providers || {}
                config.providers[selectedProvider] = trimmedKey
                config.activeProvider = selectedProvider
                config.activeModel = finalModel
                config.authPriority = 'byok'
                await saveConfig(config)

                if (agent) {
                    agent.setLLM(testProvider)
                    agent.modelOptions = { ...agent.modelOptions, model: finalModel }
                }
                setActiveModel(finalModel)
                setIsAuthenticated(true)
                setSelectedProvider(selectedProvider)
                setAuthMethod('byok')

                const { getAuthStatus, getProviderConfig } = await import('../config')
                const authStatus = await getAuthStatus()
                const newProviderConfig = await getProviderConfig()
                if (newProviderConfig) {
                    setAuthMethod(newProviderConfig.authMethod)
                }
                setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
                setSettingsAuthPriority(authStatus.authPriority)

                setAuthMode('none')
                setApiKey('')
                if (isLowCredit) {
                    const topUpUrl =
                        selectedProvider === 'openrouter'
                            ? ' (top up at https://openrouter.ai/settings/credits)'
                            : ''
                    addToast(
                        `API Key saved for ${selectedProvider}, but credit balance is low${topUpUrl}`,
                        'warning'
                    )
                } else {
                    addToast(`API Key saved for ${selectedProvider}`, 'success')
                }
            } else {
                let cleanMessage = err?.message || String(err)
                if (isTimeout) {
                    cleanMessage =
                        'Connection timed out while verifying API key. Please check your network connection or try again.'
                } else if (
                    cleanMessage.includes('fetch failed') ||
                    cleanMessage.includes('ECONNREFUSED') ||
                    cleanMessage.includes('ENOTFOUND') ||
                    cleanMessage.includes('Failed to fetch') ||
                    cleanMessage.includes('Unable to connect')
                ) {
                    cleanMessage = 'Unable to connect. Is the computer able to access the url?'
                } else {
                    try {
                        const parsed = JSON.parse(cleanMessage)
                        if (parsed.error?.message) {
                            cleanMessage = parsed.error.message
                            try {
                                const doubleParsed = JSON.parse(cleanMessage)
                                if (doubleParsed.error?.message) {
                                    cleanMessage = doubleParsed.error.message
                                }
                            } catch {
                                // Keep original cleanMessage if double parse fails
                            }
                        } else if (parsed.message) {
                            cleanMessage = parsed.message
                        }
                    } catch {
                        // Keep original raw message if JSON parse fails
                    }
                }

                let errorText: string
                if (isTimeout) {
                    errorText = `Login failed for ${selectedProvider}: ${cleanMessage}`
                } else if (
                    cleanMessage === 'Unable to connect. Is the computer able to access the url?'
                ) {
                    errorText = `Login failed: ${cleanMessage}`
                } else if (
                    cleanMessage.includes('401') ||
                    cleanMessage.toLowerCase().includes('unauthorized') ||
                    cleanMessage.toLowerCase().includes('invalid api key') ||
                    cleanMessage.toLowerCase().includes('incorrect api key')
                ) {
                    errorText = `Invalid API Key for ${selectedProvider}: ${cleanMessage}`
                } else {
                    errorText = `Login failed for ${selectedProvider}: ${cleanMessage}`
                }

                setAuthError(errorText)
                addToast(errorText, 'error')
            }
        } finally {
            setIsStreaming(false)
        }
    }

    const handleDeleteProvider = async (value: string) => {
        const config = await loadConfig()
        let removedName = ''
        if (value === 'decemberToken') {
            config.decemberToken = undefined
            config.email = undefined
            setCurrentEmail(undefined)
            useCliStore.getState().setHasDecember(false)
            useCliStore.getState().setDecemberEmail(undefined)
            removedName = 'December Cloud Wallet'
            if (
                config.activeProvider === 'december' ||
                config.activeProvider === 'december_proxy'
            ) {
                config.activeProvider =
                    Object.keys(config.subscriptions || {})[0] ||
                    Object.keys(config.providers || {})[0] ||
                    undefined
            }
        } else if (value.startsWith('subscription:')) {
            const provider = value.split(':')[1]
            if (provider) {
                config.subscriptions = config.subscriptions || {}
                delete config.subscriptions[provider]
                const aliasesToUnlink = [provider]
                if (provider === 'claude' || provider === 'anthropic') {
                    delete config.subscriptions['claude']
                    delete config.subscriptions['anthropic']
                    aliasesToUnlink.push('claude', 'anthropic')
                } else if (
                    provider === 'codex' ||
                    provider === 'openai' ||
                    provider === 'chatgpt'
                ) {
                    delete config.subscriptions['codex']
                    delete config.subscriptions['openai']
                    delete config.subscriptions['chatgpt']
                    aliasesToUnlink.push('codex', 'openai', 'chatgpt')
                } else if (
                    provider === 'gemini' ||
                    provider === 'google' ||
                    provider === 'antigravity'
                ) {
                    delete config.subscriptions['gemini']
                    delete config.subscriptions['google']
                    delete config.subscriptions['antigravity']
                    aliasesToUnlink.push('gemini', 'google', 'antigravity')
                } else if (provider === 'copilot' || provider === 'github') {
                    delete config.subscriptions['copilot']
                    delete config.subscriptions['github']
                    aliasesToUnlink.push('copilot', 'github')
                }

                config.unlinkedSubscriptions = config.unlinkedSubscriptions || []
                for (const alias of aliasesToUnlink) {
                    if (!config.unlinkedSubscriptions.includes(alias)) {
                        config.unlinkedSubscriptions.push(alias)
                    }
                }

                removedName = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Subscription`
                const isActiveMatch =
                    config.activeProvider === provider ||
                    (provider === 'claude' && config.activeProvider === 'anthropic') ||
                    (provider === 'codex' &&
                        (config.activeProvider === 'openai' ||
                            config.activeProvider === 'chatgpt')) ||
                    (provider === 'gemini' &&
                        (config.activeProvider === 'google' ||
                            config.activeProvider === 'antigravity')) ||
                    (provider === 'copilot' && config.activeProvider === 'github')

                if (isActiveMatch) {
                    config.activeProvider =
                        Object.keys(config.subscriptions)[0] ||
                        Object.keys(config.providers || {})[0] ||
                        (config.decemberToken ? 'december_proxy' : undefined)
                }
            }
        } else if (value.startsWith('provider:')) {
            const provider = value.split(':')[1]
            if (provider && config.providers) {
                delete config.providers[provider]
                if (provider === 'anthropic' || provider === 'claude') {
                    delete config.providers['anthropic']
                    delete config.providers['claude']
                } else if (
                    provider === 'openai' ||
                    provider === 'codex' ||
                    provider === 'chatgpt'
                ) {
                    delete config.providers['openai']
                    delete config.providers['codex']
                    delete config.providers['chatgpt']
                } else if (provider === 'google' || provider === 'gemini') {
                    delete config.providers['google']
                    delete config.providers['gemini']
                }

                removedName = `${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`
                const isActiveMatch =
                    config.activeProvider === provider ||
                    (provider === 'anthropic' && config.activeProvider === 'claude') ||
                    (provider === 'openai' &&
                        (config.activeProvider === 'codex' ||
                            config.activeProvider === 'chatgpt')) ||
                    (provider === 'google' &&
                        (config.activeProvider === 'gemini' ||
                            config.activeProvider === 'antigravity'))

                if (isActiveMatch) {
                    config.activeProvider =
                        Object.keys(config.subscriptions || {})[0] ||
                        Object.keys(config.providers || {})[0] ||
                        (config.decemberToken ? 'december_proxy' : undefined)
                }
            }
        }
        await saveConfig(config)

        const providerConfig = await getProviderConfig()
        const { getAuthStatus } = await import('../config')
        const authStatus = await getAuthStatus()

        setIsAuthenticated(!!providerConfig)
        setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
        useCliStore.getState().setHasDecember(authStatus.hasDecember)
        setSettingsAuthPriority(authStatus.authPriority)

        if (providerConfig && agent) {
            const llm = instantiateProvider(providerConfig.provider, providerConfig.apiKey, {
                authMethod: providerConfig.authMethod,
                subscription: providerConfig.subscription,
                headers: providerConfig.headers,
                baseURL: providerConfig.baseURL,
            })
            agent.setLLM(llm)
            config.activeModel = providerConfig.model
            await saveConfig(config)
            agent.modelOptions = { ...agent.modelOptions, model: providerConfig.model }
            setActiveModel(providerConfig.model)
            setSelectedProvider(providerConfig.provider)
            setAuthMethod(providerConfig.authMethod)
        } else {
            setActiveModel('')
            setSelectedProvider(undefined)
            setAuthMethod(undefined)
        }

        const remainingConfigured = getConfiguredProviders(config)
        const updatedMenuItems = remainingConfigured.map((item) => ({
            label: item.label,
            value: item.value,
            model: item.model,
            isActive: item.isActive,
        }))
        setSwitchItems(updatedMenuItems)

        if (updatedMenuItems.length === 0) {
            setAuthMode('none')
        }

        setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
        setActiveMessages([])
        addToast(`Removed credentials for: ${removedName}`, 'success')
    }

    const handleLogoutSelect = handleDeleteProvider

    const handleSwitchSelect = async (value: string) => {
        const config = await loadConfig()
        const target = resolveSwitchTarget(config, value)
        if (!target) {
            setAuthMode('none')
            addToast('Provider configuration not found', 'error')
            return
        }

        const { config: updatedConfig, model } = applyProviderSwitch(config, target)
        await saveConfig(updatedConfig)
        setAuthMode('none')

        const providerConfig = await getProviderConfig()
        const { getAuthStatus } = await import('../config')
        const authStatus = await getAuthStatus()

        setIsAuthenticated(!!providerConfig)
        setHasBothAuth(authStatus.hasByok && authStatus.hasDecember)
        setSettingsAuthPriority(authStatus.authPriority)

        if (providerConfig && agent) {
            const llm = instantiateProvider(providerConfig.provider, providerConfig.apiKey, {
                authMethod: providerConfig.authMethod,
                subscription: providerConfig.subscription,
                headers: providerConfig.headers,
                baseURL: providerConfig.baseURL,
            })
            agent.setLLM(llm)
            agent.modelOptions = { ...agent.modelOptions, model: providerConfig.model }
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

        setStaticMessages((prev) => [...prev, ...useCliStore.getState().activeMessages])
        setActiveMessages([])
        const displayName = formatProviderName(target.provider)
        addToast(`Switched to ${displayName} (${target.authPriority}) • ${model}`, 'success')
    }

    const handleSessionSelect = async (item: any) => {
        setAuthMode('none')
        try {
            await agent.loadContext(item.value)
            const resumedMessages = convertAgentMessagesToTuiMessages(agent.messages)
            setStaticMessages([{ id: 'header', role: 'header' }, ...resumedMessages])
            setStaticKey((k) => k + 1)
            setActiveMessages([])
            addToast(`Resumed session: ${item.value}`, 'success')
        } catch (err: any) {
            addToast(`Failed to resume session: ${err.message}`, 'error')
        }
    }

    const handleOpenDeviceAuthUrl = async () => {
        const url = useCliStore.getState().pendingDeviceAuthUrl
        if (url) {
            const { openUrl } = await import('../utils/open')
            await openUrl(url).catch(() => {
                // Intentionally swallowed: browser launch error handled
            })
            addToast('Opening authorization link in browser...', 'info')
        }
    }

    const handleAbortAuth = () => {
        if (deviceAuthAbortRef.current) {
            deviceAuthAbortRef.current.abort()
            deviceAuthAbortRef.current = null
        }
        useCliStore.getState().setPendingDeviceAuthUrl(null)
        useCliStore.getState().setIsStreaming(false)
        useCliStore.getState().setAuthMode('none')
    }

    return {
        handleAuthMenuSelect,
        handleModelSelect,
        handleProviderSelect,
        handleByokSelect: handleProviderSelect,
        handleSubscriptionSelect,
        handleKeySubmit,
        handleLogoutSelect,
        handleDeleteProvider,
        handleSwitchSelect,
        handleSessionSelect,
        handleOpenDeviceAuthUrl,
        handleAbortAuth,
    }
}
