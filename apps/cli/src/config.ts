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

    // 1.8 Wallet vs BYOK priority: BYOK via config file takes precedence.
    if (config.activeProvider && config.providers[config.activeProvider]) {
        return {
            provider: config.activeProvider as any,
            apiKey: config.providers[config.activeProvider],
            model: config.activeModel,
        }
    }

    // Check for common env vars for BYOK priority
    if (process.env.GEMINI_API_KEY) {
        return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY }
    }
    if (process.env.OPENAI_API_KEY) {
        return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
    }
    if (process.env.ANTHROPIC_API_KEY) {
        return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
    }

    // Wallet fallback
    if (config.decemberToken) {
        return {
            provider: 'december_proxy',
            apiKey: config.decemberToken,
        }
    }

    return undefined
}
