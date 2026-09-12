import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
    ensureValidModelForProvider,
    getDefaultModelForProvider,
    isValidModelForProvider,
} from './utils/models'

import type { SubscriptionTokenBundle } from './auth/subscriptions/types'

export type { SubscriptionTokenBundle } from './auth/subscriptions/types'

export interface ProviderConfig {
    provider:
        | 'openai'
        | 'anthropic'
        | 'gemini'
        | 'google'
        | 'claude'
        | 'codex'
        | 'copilot'
        | 'openrouter'
        | 'deepseek'
        | 'groq'
        | 'huggingface'
        | 'kimi'
        | 'moonshot'
        | 'moonshoot'
        | 'moonshotai'
        | 'moonshot-ai'
        | 'mistral'
        | 'mistralai'
        | 'mistral-ai'
        | 'xai'
        | 'zai'
        | 'zhipu'
        | 'zhipuai'
        | 'xiaomi'
        | 'mimo'
        | 'nvidia'
        | 'sambanova'
        | 'cerebras'
        | 'siliconflow'
        | 'together'
        | 'hyperbolic'
        | 'fireworks'
        | 'perplexity'
        | 'cohere'
        | 'ollama'
        | 'agentrouter'
        | 'arcee'
        | 'meta'
        | 'minimax'
        | 'poolside'
        | 'sakana'
        | 'sakanaai'
        | 'sakana-ai'
        | 'sarvam'
        | 'sarvamai'
        | 'sarvam-ai'
        | 'stepfun'
        | 'stepfunai'
        | 'stepfun-ai'
        | 'upstage'
        | 'upstageai'
        | 'solar'
        | 'thinkingmachines'
        | 'tinker'
        | 'inkling'
        | 'december_proxy'
        | string
    apiKey: string
    model?: string
    authMethod?: 'byok' | 'december' | 'env' | 'subscription'
    subscription?: SubscriptionTokenBundle
    headers?: Record<string, string>
    baseURL?: string
}

export interface DecemberConfig {
    activeProvider?: string
    activeModel?: string
    lastUsedModels?: Record<string, string>
    providers: Record<string, string>
    subscriptions?: Record<string, SubscriptionTokenBundle>
    decemberToken?: string
    email?: string
    nonWorkspaceAccess?: boolean
    showActiveTasks?: boolean
    toolPermission?: 'always-proceed' | 'always-ask'
    compactMode?: boolean
    soundEffects?: boolean
    autoScroll?: boolean
    streamSpeed?: 'smooth' | 'instant'
    approvedTools?: string[]
    thinkingLevel?: 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high'
    steeringMode?: 'all' | 'one-at-a-time'
    followUpMode?: 'all' | 'one-at-a-time'
    pathGuard?: boolean
    scope?: string
    authPriority?: 'subscription' | 'byok' | 'december'
    installMethod?: 'npm' | 'bun' | 'pnpm' | 'npx' | 'curl' | 'source'
    versionCheckCache?: {
        latestVersion: string
        checkedAt: number
    }
}

export function getLegacyConfigDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
    if (isTestEnv && home === os.homedir()) {
        return path.join(os.tmpdir(), 'december-test-config', '.config', 'december')
    }
    return path.join(home, '.config', 'december')
}

export function getLegacyConfigFile(): string {
    return path.join(getLegacyConfigDir(), 'config.json')
}

export function getConfigDir(): string {
    if (process.env.DECEMBER_CONFIG_DIR) {
        return process.env.DECEMBER_CONFIG_DIR
    }
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
    if (isTestEnv && home === os.homedir()) {
        return path.join(os.tmpdir(), 'december-test-config', '.december')
    }
    const canonicalDir = path.join(home, '.december')
    const legacyDir = path.join(home, '.config', 'december')

    // If canonical directory exists or legacy directory does not exist, use ~/.december
    if (fsSync.existsSync(canonicalDir) || !fsSync.existsSync(legacyDir)) {
        return canonicalDir
    }

    return legacyDir
}

export function getConfigFile(): string {
    return path.join(getConfigDir(), 'config.json')
}

export function getLogsDir(): string {
    return process.env.DECEMBER_LOGS_DIR || path.join(getConfigDir(), 'logs')
}

function deepMergeSettings(base: any, overrides: any): any {
    const result = { ...base }
    for (const key of Object.keys(overrides)) {
        const overrideValue = overrides[key]
        const baseValue = base[key]
        if (overrideValue === undefined) continue

        if (
            typeof overrideValue === 'object' &&
            overrideValue !== null &&
            !Array.isArray(overrideValue) &&
            typeof baseValue === 'object' &&
            baseValue !== null &&
            !Array.isArray(baseValue)
        ) {
            result[key] = { ...baseValue, ...overrideValue }
        } else {
            result[key] = overrideValue
        }
    }
    return result
}

export async function loadConfig(): Promise<DecemberConfig> {
    try {
        const configFile = getConfigFile()
        let data: string
        try {
            data = await fs.readFile(configFile, 'utf-8')
        } catch (readErr) {
            const legacyConfigFile = getLegacyConfigFile()
            if (legacyConfigFile !== configFile && fsSync.existsSync(legacyConfigFile)) {
                data = await fs.readFile(legacyConfigFile, 'utf-8')
                try {
                    await fs.mkdir(path.dirname(configFile), { recursive: true })
                    await fs.writeFile(configFile, data, 'utf-8')
                    await fs.chmod(configFile, 0o600).catch(() => {
                        // Intentionally swallowed: chmod failure on non-POSIX systems
                    })
                } catch {
                    // Intentionally swallowed: auto-migration to canonical path is best-effort
                }
            } else {
                throw readErr
            }
        }
        let config = JSON.parse(data)

        try {
            const workspacePath = path.join(process.cwd(), '.december', 'settings.json')
            const wData = await fs.readFile(workspacePath, 'utf-8')
            const workspaceConfig = JSON.parse(wData)
            config = deepMergeSettings(config, workspaceConfig)
        } catch {
            // workspace config is optional
        }

        // self-heal: if providers exist but activeProvider is missing, select the first available
        if (
            !config.activeProvider &&
            config.providers &&
            Object.keys(config.providers).length > 0
        ) {
            config.activeProvider = Object.keys(config.providers)[0]
        }

        return config
    } catch {
        return { providers: {} }
    }
}

export async function saveConfig(config: DecemberConfig): Promise<void> {
    const configDir = getConfigDir()
    const configFile = getConfigFile()
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8')
    await fs.chmod(configFile, 0o600).catch(() => {})

    try {
        const workspacePath = path.join(process.cwd(), '.december', 'settings.json')
        await fs.access(workspacePath)
        let currentWorkspaceSettings: any = {}
        try {
            const raw = await fs.readFile(workspacePath, 'utf-8')
            currentWorkspaceSettings = JSON.parse(raw)
        } catch {
            // Intentionally swallowed: fallback to empty workspace settings if unreadable
        }
        if (config.thinkingLevel !== undefined)
            currentWorkspaceSettings.thinkingLevel = config.thinkingLevel
        if (config.steeringMode !== undefined)
            currentWorkspaceSettings.steeringMode = config.steeringMode
        if (config.followUpMode !== undefined)
            currentWorkspaceSettings.followUpMode = config.followUpMode
        if (config.toolPermission !== undefined)
            currentWorkspaceSettings.toolPermission = config.toolPermission
        if (config.pathGuard !== undefined) currentWorkspaceSettings.pathGuard = config.pathGuard
        if (config.nonWorkspaceAccess !== undefined)
            currentWorkspaceSettings.nonWorkspaceAccess = config.nonWorkspaceAccess

        await fs.writeFile(
            workspacePath,
            JSON.stringify(currentWorkspaceSettings, null, 2) + '\n',
            'utf-8'
        )
    } catch {
        // Intentionally swallowed: workspace settings file does not exist or is not writable
    }
}

export async function updateConfig(partial: Partial<DecemberConfig>): Promise<DecemberConfig> {
    const current = await loadConfig()
    const updated = { ...current, ...partial }
    await saveConfig(updated)
    return updated
}

function resolveSubscriptionBundle(
    config: DecemberConfig
): { provider: string; bundle: SubscriptionTokenBundle } | undefined {
    if (!config.subscriptions || Object.keys(config.subscriptions).length === 0) {
        return undefined
    }

    const activeProvider = config.activeProvider
    if (activeProvider && config.subscriptions[activeProvider]) {
        return { provider: activeProvider, bundle: config.subscriptions[activeProvider] }
    }

    // Only map aliases if priority is explicitly subscription OR if activeProvider has no BYOK key
    const hasByokForActive = !!(
        activeProvider &&
        config.providers &&
        config.providers[activeProvider]
    )

    if (config.authPriority === 'subscription' || !hasByokForActive) {
        // Check alias maps (e.g. anthropic -> claude, openai -> codex, google -> gemini)
        if (activeProvider === 'anthropic' && config.subscriptions['claude']) {
            return { provider: 'claude', bundle: config.subscriptions['claude'] }
        }
        if (activeProvider === 'openai' && config.subscriptions['codex']) {
            return { provider: 'codex', bundle: config.subscriptions['codex'] }
        }
        if (activeProvider === 'google' && config.subscriptions['gemini']) {
            return { provider: 'gemini', bundle: config.subscriptions['gemini'] }
        }
    }

    if (config.authPriority === 'subscription') {
        const firstKey = Object.keys(config.subscriptions)[0]
        return { provider: firstKey, bundle: config.subscriptions[firstKey] }
    }

    return undefined
}

export async function getProviderConfig(): Promise<ProviderConfig | undefined> {
    const config = await loadConfig()

    const hasByokConfig = !!(
        config.activeProvider &&
        config.providers &&
        config.providers[config.activeProvider]
    )
    const hasDecember = !!config.decemberToken
    const subMatch = resolveSubscriptionBundle(config)

    // 1. If explicit authPriority is december
    if (config.authPriority === 'december' && hasDecember) {
        return {
            provider: 'december_proxy',
            apiKey: config.decemberToken!,
            model: 'december-auto',
            authMethod: 'december',
        }
    }

    // 2. If explicit authPriority is byok, OR if activeProvider is configured in BYOK and priority is not subscription
    if (
        (config.authPriority === 'byok' ||
            (hasByokConfig && config.authPriority !== 'subscription')) &&
        hasByokConfig
    ) {
        const model = ensureValidModelForProvider(config.activeProvider!, config.activeModel)
        return {
            provider: config.activeProvider as any,
            apiKey: config.providers[config.activeProvider!],
            model,
            authMethod: 'byok',
        }
    }

    // 3. Subscription (explicit subscription priority, or active subscription without conflicting BYOK activeProvider)
    if (subMatch && config.authPriority !== 'byok' && config.authPriority !== 'december') {
        const { resolveSubscriptionToken } =
            await import('./auth/subscriptions/subscription-manager')
        const resolvedBundle = await resolveSubscriptionToken(subMatch.provider, subMatch.bundle)
        const targetProvider = resolvedBundle.provider || subMatch.provider
        const model = ensureValidModelForProvider(targetProvider, config.activeModel)

        return {
            provider: targetProvider,
            apiKey: resolvedBundle.accessToken,
            model,
            authMethod: 'subscription',
            subscription: resolvedBundle,
            baseURL: resolvedBundle.endpoint,
        }
    }

    // 4. BYOK in config takes precedence over December proxy fallback
    if (hasByokConfig) {
        const model = ensureValidModelForProvider(config.activeProvider!, config.activeModel)
        return {
            provider: config.activeProvider as any,
            apiKey: config.providers[config.activeProvider!],
            model,
            authMethod: 'byok',
        }
    }

    // 5. December Proxy fallback
    if (hasDecember) {
        return {
            provider: 'december_proxy',
            apiKey: config.decemberToken!,
            model: 'december-auto',
            authMethod: 'december',
        }
    }

    // 6. Check if local subscription can be auto-detected from environment variables
    if (
        process.env.CLAUDE_CODE_OAUTH_TOKEN ||
        process.env.ANTHROPIC_AUTH_TOKEN ||
        process.env.COPILOT_TOKEN ||
        process.env.GITHUB_COPILOT_TOKEN ||
        process.env.OPENAI_OAUTH_TOKEN ||
        process.env.CODEX_TOKEN ||
        process.env.GEMINI_OAUTH_TOKEN ||
        process.env.ANTIGRAVITY_TOKEN
    ) {
        const { detectAllSubscriptions, resolveSubscriptionToken } =
            await import('./auth/subscriptions/subscription-manager')
        const detected = await detectAllSubscriptions()
        const firstKey = Object.keys(detected)[0]
        if (firstKey && detected[firstKey]) {
            const resolvedBundle = await resolveSubscriptionToken(firstKey, detected[firstKey])
            const targetProvider = resolvedBundle.provider || firstKey
            const model = ensureValidModelForProvider(targetProvider, config.activeModel)
            return {
                provider: targetProvider,
                apiKey: resolvedBundle.accessToken,
                model,
                authMethod: 'subscription',
                subscription: resolvedBundle,
                baseURL: resolvedBundle.endpoint,
            }
        }
    }

    return undefined
}

export async function getAuthStatus() {
    const config = await loadConfig()
    const hasByokConfig = !!(
        config.activeProvider &&
        config.providers &&
        config.providers[config.activeProvider]
    )
    const subscriptions = config.subscriptions ? Object.keys(config.subscriptions) : []
    const hasSubscription = subscriptions.length > 0

    return {
        hasByok: hasByokConfig,
        hasDecember: !!config.decemberToken,
        hasSubscription,
        subscriptions,
        authPriority: config.authPriority || (hasSubscription ? 'subscription' : 'byok'),
    }
}

export interface ConfiguredProviderItem {
    label: string
    value: string
    provider: string
    type: 'subscription' | 'december' | 'byok'
    model: string
    isActive: boolean
    account?: string
}

export function formatProviderName(provider: string): string {
    const norm = (provider || '').toLowerCase().trim()
    switch (norm) {
        case 'openai':
            return 'OpenAI'
        case 'anthropic':
            return 'Anthropic'
        case 'gemini':
        case 'google':
            return 'Google Gemini'
        case 'deepseek':
            return 'DeepSeek'
        case 'openrouter':
            return 'OpenRouter'
        case 'groq':
            return 'Groq'
        case 'ollama':
            return 'Ollama'
        case 'sambanova':
            return 'SambaNova'
        case 'cerebras':
            return 'Cerebras'
        case 'siliconflow':
            return 'SiliconFlow'
        case 'together':
            return 'Together AI'
        case 'hyperbolic':
            return 'Hyperbolic'
        case 'fireworks':
            return 'Fireworks AI'
        case 'perplexity':
            return 'Perplexity'
        case 'cohere':
            return 'Cohere'
        case 'mistral':
            return 'Mistral'
        case 'minimax':
            return 'MiniMax'
        case 'arcee':
            return 'Arcee AI'
        case 'meta':
            return 'Meta AI'
        case 'poolside':
            return 'Poolside'
        case 'sakana':
        case 'sakanaai':
        case 'sakana-ai':
            return 'Sakana AI'
        case 'sarvam':
        case 'sarvamai':
        case 'sarvam-ai':
            return 'Sarvam AI'
        case 'stepfun':
        case 'stepfunai':
        case 'stepfun-ai':
            return 'StepFun (Global)'
        case 'upstage':
        case 'upstageai':
        case 'solar':
            return 'Upstage Solar'
        case 'thinkingmachines':
        case 'tinker':
        case 'inkling':
            return 'Thinking Machines (Tinker)'
        case 'xai':
            return 'xAI'
        case 'zai':
        case 'zhipu':
        case 'zhipuai':
            return 'Zhipu AI'
        case 'xiaomi':
        case 'mimo':
            return 'Xiaomi'
        case 'claude':
            return 'Claude'
        case 'copilot':
            return 'GitHub Copilot'
        case 'codex':
        case 'chatgpt':
            return 'ChatGPT'
        case 'december':
        case 'december_proxy':
            return 'December'
        default:
            return provider.charAt(0).toUpperCase() + provider.slice(1)
    }
}

export function getTargetModelForProvider(config: DecemberConfig, provider: string): string {
    const normalized = (provider || '').toLowerCase().trim()
    if (normalized === 'december' || normalized === 'december_proxy') {
        return 'december-auto'
    }
    const remembered = config.lastUsedModels?.[provider]
    if (remembered && isValidModelForProvider(provider, remembered)) {
        return remembered
    }
    if (
        config.activeProvider === provider &&
        config.activeModel &&
        isValidModelForProvider(provider, config.activeModel)
    ) {
        return config.activeModel
    }
    return getDefaultModelForProvider(provider)
}

export function getConfiguredProviders(config: DecemberConfig): ConfiguredProviderItem[] {
    const items: ConfiguredProviderItem[] = []

    const isSubscriptionActive = (subKey: string) => {
        if (config.authPriority === 'subscription') {
            if (config.activeProvider === subKey) return true
            if (!config.activeProvider && Object.keys(config.subscriptions || {})[0] === subKey)
                return true
            if (config.activeProvider === 'anthropic' && subKey === 'claude') return true
            if (config.activeProvider === 'openai' && subKey === 'codex') return true
            if (config.activeProvider === 'google' && subKey === 'gemini') return true
        }
        if (!config.authPriority && config.activeProvider === subKey) return true
        return false
    }

    const isDecemberActive = () => {
        if (config.authPriority === 'december' && config.decemberToken) return true
        if (
            !config.authPriority &&
            !config.activeProvider &&
            !config.subscriptions &&
            config.decemberToken
        )
            return true
        if (config.activeProvider === 'december_proxy' || config.activeProvider === 'december')
            return true
        return false
    }

    const isByokActive = (byokKey: string) => {
        if (config.authPriority === 'byok' && config.activeProvider === byokKey) return true
        if (
            !config.authPriority &&
            config.activeProvider === byokKey &&
            !config.subscriptions?.[byokKey]
        )
            return true
        return false
    }

    // 1. Subscriptions
    if (config.subscriptions) {
        for (const [subKey, bundle] of Object.entries(config.subscriptions)) {
            const displayName = formatProviderName(subKey)
            const model = getTargetModelForProvider(config, subKey)
            const active = isSubscriptionActive(subKey)

            items.push({
                label: `${displayName} (Subscription)`,
                value: `subscription:${subKey}`,
                provider: subKey,
                type: 'subscription',
                model,
                isActive: active,
                account: bundle.email || bundle.accountName,
            })
        }
    }

    // 2. December Cloud Wallet
    if (config.decemberToken) {
        const model = getTargetModelForProvider(config, 'december_proxy')
        const active = isDecemberActive()

        items.push({
            label: 'December (Cloud Wallet)',
            value: 'decemberToken',
            provider: 'december_proxy',
            type: 'december',
            model,
            isActive: active,
            account: config.email,
        })
    }

    // 3. BYOK Providers
    if (config.providers) {
        for (const [byokKey] of Object.entries(config.providers)) {
            const displayName = formatProviderName(byokKey)
            const model = getTargetModelForProvider(config, byokKey)
            const active = isByokActive(byokKey)

            items.push({
                label: displayName,
                value: `provider:${byokKey}`,
                provider: byokKey,
                type: 'byok',
                model,
                isActive: active,
            })
        }
    }

    return items
}

export function resolveSwitchTarget(
    config: DecemberConfig,
    targetInput?: string
):
    | { provider: string; authPriority: 'subscription' | 'byok' | 'december'; model: string }
    | undefined {
    if (!targetInput) return undefined
    const q = targetInput.trim().toLowerCase()
    if (!q) return undefined

    // Exact value matches
    if (q === 'decembertoken') {
        if (config.decemberToken) {
            return {
                provider: 'december_proxy',
                authPriority: 'december',
                model: getTargetModelForProvider(config, 'december_proxy'),
            }
        }
        return undefined
    }

    if (q.startsWith('subscription:')) {
        const sub = q.slice('subscription:'.length)
        if (config.subscriptions && config.subscriptions[sub]) {
            return {
                provider: sub,
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, sub),
            }
        }
        return undefined
    }

    if (q.startsWith('provider:') || q.startsWith('byok:')) {
        const p = q.replace(/^(provider|byok):/, '')
        if (config.providers && config.providers[p]) {
            return {
                provider: p,
                authPriority: 'byok',
                model: getTargetModelForProvider(config, p),
            }
        }
        return undefined
    }

    // Option A Disambiguation: Check subscriptions first
    if (config.subscriptions) {
        if (['claude', 'anthropic'].includes(q) && config.subscriptions['claude']) {
            return {
                provider: 'claude',
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, 'claude'),
            }
        }
        if (
            ['copilot', 'github', 'github_copilot'].includes(q) &&
            config.subscriptions['copilot']
        ) {
            return {
                provider: 'copilot',
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, 'copilot'),
            }
        }
        if (['codex', 'chatgpt', 'openai'].includes(q) && config.subscriptions['codex']) {
            return {
                provider: 'codex',
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, 'codex'),
            }
        }
        if (['gemini', 'google', 'antigravity'].includes(q) && config.subscriptions['gemini']) {
            return {
                provider: 'gemini',
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, 'gemini'),
            }
        }
        if (config.subscriptions[q]) {
            return {
                provider: q,
                authPriority: 'subscription',
                model: getTargetModelForProvider(config, q),
            }
        }
    }

    // Next check BYOK
    if (config.providers) {
        if (config.providers[q]) {
            return {
                provider: q,
                authPriority: 'byok',
                model: getTargetModelForProvider(config, q),
            }
        }
        if (q === 'google' && config.providers['gemini']) {
            return {
                provider: 'gemini',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'gemini'),
            }
        }
        if (q === 'gemini' && config.providers['google']) {
            return {
                provider: 'google',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'google'),
            }
        }
        if (q === 'claude' && config.providers['anthropic']) {
            return {
                provider: 'anthropic',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'anthropic'),
            }
        }
        if (q === 'chatgpt' && config.providers['openai']) {
            return {
                provider: 'openai',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'openai'),
            }
        }
        if (['solar', 'upstageai'].includes(q) && config.providers['upstage']) {
            return {
                provider: 'upstage',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'upstage'),
            }
        }
        if (['tinker', 'inkling'].includes(q) && config.providers['thinkingmachines']) {
            return {
                provider: 'thinkingmachines',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'thinkingmachines'),
            }
        }
        if (['stepfunai', 'stepfun-ai'].includes(q) && config.providers['stepfun']) {
            return {
                provider: 'stepfun',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'stepfun'),
            }
        }
        if (['sarvamai', 'sarvam-ai'].includes(q) && config.providers['sarvam']) {
            return {
                provider: 'sarvam',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'sarvam'),
            }
        }
        if (['mimo'].includes(q) && config.providers['xiaomi']) {
            return {
                provider: 'xiaomi',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'xiaomi'),
            }
        }
        if (['zhipu', 'zhipuai'].includes(q) && config.providers['zai']) {
            return {
                provider: 'zai',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'zai'),
            }
        }
        if (['zai', 'zhipu'].includes(q) && config.providers['zhipuai']) {
            return {
                provider: 'zhipuai',
                authPriority: 'byok',
                model: getTargetModelForProvider(config, 'zhipuai'),
            }
        }
    }

    // Next check December Cloud Wallet
    if (['december', 'wallet', 'cloud', 'december_proxy'].includes(q)) {
        if (config.decemberToken) {
            return {
                provider: 'december_proxy',
                authPriority: 'december',
                model: getTargetModelForProvider(config, 'december_proxy'),
            }
        }
    }

    return undefined
}

export function applyProviderSwitch(
    config: DecemberConfig,
    target: { provider: string; authPriority: 'subscription' | 'byok' | 'december'; model?: string }
): { config: DecemberConfig; model: string } {
    config.authPriority = target.authPriority
    config.activeProvider = target.provider

    let finalModel = target.model
    if (!finalModel || !isValidModelForProvider(target.provider, finalModel)) {
        finalModel = getTargetModelForProvider(config, target.provider)
    }

    config.activeModel = finalModel
    config.lastUsedModels = config.lastUsedModels || {}
    config.lastUsedModels[target.provider] = finalModel

    return { config, model: finalModel }
}
