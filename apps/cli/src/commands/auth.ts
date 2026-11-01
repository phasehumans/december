import {
    loadConfig,
    saveConfig,
    getConfiguredProviders,
    resolveSwitchTarget,
    applyProviderSwitch,
    formatProviderName,
} from '../config'

export async function handleLogoutCommand(options?: { provider?: string }): Promise<void> {
    const config = await loadConfig()
    const targetProvider = options?.provider?.toLowerCase().trim()

    if (targetProvider) {
        let removed = false
        if (config.subscriptions && config.subscriptions[targetProvider]) {
            delete config.subscriptions[targetProvider]
            removed = true
        }
        if (config.providers && config.providers[targetProvider]) {
            delete config.providers[targetProvider]
            removed = true
        }
        if (targetProvider === 'december' && config.decemberToken) {
            delete config.decemberToken
            delete config.email
            removed = true
        }
        if (config.activeProvider === targetProvider) {
            delete config.activeProvider
            delete config.activeModel
        }
        await saveConfig(config)
        if (removed) {
            console.log(`Logged out of ${targetProvider} successfully. Stored credentials removed.`)
        } else {
            console.log(`No active credentials found for ${targetProvider}.`)
        }
        return
    }

    delete config.decemberToken
    delete config.email
    config.providers = {}
    config.subscriptions = {}
    delete config.activeProvider
    delete config.activeModel

    await saveConfig(config)
    console.log('Logged out successfully. Stored credentials removed.')
}

export async function handleSwitchCommand(options?: { provider?: string }): Promise<void> {
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'

    const targetProvider = options?.provider?.toLowerCase().trim()
    const config = await loadConfig()

    if (targetProvider) {
        const target = resolveSwitchTarget(config, targetProvider)
        if (!target) {
            console.error(`\n${RED}Error:${RESET} Provider "${targetProvider}" is not configured.`)
            console.error(
                `Run ${WHITE}december login${RESET}, ${WHITE}december link <provider>${RESET}, or ${WHITE}december key <provider>${RESET} to configure it.\n`
            )
            process.exitCode = 1
            return
        }

        const { config: updatedConfig, model } = applyProviderSwitch(config, target)
        await saveConfig(updatedConfig)

        const { fetchLiveProviderModels } = await import('../utils/models')
        if (
            target.authPriority === 'subscription' &&
            updatedConfig.subscriptions?.[target.provider]
        ) {
            const bundle = updatedConfig.subscriptions[target.provider]
            fetchLiveProviderModels(target.provider, bundle.accessToken, bundle.endpoint).catch(
                () => {
                    // Intentionally swallowed: background live model fetch failure
                }
            )
        } else if (target.authPriority === 'byok' && updatedConfig.providers?.[target.provider]) {
            fetchLiveProviderModels(
                target.provider,
                updatedConfig.providers[target.provider]
            ).catch(() => {
                // Intentionally swallowed: background live model fetch failure
            })
        }

        const displayName = formatProviderName(target.provider)
        console.log(
            `\n${GREEN}Successfully switched active provider to ${displayName} (${target.authPriority}) with model: ${WHITE}${model}${RESET}!\n`
        )
        return
    }

    const items = getConfiguredProviders(config)
    console.log(`\n${BLUE}✱${RESET}  ${WHITE}December CLI Configured Providers${RESET}\n`)

    if (items.length === 0) {
        console.log(
            `  ${GRAY}No configured providers found.${RESET} Run ${WHITE}december login${RESET}, ${WHITE}december link <provider>${RESET}, or ${WHITE}december key <provider>${RESET} to add one.\n`
        )
        return
    }

    for (const item of items) {
        const activeTag = item.isActive ? ` ${GREEN}(Active)${RESET}` : ''
        console.log(`  • ${WHITE}${item.label}${RESET}${activeTag}`)
    }
    console.log(`\n${GRAY}Switch provider:${RESET} ${GREEN}december switch <provider>${RESET}\n`)
}

export async function handleAuthCommand(options?: { action?: string }): Promise<void> {
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'

    const action = (options?.action || 'status').toLowerCase().trim()

    if (action === 'import') {
        console.log(
            `\n${BLUE}✱${RESET}  ${WHITE}Scanning local environment for subscription credentials...${RESET}\n`
        )
        const { importLocalSubscriptions } =
            await import('../auth/subscriptions/subscription-manager')
        const result = await importLocalSubscriptions()

        if (result.imported.length === 0) {
            console.log(
                `  ${YELLOW}ℹ No local subscription credentials found in standard CLI directories (~/.claude, ~/.codex, ~/.config/github-copilot, Google ADC).${RESET}`
            )
            console.log(
                `    ${GRAY}Run ${WHITE}december login <provider>${GRAY} to authenticate directly via OAuth.${RESET}\n`
            )
            return
        }

        console.log(
            `  ${GREEN}Successfully detected and imported ${result.imported.length} subscription credential(s):${RESET}\n`
        )
        for (const [provider, bundle] of Object.entries(result.bundles)) {
            const typeStr = bundle.subscriptionType ? ` (${bundle.subscriptionType})` : ''
            const userStr =
                bundle.email || bundle.accountName ? ` - ${bundle.email || bundle.accountName}` : ''
            console.log(
                `  • ${WHITE}${provider.toUpperCase()}${RESET}${typeStr}${GRAY}${userStr}${RESET}`
            )
            if (bundle.expiresAt) {
                const expDate = new Date(bundle.expiresAt).toLocaleDateString()
                console.log(`    ${GRAY}↳ Expires: ${expDate}${RESET}`)
            }
        }
        console.log(
            `\n  ${GREEN}Active subscriptions are now available for agent execution!${RESET}\n`
        )
        return
    }

    // Default: status
    const config = await loadConfig()
    const { getAuthStatus } = await import('../config')
    const authStatus = await getAuthStatus()

    console.log(
        `\n${BLUE}✱${RESET}  ${WHITE}December CLI Authentication & Subscription Status${RESET}\n`
    )

    // Subscriptions
    const subKeys = config.subscriptions ? Object.keys(config.subscriptions) : []
    console.log(`${WHITE}Subscriptions:${RESET}`)
    if (subKeys.length > 0) {
        for (const k of subKeys) {
            const sub = config.subscriptions![k]
            const typeStr = sub.subscriptionType ? ` [${sub.subscriptionType}]` : ''
            const userStr = sub.email || sub.accountName ? ` (${sub.email || sub.accountName})` : ''
            const expStr = sub.expiresAt
                ? sub.expiresAt > Date.now()
                    ? `${GREEN}Valid${RESET}`
                    : `${YELLOW}Expired (will auto-refresh)${RESET}`
                : `${GREEN}Active${RESET}`
            console.log(`  • ${WHITE}${k.toUpperCase()}${RESET}${typeStr}${userStr}: ${expStr}`)
        }
    } else {
        console.log(
            `  ${GRAY}No subscriptions configured.${RESET} (Run ${WHITE}december auth import${RESET} or ${WHITE}december login <provider>${RESET})`
        )
    }
    console.log('')

    // BYOK
    const byokKeys = config.providers ? Object.keys(config.providers) : []
    console.log(`${WHITE}BYOK API Keys:${RESET}`)
    if (byokKeys.length > 0) {
        for (const k of byokKeys) {
            console.log(`  • ${WHITE}${k.toUpperCase()}${RESET}`)
        }
    } else {
        console.log(`  ${GRAY}No BYOK API keys saved in config.${RESET}`)
    }
    console.log('')

    // December Cloud
    console.log(`${WHITE}December Cloud Wallet:${RESET}`)
    if (config.decemberToken) {
        console.log(`  • ${GREEN}Connected${RESET} ${config.email ? `(${config.email})` : ''}`)
    } else {
        console.log(`  ${GRAY}Not connected.${RESET}`)
    }
    console.log('')

    console.log(
        `${WHITE}Active Auth Priority:${RESET} ${GREEN}${config.authPriority || authStatus.authPriority}${RESET}`
    )
    console.log(
        `${WHITE}Active Provider:${RESET}      ${GREEN}${config.activeProvider || 'none'}${RESET} (Model: ${config.activeModel || 'default'})\n`
    )
}

export async function handleLinkCommand(options?: { provider?: string }): Promise<void> {
    const targetProvider = (options?.provider || '').toLowerCase().trim()
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const RESET = '\x1b[0m'

    if (!targetProvider) {
        console.log(
            `\n${BLUE}✱${RESET}  ${WHITE}Link an AI Subscription (Flat-rate / OAuth)${RESET}`
        )
        console.log(`\nUsage: ${GREEN}december link <provider>${RESET}`)
        console.log(`\nSupported Providers:`)
        console.log(`  • ${WHITE}claude${RESET}    - Anthropic (Claude)`)
        console.log(`  • ${WHITE}copilot${RESET}   - GitHub (Copilot)`)
        console.log(`  • ${WHITE}gemini${RESET}    - Google (Antigravity)`)
        console.log(`  • ${WHITE}chatgpt${RESET}   - OpenAI (ChatGPT)\n`)
        return
    }

    return handleLoginCommand({ provider: targetProvider })
}

export async function handleKeyCommand(options?: {
    provider?: string
    key?: string
}): Promise<void> {
    const provider = (options?.provider || '').toLowerCase().trim()
    const key = options?.key?.trim()
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const RESET = '\x1b[0m'

    if (!provider) {
        console.log(
            `\n${BLUE}✱${RESET}  ${WHITE}Save a BYOK (Bring Your Own Key) API Provider${RESET}`
        )
        console.log(`\nUsage: ${GREEN}december key <provider> [api-key]${RESET}`)
        console.log(`\nExamples:`)
        console.log(`  december key openai sk-...`)
        console.log(`  december key anthropic sk-ant-...`)
        console.log(`  december key openrouter sk-or-...`)
        console.log(`  december key deepseek sk-...`)
        console.log(`  december key groq gsk_...`)
        console.log(`  december key cerebras csk_...`)
        console.log(`  december key sakana sk_...\n`)
        return
    }

    let finalKey = key
    if (!finalKey) {
        const readline = await import('node:readline/promises')
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        finalKey = (await rl.question(`Enter API key for ${provider.toUpperCase()}: `)).trim()
        rl.close()
    }

    if (!finalKey) {
        console.log('No API key provided. Operation cancelled.')
        return
    }

    const isSTTProvider = provider.toLowerCase() === 'deepgram'

    const config = await loadConfig()
    config.providers = config.providers || {}
    config.providers[provider] = finalKey

    if (!isSTTProvider) {
        const { getDefaultModelForProvider } = await import('../utils/models')
        const defaultModel = getDefaultModelForProvider(provider)
        config.activeProvider = provider
        config.activeModel = defaultModel
        config.authPriority = 'byok'
        await saveConfig(config)

        const { fetchLiveProviderModels } = await import('../utils/models')
        fetchLiveProviderModels(provider, finalKey).catch(() => {
            // Intentionally swallowed: background live model fetch failure
        })

        console.log(
            `\n${GREEN}Successfully saved API key for ${provider.toUpperCase()} (Model: ${defaultModel})!${RESET}\n`
        )
    } else {
        await saveConfig(config)
        console.log(
            `\n${GREEN}Successfully saved API key for DEEPGRAM (Live Voice Dictation)!${RESET}\n`
        )
    }
}

export async function handleLoginCommand(options?: {
    provider?: string
    token?: string
}): Promise<void> {
    const { loadConfig, saveConfig } = await import('../config')

    if (options?.token) {
        const token = options.token.trim()
        console.log('\nValidating December session token...')
        const serverUrl = process.env.SERVER_URL || 'https://api.trydecember.com'
        try {
            const overviewRes = await fetch(`${serverUrl}/api/v1/billing/overview`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000),
            })
            if (!overviewRes.ok && overviewRes.status === 401) {
                console.error(
                    '\x1b[31mError: Provided session token is invalid or expired.\x1b[0m\n'
                )
                return
            }
        } catch {
            // Intentionally swallowed: allow network error fallback during token save
        }

        const configToSave = await loadConfig()
        configToSave.decemberToken = token
        configToSave.authPriority = 'december'
        configToSave.activeModel = 'december-auto'
        await saveConfig(configToSave)
        console.log('\x1b[32mSuccessfully logged in via December session token!\x1b[0m\n')
        return
    }

    const targetProvider = (options?.provider || 'december').toLowerCase().trim()

    if (
        targetProvider === 'copilot' ||
        targetProvider === 'github' ||
        targetProvider === 'claude' ||
        targetProvider === 'codex' ||
        targetProvider === 'chatgpt' ||
        targetProvider === 'openai' ||
        targetProvider === 'gemini' ||
        targetProvider === 'google' ||
        targetProvider === 'antigravity'
    ) {
        const {
            loginSubscription,
            formatSubscriptionDisplayName,
            formatSubscriptionSuccessMessage,
            formatSubscriptionCard,
        } = await import('../auth/subscriptions')
        const providerName = formatSubscriptionDisplayName(targetProvider)
        console.log(`\nInitiating subscription login for ${providerName}...`)
        const bundle = await loginSubscription(targetProvider, (code, uri) => {
            console.log(
                `\nPlease open ${uri} in your browser and enter code: ${code}\nWaiting for authorization...`
            )
            if (targetProvider === 'copilot' || targetProvider === 'github') {
                console.log(
                    '*(Note: Ensure your browser is signed into the GitHub account that owns your active Copilot subscription)*'
                )
            }
        })
        const configToSave = await loadConfig()
        configToSave.subscriptions = configToSave.subscriptions || {}
        configToSave.subscriptions[bundle.provider] = bundle
        configToSave.activeProvider = bundle.provider
        configToSave.authPriority = 'subscription'
        await saveConfig(configToSave)

        const { fetchLiveProviderModels } = await import('../utils/models')
        fetchLiveProviderModels(bundle.provider, bundle.accessToken, bundle.endpoint).catch(() => {
            // Intentionally swallowed: background live model fetch failure
        })

        const GREEN = '\x1b[38;2;110;231;183m'
        const RESET = '\x1b[0m'

        console.log(`\n${GREEN}${formatSubscriptionSuccessMessage(bundle.provider)}${RESET}`)
        console.log(formatSubscriptionCard(bundle))
        console.log()
        return
    }

    // Default December device code login
    const config = await loadConfig()
    if (config.decemberToken) {
        const userEmail = config.email || 'December user'
        if (process.stdin.isTTY) {
            const readline = await import('node:readline/promises')
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
            const answer = (
                await rl.question(
                    `\nYou are already logged in as ${userEmail}.\nDo you want to switch to a different account? (y/n): `
                )
            )
                .trim()
                .toLowerCase()
            rl.close()

            if (answer !== 'y' && answer !== 'yes') {
                console.log(`\nAlready logged in as ${userEmail}. Keeping current session.\n`)
                return
            }
        }
    }

    const { loginViaDeviceCode } = await import('../auth')
    const { openUrl } = await import('../utils/open')
    console.log('\nGenerating device code for December login...')

    let keypressListener: ((data: Buffer) => void) | null = null
    const cleanupKeypress = () => {
        if (keypressListener && process.stdin.isTTY) {
            process.stdin.removeListener('data', keypressListener)
            keypressListener = null
            try {
                process.stdin.setRawMode(false)
                process.stdin.pause()
            } catch {
                // Intentionally swallowed: stdin raw mode cleanup fallback
            }
        }
    }

    try {
        const { token, email } = await loginViaDeviceCode(undefined, (code, uri) => {
            const fullUrl = uri.includes('?')
                ? `${uri}&code=${encodeURIComponent(code)}`
                : `${uri}?code=${encodeURIComponent(code)}`

            console.log(`\nConfirm code: ${code}\nOpen URL: ${fullUrl}\n\nWaiting for approval...`)

            if (process.stdin.isTTY) {
                try {
                    process.stdin.setRawMode(true)
                    process.stdin.resume()
                    keypressListener = (data: Buffer) => {
                        const char = data.toString()
                        if (char === 'o' || char === 'O') {
                            openUrl(fullUrl).catch(() => {
                                // Intentionally swallowed: browser launch error handled
                            })
                        } else if (char === '\u0003') {
                            cleanupKeypress()
                            process.exit(0)
                        }
                    }
                    process.stdin.on('data', keypressListener)
                } catch {
                    // Intentionally swallowed: raw mode error fallback
                }
            }
        })
        cleanupKeypress()
        const configToSave = await loadConfig()
        configToSave.decemberToken = token
        if (email) configToSave.email = email
        configToSave.authPriority = 'december'
        configToSave.activeModel = 'december-auto'
        await saveConfig(configToSave)
        console.log('\x1b[32mSuccessfully logged in via device code!\x1b[0m\n')
    } catch (err) {
        cleanupKeypress()
        throw err
    }
}
