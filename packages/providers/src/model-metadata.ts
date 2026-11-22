import metadata from './model-metadata.json'
import { MODEL_CATALOG } from './models.ts'

/**
 * Model details from models.dev (bundled, regenerated weekly by scripts/sync-model-metadata.ts).
 * Which models exist comes from the user's own key (D1); this only fills in what a provider's
 * model list does not say: a proper name, the context window, tools, reasoning, deprecation.
 */
export interface ModelDetails {
    name?: string
    contextWindow?: number
    /** undefined when models.dev does not say */
    tools?: boolean
    reasoning?: boolean
    deprecated?: boolean
}

/** flag bits, see FLAG in scripts/sync-model-metadata.ts */
const TOOLS_YES = 1
const TOOLS_NO = 2
const REASONING = 4
const DEPRECATED = 8

type Entry = [string, number, number]
const PROVIDERS = (metadata as unknown as { providers: Record<string, Record<string, Entry>> })
    .providers

/** december provider ids whose metadata is filed under another id */
const METADATA_ALIASES: Record<string, string> = {
    gemini: 'antigravity',
    claude: 'anthropic',
    chatgpt: 'codex',
    github: 'copilot',
    github_copilot: 'copilot',
    siliconcloud: 'siliconflow',
    'siliconflow-cn': 'siliconflow',
    'kimi-code': 'kimi',
    'kimi-code-plan': 'kimi',
}

function providerEntries(provider: string): Record<string, Entry> | undefined {
    const normalized = (provider || '').toLowerCase().trim()
    return (
        PROVIDERS[normalized] ||
        PROVIDERS[METADATA_ALIASES[normalized] || ''] ||
        PROVIDERS[MODEL_CATALOG.aliases[normalized] || '']
    )
}

export function getModelDetails(provider: string, model: string): ModelDetails | undefined {
    const entries = providerEntries(provider)
    if (!entries || !model) return undefined
    const id = model.toLowerCase().trim()
    const entry = entries[id] || entries[id.replace(/^models\//, '')]
    if (!entry) return undefined
    const [name, context, flags] = entry
    return {
        name: name || undefined,
        contextWindow: context > 0 ? context : undefined,
        tools: flags & TOOLS_YES ? true : flags & TOOLS_NO ? false : undefined,
        reasoning: Boolean(flags & REASONING),
        deprecated: Boolean(flags & DEPRECATED),
    }
}
