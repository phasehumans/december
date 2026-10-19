import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import pkg from '../package.json' with { type: 'json' }

import {
    loadConfig,
    saveConfig,
    getConfiguredProviders,
    resolveSwitchTarget,
    applyProviderSwitch,
    formatProviderName,
} from './config'

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

        const { fetchLiveProviderModels } = await import('./utils/models')
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
            await import('./auth/subscriptions/subscription-manager')
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
    const { getAuthStatus } = await import('./config')
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
        const { getDefaultModelForProvider } = await import('./utils/models')
        const defaultModel = getDefaultModelForProvider(provider)
        config.activeProvider = provider
        config.activeModel = defaultModel
        config.authPriority = 'byok'
        await saveConfig(config)

        const { fetchLiveProviderModels } = await import('./utils/models')
        fetchLiveProviderModels(provider, finalKey).catch(() => {})

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

export async function handleLoginCommand(options?: { provider?: string }): Promise<void> {
    const targetProvider = (options?.provider || 'december').toLowerCase().trim()
    const { loadConfig, saveConfig } = await import('./config')

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
            formatSubscriptionPlan,
            formatSubscriptionIdentity,
            formatSubscriptionSuccessMessage,
            formatSubscriptionCard,
        } = await import('./auth/subscriptions')
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

        const { fetchLiveProviderModels } = await import('./utils/models')
        fetchLiveProviderModels(bundle.provider, bundle.accessToken, bundle.endpoint).catch(
            () => {}
        )

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

    const { loginViaDeviceCode } = await import('./auth')
    const { openUrl } = await import('./utils/open')
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

            console.log(
                `\nConfirm code: ${code}\nOpen URL: ${fullUrl}\n\nPress [o] to open in browser · Esc to cancel\nWaiting for approval...`
            )

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
                        } else if (char === '\u0003' || char === '\u001b') {
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

export async function handleUpdateCommand(options?: { force?: boolean }): Promise<void> {
    const { performCliUpdate } = await import('./utils/updater')
    const { TreeReporter } = await import('./utils/tree-reporter')
    const reporter = new TreeReporter()

    console.log('')
    reporter.step('checking December CLI for updates...')
    reporter.space()
    reporter.startSpinner('fetching latest release information...')

    const result = await performCliUpdate({
        currentVersion: pkg.version,
        force: options?.force,
        onResolvedVersion: (info) => {
            reporter.stopSpinner()
            reporter.item('current version', `v${info.currentVersion}`)
            if (info.targetVersion) {
                reporter.item('latest version', `v${info.targetVersion}`)
            }
            if (info.activeBinaryPath) {
                reporter.item('active binary', info.activeBinaryPath)
            }
            reporter.space()
        },
        onProgress: (msg) => {
            reporter.startSpinner(msg)
        },
    })

    reporter.stopSpinner()

    if (result.method === 'source') {
        reporter.step('December CLI development build')
        reporter.space()
        reporter.tree('detected local source development repository.')
        reporter.tree('to rebuild or update your local dev build, run:')
        reporter.tree('git pull && bun install && bun --cwd apps/cli run build')
        reporter.space()
        reporter.step('ready')
        console.log('')
        return
    }

    if (result.method === 'npx') {
        reporter.step('December CLI ephemeral build')
        reporter.space()
        reporter.tree('running via npx/bunx ephemeral execution.')
        reporter.tree('each invocation automatically pulls the latest version.')
        reporter.space()
        reporter.step('ready')
        console.log('')
        return
    }

    if (result.alreadyUpToDate) {
        reporter.tree(
            `you are already using the latest version of December CLI (v${result.installedVersion || result.targetVersion}).`
        )
        reporter.tree('use december update --force to reinstall.')
        reporter.space()
        reporter.step('nothing to update')
        console.log('')
        return
    }

    if (result.success && result.verified) {
        reporter.step('updating December CLI...')
        reporter.space()
        if (result.targetVersion) {
            reporter.item('updated to', `v${result.installedVersion || result.targetVersion}`)
        }
        reporter.item('method', result.method)
        reporter.space()
        reporter.success(`package successfully updated via ${result.method}`)

        if (result.collisionFixed && result.cleanedBinaries && result.cleanedBinaries.length > 0) {
            reporter.success(
                `aligned ${result.cleanedBinaries.length} older conflicting binary location(s)`
            )
            for (const b of result.cleanedBinaries) {
                reporter.tree(`• cleaned: ${b}`)
            }
        }

        if (result.shellHashNotice) {
            reporter.space()
            reporter.warn('shell cached previous binary path.')
            reporter.tree('run "hash -r" (bash) or "rehash" (zsh) or restart terminal.')
        }

        reporter.space()
        reporter.step('update complete')
        reporter.space()
        reporter.tree('run december to start your session')
        reporter.space()
        reporter.step('ready')
        console.log('')
    } else {
        reporter.step('update attention needed')
        reporter.space()

        if (!result.verified && result.shadowingBinary) {
            reporter.warn('update completed, but active terminal still starts an older version!')
            reporter.space()
            reporter.item(
                'installed version',
                `v${result.installedVersion || result.targetVersion} (${result.method})`
            )
            reporter.item(
                'active in $path',
                `v${result.activeVersion || 'older'} (${result.activeBinaryPath || result.shadowingBinary.path})`
            )
            reporter.space()
            reporter.tree(
                'reason: your shell resolves the older path before the newly updated location.'
            )

            if (result.failedBinaries && result.failedBinaries.some((b) => b.needsSudo)) {
                reporter.space()
                reporter.warn('elevated permissions required to clean older binary:')
                for (const fb of result.failedBinaries) {
                    if (fb.needsSudo) {
                        reporter.tree(`sudo rm "${fb.path}"`)
                    }
                }
            } else {
                reporter.space()
                reporter.tree('to ensure your terminal uses the latest version:')
                reporter.tree(`1. remove older binary: rm "${result.shadowingBinary.path}"`)
                reporter.tree(`2. or rehash shell cache: hash -r (bash) or rehash (zsh)`)
            }
            reporter.space()
            reporter.step('action required')
        } else if (result.isPermissionError) {
            reporter.error('permission denied while installing global package')
            reporter.space()
            reporter.tree('try running with elevated permissions:')
            reporter.tree(result.sudoCmd || result.manualCmd)
            reporter.space()
            reporter.step('update failed')
        } else {
            reporter.error(`update failed via ${result.method}: ${result.error || 'Unknown error'}`)
            reporter.space()
            reporter.tree('try running manually:')
            reporter.tree(result.manualCmd)
            reporter.space()
            reporter.step('update failed')
        }
        console.log('')
        process.exitCode = 1
    }
}

export async function handleDoctorCommand(options?: { fix?: boolean }): Promise<void> {
    const { diagnoseBinaryCollisions, resolveAndCleanStaleBinaries } =
        await import('./utils/bin-discovery')
    const { getAuthStatus, loadConfig } = await import('./config')

    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'

    console.log(`\n${BLUE}✱${RESET}  ${WHITE}December CLI Health & Environment Doctor${RESET}\n`)

    // 1. Environment & Runtime
    const runtimeName =
        typeof (process as any).isBun !== 'undefined' || process.versions.bun ? 'Bun' : 'Node.js'
    const runtimeVer = (process.versions as any).bun || process.versions.node
    console.log(`${WHITE}Environment & Runtime:${RESET}`)
    console.log(`  • CLI Package Version: ${GREEN}v${pkg.version}${RESET}`)
    console.log(
        `  • Runtime:             ${GRAY}${runtimeName} v${runtimeVer} (${process.platform}-${process.arch})${RESET}`
    )
    console.log(`  • Process Executable:  ${GRAY}${process.execPath}${RESET}`)
    console.log(`  • Executing Script:    ${GRAY}${process.argv[1] || 'unknown'}${RESET}`)
    console.log('')

    // 2. Binary Installations & PATH Collisions
    console.log(`${WHITE}Installed Binaries & $PATH Precedence:${RESET}`)
    const diagnosis = await diagnoseBinaryCollisions({ argv1: process.argv[1] })

    if (diagnosis.allBinaries.length === 0) {
        console.log(`  ${YELLOW}⚠ No standalone binaries found in standard PATH entries.${RESET}`)
    } else {
        for (const bin of diagnosis.allBinaries) {
            const statusTag = bin.isActive
                ? `${GREEN}[ACTIVE]${RESET}`
                : `${YELLOW}[SHADOWED]${RESET}`
            const verStr = bin.version ? `v${bin.version}` : 'unknown'
            console.log(
                `  • ${statusTag} ${WHITE}${verStr}${RESET} (${bin.manager}) -> ${GRAY}${bin.path}${RESET}`
            )
            if (bin.isSymlink) {
                console.log(`    ${GRAY}↳ points to: ${bin.realPath}${RESET}`)
            }
        }
    }
    console.log('')

    // 3. Collision Resolution / Fix
    if (diagnosis.hasCollision) {
        if (options?.fix) {
            console.log(`${BLUE}✱${RESET}  ${WHITE}Resolving binary collisions (--fix)...${RESET}`)
            const target = diagnosis.activeBinary || diagnosis.allBinaries[0]
            if (target) {
                const { cleanedOrForwarded, failedBinaries } = await resolveAndCleanStaleBinaries(
                    target,
                    diagnosis.allBinaries
                )
                if (cleanedOrForwarded.length > 0) {
                    console.log(
                        `  ${GREEN}Forwarded ${cleanedOrForwarded.length} shadowed binary path(s) to primary active binary (${target.path}).${RESET}`
                    )
                    console.log(
                        `  ${YELLOW}ℹ Run "hash -r" (bash) or restart your terminal to apply.${RESET}\n`
                    )
                } else if (failedBinaries.length === 0) {
                    console.log(`  ${GREEN}All binary links are already aligned.${RESET}\n`)
                }

                if (failedBinaries.length > 0) {
                    console.log(
                        `  ${RED}Failed to forward ${failedBinaries.length} binary path(s) due to permissions:${RESET}`
                    )
                    for (const fb of failedBinaries) {
                        if (fb.needsSudo) {
                            console.log(
                                `    ${YELLOW}• ${fb.path} -> Run: sudo rm "${fb.path}" (or sudo ln -sf "${target.path}" "${fb.path}")${RESET}`
                            )
                        } else {
                            console.log(`    ${YELLOW}• ${fb.path}: ${fb.error}${RESET}`)
                        }
                    }
                    console.log('')
                }
            }
        } else {
            console.log(
                `  ${YELLOW}⚠ Multiple installations detected!${RESET} ${GRAY}Run ${WHITE}december doctor --fix${GRAY} to auto-align stale paths.${RESET}\n`
            )
        }
    } else {
        console.log(`  ${GREEN}No binary collisions detected. Clean single installation.${RESET}\n`)
    }

    // 4. Configuration & Auth
    const config = await loadConfig()
    const authStatus = await getAuthStatus()
    console.log(`${WHITE}Configuration & Authentication:${RESET}`)

    const subCount = config.subscriptions ? Object.keys(config.subscriptions).length : 0
    if (subCount > 0) {
        const subList = Object.keys(config.subscriptions!).join(', ')
        console.log(`  • Subscriptions:       ${GREEN}${subCount} active${RESET} (${subList})`)
    } else {
        console.log(
            `  • Subscriptions:       ${GRAY}None detected${RESET} (Run "december auth import")`
        )
    }

    if (authStatus.hasDecember) {
        console.log(
            `  • December Cloud:      ${GREEN}Connected${RESET} ${config.email ? `(${config.email})` : ''}`
        )
    } else {
        console.log(`  • December Cloud:      ${GRAY}Not logged in${RESET} (Run "december login")`)
    }

    const providerCount = config.providers ? Object.keys(config.providers).length : 0
    if (providerCount > 0) {
        console.log(
            `  • BYOK Providers:      ${GREEN}${providerCount} configured${RESET} (Active: ${config.activeProvider || 'none'}, Model: ${config.activeModel || 'default'})`
        )
    } else {
        console.log(`  • BYOK Providers:      ${GRAY}None configured${RESET}`)
    }

    console.log(
        `  • Auth Priority:       ${GRAY}${config.authPriority || authStatus.authPriority}${RESET}`
    )
    console.log('')
}

export function resolveDocsSectionPath(section?: string): string {
    if (!section) return ''
    const clean = section.replace(/^\/+/, '').toLowerCase().trim()
    const map: Record<string, string> = {
        intro: '',
        introduction: '',
        overview: '',
        quickstart: '/quickstart',
        'quick-start': '/quickstart',
        start: '/quickstart',
        guide: '/quickstart',
        arch: '/architecture',
        architecture: '/architecture',
        cli: '/cli',
        commands: '/cli',
        terminal: '/cli',
        privacy: '/privacy',
        terms: '/terms',
        changelog: '/changelog/',
    }
    return map[clean] !== undefined ? map[clean] : `/${clean}`
}

export async function handleChangelogCommand(): Promise<void> {
    const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(/\/$/, '')
    const targetUrl = `${baseUrl}/docs/changelog/`

    console.log('Opening December changelog in your default browser...')
    console.log(`\x1b[38;2;135;178;244m${targetUrl}\x1b[0m`)

    try {
        const { openUrl } = await import('./utils/open')
        await openUrl(targetUrl)
    } catch {
        // Intentionally swallowed: fallback URL is printed above for headless environments
    }
}

export async function handleDocsCommand(options?: { section?: string }): Promise<void> {
    const rawSection = options?.section?.toLowerCase().trim()
    const sectionPath = resolveDocsSectionPath(rawSection)
    const baseUrl = (process.env.WEB_URL || 'https://trydecember.com').replace(/\/$/, '')
    const targetUrl = `${baseUrl}/docs${sectionPath}`

    console.log('Opening December documentation in your default browser...')
    console.log(`\x1b[38;2;135;178;244m${targetUrl}\x1b[0m`)

    try {
        const { openUrl } = await import('./utils/open')
        await openUrl(targetUrl)
    } catch {
        // Intentionally swallowed: fallback URL is printed above for headless environments
    }
}

export async function handleSkillCommand(options?: {
    action?: string
    target?: string
    isGlobal?: boolean
}): Promise<void> {
    const { SkillDiscoveryEngine } = await import('@december/shared')
    const action = (options?.action || 'list').toLowerCase().trim()
    const target = options?.target?.trim()
    const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir()

    switch (action) {
        case 'list': {
            const engine = new SkillDiscoveryEngine({ workspaceDir: process.cwd(), homeDir })
            const skills = engine.discoverAllSkills()

            console.log(`\n\x1b[1mDiscovered Skills (${skills.length}):\x1b[0m\n`)
            if (skills.length === 0) {
                console.log(
                    'No skills discovered. Install skills using "december skill add <repo>".\n'
                )
                return
            }

            for (const s of skills) {
                const originLabel = `[\x1b[38;2;135;178;244m${s.origin}\x1b[0m]`
                const nameLabel = `\x1b[1m/${s.name}\x1b[0m`
                const rawDesc = s.metadata.description || ''
                const desc = rawDesc ? ` - ${rawDesc.replace(/\s+/g, ' ').slice(0, 75)}...` : ''
                console.log(`  ${originLabel} ${nameLabel}${desc}`)
            }
            console.log(
                '\nUse /<skill-name> in the December TUI or "december skill info <name>" for details.\n'
            )
            return
        }

        case 'info': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a skill name: december skill info <name>\n'
                )
                process.exitCode = 1
                return
            }
            const engine = new SkillDiscoveryEngine({ workspaceDir: process.cwd(), homeDir })
            const skills = engine.discoverAllSkills()
            const found = skills.find((s) => s.name.toLowerCase() === target.toLowerCase())
            if (!found) {
                console.error(`\x1b[31mError:\x1b[0m Skill "${target}" not found.\n`)
                process.exitCode = 1
                return
            }

            console.log(`\n\x1b[1mSkill: /${found.name}\x1b[0m`)
            console.log(`Origin: ${found.origin}`)
            console.log(`Path: ${found.directoryPath}`)
            if (found.metadata.argumentHint) {
                console.log(`Arguments: ${found.metadata.argumentHint}`)
            }
            console.log(`\nDescription:\n${found.metadata.description}\n`)
            return
        }

        case 'add': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a repository: december skill add <repo-or-url>\n'
                )
                console.error('Examples:')
                console.error('  december skill add phasehumans/skills')
                console.error('  december skill add mattpocock/skills\n')
                process.exitCode = 1
                return
            }

            const targetDir = options?.isGlobal
                ? path.join(homeDir, '.december', 'skills')
                : path.join(process.cwd(), '.december', 'skills')

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
            }

            let repoUrl = target
            let folderName = target.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
            if (
                !target.startsWith('http://') &&
                !target.startsWith('https://') &&
                !target.startsWith('git@')
            ) {
                repoUrl = `https://github.com/${target}.git`
                const parts = target.split('/')
                folderName = (parts[parts.length - 1] || target).replace(/\.git$/, '')
            }

            const destPath = path.join(targetDir, folderName)
            if (fs.existsSync(destPath)) {
                console.log(
                    `Skill package "${folderName}" already exists at ${destPath}. Updating...`
                )
                try {
                    const { execSync } = await import('node:child_process')
                    execSync('git pull', { cwd: destPath, stdio: 'inherit' })
                    console.log(`\x1b[32mSuccessfully updated skills in ${destPath}\x1b[0m\n`)
                } catch (err: any) {
                    console.error(`Failed to update skill: ${err.message}`)
                    process.exitCode = 1
                }
                return
            }

            console.log(`Downloading skills from ${repoUrl} into ${destPath}...`)
            try {
                const { execSync } = await import('node:child_process')
                execSync(`git clone --depth 1 ${repoUrl} "${destPath}"`, { stdio: 'inherit' })
                console.log(`\n\x1b[32mSuccessfully added skills from ${target}!\x1b[0m`)
                console.log(`Installed to: ${destPath}\n`)
            } catch (err: any) {
                console.error(`Failed to add skill: ${err.message}`)
                process.exitCode = 1
            }
            return
        }

        case 'remove': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a skill name to remove: december skill remove <name>\n'
                )
                process.exitCode = 1
                return
            }

            const localPath = path.join(process.cwd(), '.december', 'skills', target)
            const globalPath = path.join(homeDir, '.december', 'skills', target)

            let removed = false
            if (fs.existsSync(localPath)) {
                fs.rmSync(localPath, { recursive: true, force: true })
                console.log(`Removed local skill: ${localPath}`)
                removed = true
            }
            if (fs.existsSync(globalPath)) {
                fs.rmSync(globalPath, { recursive: true, force: true })
                console.log(`Removed global skill: ${globalPath}`)
                removed = true
            }

            if (!removed) {
                console.error(
                    `Skill "${target}" was not found in local or global .december/skills.\n`
                )
                process.exitCode = 1
            } else {
                console.log(`\x1b[32mSkill "${target}" removed successfully.\x1b[0m\n`)
            }
            return
        }

        default: {
            console.log('\nUsage: december skill [list|info|add|remove] [options]')
            console.log('\nCommands:')
            console.log('  list             List all discovered skills')
            console.log('  info <name>      Display skill metadata and runbook')
            console.log(
                '  add <repo>       Add skills from GitHub (e.g. phasehumans/skills or mattpocock/skills)'
            )
            console.log('  remove <name>    Remove an installed skill package')
            console.log('\nOptions:')
            console.log(
                '  --global, -g     Install or operate on global user skills (~/.december/skills)\n'
            )
        }
    }
}

export async function handleMcpCommand(options?: { action?: string }): Promise<void> {
    const { loadMcpConfig, McpClientManager } = await import('@december/tools')
    const config = await loadMcpConfig({ workspaceDir: process.cwd() })
    const serverKeys = Object.keys(config)

    const BOLD = '\x1b[1m'
    const RESET = '\x1b[0m'
    const GREEN = '\x1b[32m'
    const RED = '\x1b[31m'
    const GRAY = '\x1b[90m'
    const BLUE = '\x1b[34m'

    if (serverKeys.length === 0) {
        console.log(`\n${BOLD}No MCP servers configured.${RESET}\n`)
        console.log('To configure an MCP server, add an "mcpServers" entry in either:')
        console.log(`  • Global: ${GRAY}~/.december/config.json${RESET}`)
        console.log(`  • Project: ${GRAY}.december/mcp.json${RESET}\n`)
        console.log('Example .december/mcp.json:')
        console.log(
            GRAY +
                JSON.stringify(
                    {
                        mcpServers: {
                            postgres: {
                                command: 'npx',
                                args: [
                                    '-y',
                                    '@modelcontextprotocol/server-postgres',
                                    'postgresql://localhost/db',
                                ],
                            },
                            remote: {
                                url: 'http://localhost:8000/sse',
                            },
                        },
                    },
                    null,
                    2
                ) +
                RESET +
                '\n'
        )
        return
    }

    console.log(
        `\n${BOLD}Model Context Protocol (MCP) Servers (${serverKeys.length} configured)${RESET}\n`
    )

    const manager = new McpClientManager({ workspaceDir: process.cwd() })
    const results = await manager.connectAll(config)

    for (const [name, info] of Object.entries(results)) {
        const typeStr =
            info.config && 'command' in info.config && info.config.command ? 'stdio' : 'sse'
        const statusColor =
            info.status === 'connected' ? GREEN : info.status === 'error' ? RED : GRAY
        const statusTag = `${statusColor}● ${info.status.toUpperCase()}${RESET}`

        const target =
            'command' in info.config && info.config.command
                ? `${info.config.command}${info.config.args ? ' ' + info.config.args.join(' ') : ''}`
                : (info.config as any)?.url || (info.config as any)?.endpoint || ''

        console.log(`  ${BOLD}${name}${RESET} [${typeStr}] - ${statusTag}`)
        console.log(`    Target: ${GRAY}${target}${RESET}`)

        if (info.error) {
            console.log(`    ${RED}Error: ${info.error}${RESET}`)
        }

        if (info.tools && info.tools.length > 0) {
            console.log(`    Tools (${info.tools.length}):`)
            for (const tool of info.tools) {
                const desc = tool.description
                    ? ` - ${GRAY}${tool.description.split('\n')[0]}${RESET}`
                    : ''
                console.log(`      • ${BLUE}${tool.name}${RESET}${desc}`)
            }
        } else if (info.status === 'connected') {
            console.log(`    ${GRAY}(No tools exported by this server)${RESET}`)
        }

        console.log('')
    }

    await manager.disconnectAll().catch(() => {
        // Intentionally swallowed: cleanup error
    })
}

export async function handleRewindCommand(options?: {
    turn?: number
    list?: boolean
}): Promise<void> {
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'
    const BOLD = '\x1b[1m'

    const { getSnapshotManager } = await import('@december/tools')
    const manager = getSnapshotManager(process.cwd())
    await manager.init()

    const snapshots = manager.getSnapshots()

    if (options?.list) {
        if (snapshots.length === 0) {
            console.log(`\n${GRAY}No snapshots recorded in this workspace.${RESET}\n`)
            return
        }

        console.log(`\n${BOLD}Available Turn Snapshots (${snapshots.length}):${RESET}\n`)
        for (const snap of snapshots) {
            const dateStr = new Date(snap.timestamp).toLocaleTimeString()
            const promptPreview = snap.prompt ? `"${snap.prompt.slice(0, 50)}"` : '(no prompt)'
            console.log(
                `  ${BLUE}Turn ${snap.turnIndex}${RESET} [${GRAY}${dateStr}${RESET}] - ${WHITE}${promptPreview}${RESET}`
            )
            console.log(`    Commit: ${GRAY}${snap.commitHash.slice(0, 8)}${RESET}`)
        }
        console.log(
            `\nRun ${WHITE}december rewind --turn <number>${RESET} to restore to a specific turn.\n`
        )
        return
    }

    if (snapshots.length === 0) {
        console.log(`\n${YELLOW}Warning:${RESET} No snapshots available to rewind.\n`)
        return
    }

    const targetTurn =
        options?.turn !== undefined ? options.turn : snapshots[snapshots.length - 1]?.turnIndex
    if (targetTurn === undefined) {
        console.log(`\n${RED}Error:${RESET} Invalid target turn.\n`)
        return
    }

    try {
        const result = await manager.rollbackToTurn(targetTurn)
        console.log(
            `\n${GREEN}✓ Successfully rewound workspace to Turn ${result.targetTurn}.${RESET}`
        )
        if (result.restoredFiles.length > 0) {
            console.log(`  Restored ${result.restoredFiles.length} file(s):`)
            for (const f of result.restoredFiles) {
                console.log(`    • ${BLUE}${f}${RESET}`)
            }
        }
        if (result.deletedFiles.length > 0) {
            console.log(`  Deleted ${result.deletedFiles.length} newly added file(s):`)
            for (const f of result.deletedFiles) {
                console.log(`    • ${RED}${f}${RESET}`)
            }
        }
        console.log('')
    } catch (e: any) {
        console.error(`\n${RED}Failed to rewind:${RESET} ${e.message}\n`)
    }
}
