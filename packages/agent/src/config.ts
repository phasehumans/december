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
    telemetry?: boolean
    autoUpdate?: boolean
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

    if (config.decemberToken) {
        return {
            provider: 'december_proxy',
            apiKey: config.decemberToken,
        }
    }

    if (config.activeProvider && config.providers[config.activeProvider]) {
        return {
            provider: config.activeProvider as any,
            apiKey: config.providers[config.activeProvider],
            model: config.activeModel,
        }
    }

    return undefined
}
