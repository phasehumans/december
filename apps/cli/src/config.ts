import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
export interface ProviderConfig {
    provider:
        | 'openai'
        | 'anthropic'
        | 'gemini'
        | 'openrouter'
        | 'deepseek'
        | 'groq'
        | 'huggingface'
        | 'kimi'
        | 'moonshoot'
        | 'mistral'
        | 'xai'
        | 'zai'
        | string
    apiKey: string
    model?: string
    authMethod?: 'byok' | 'december' | 'env'
}

export interface DecemberConfig {
    activeProvider?: string
    activeModel?: string
    providers: Record<string, string>
    decemberToken?: string
    email?: string
    nonWorkspaceAccess?: boolean
    notifications?: boolean
    showActiveTasks?: boolean
    showTips?: boolean
    toolPermission?: 'always-proceed' | 'always-ask'
    compactMode?: boolean
    soundEffects?: boolean
    autoScroll?: boolean
    streamSpeed?: 'smooth' | 'instant'
    approvedTools?: string[]
    autoUpdate?: boolean
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high'
    steeringMode?: 'all' | 'one-at-a-time'
    followUpMode?: 'all' | 'one-at-a-time'
    authPriority?: 'byok' | 'december'
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'december')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export async function loadConfig(): Promise<DecemberConfig> {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8')
        return JSON.parse(data)
    } catch {
        return { providers: {} }
    }
}

export async function saveConfig(config: DecemberConfig): Promise<void> {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export async function getProviderConfig(): Promise<ProviderConfig | undefined> {
    const config = await loadConfig()

    const hasByokConfig = config.activeProvider && config.providers[config.activeProvider]
    const hasEnvVars =
        process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    const hasDecember = !!config.decemberToken

    // If preferred is december and it exists, use it first
    if (config.authPriority === 'december' && hasDecember) {
        return { provider: 'december_proxy', apiKey: config.decemberToken!, authMethod: 'december' }
    }

    // 1.8 Wallet vs BYOK priority: BYOK via config file takes precedence.
    if (hasByokConfig) {
        return {
            provider: config.activeProvider as any,
            apiKey: config.providers[config.activeProvider!],
            model: config.activeModel,
            authMethod: 'byok',
        }
    }

    // Check for common env vars for BYOK priority
    if (process.env.GEMINI_API_KEY) {
        return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY, authMethod: 'env' }
    }
    if (process.env.OPENAI_API_KEY) {
        return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, authMethod: 'env' }
    }
    if (process.env.ANTHROPIC_API_KEY) {
        return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, authMethod: 'env' }
    }

    // Wallet fallback
    if (hasDecember) {
        return {
            provider: 'december_proxy',
            apiKey: config.decemberToken!,
            authMethod: 'december',
        }
    }

    return undefined
}

export async function getAuthStatus() {
    const config = await loadConfig()
    return {
        hasByok: !!(config.activeProvider && config.providers[config.activeProvider]),
        hasDecember: !!config.decemberToken,
        authPriority: config.authPriority || 'byok',
    }
}
