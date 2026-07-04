import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
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
}

const CONFIG_DIR = path.join(os.homedir(), '.december')
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
        // Logged in via December: use OpenRouter under the hood via December proxy
        return {
            provider: 'openrouter',
            apiKey: config.decemberToken, // The proxy will exchange this
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
