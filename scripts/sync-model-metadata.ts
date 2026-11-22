/**
 * Builds packages/providers/src/model-metadata.json from models.dev (MIT, github.com/sst/models.dev).
 *
 * December reads which models exist from each user's own key (D1). This file only adds the details
 * a provider's model list does not carry: a proper name, the context window, tool support,
 * reasoning support and whether the model is deprecated.
 *
 *   bun scripts/sync-model-metadata.ts            # download models.dev and write the file
 *   bun scripts/sync-model-metadata.ts --from DIR # use a models.dev checkout instead
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { $ } from 'bun'

export const OUTPUT_FILE = path.resolve(
    import.meta.dir,
    '../packages/providers/src/model-metadata.json'
)

/** the bundled file must stay small: the cli binary targets under 2 MB */
const MAX_BYTES = 200 * 1024

/**
 * december provider id -> models.dev provider folders, first match wins.
 * the folders follow the endpoint december calls (china vs international, coding plans).
 */
export const PROVIDER_SOURCES: Record<string, string[]> = {
    abacus: ['abacus'],
    ai21: ['ai21'],
    anthropic: ['anthropic'],
    antigravity: ['cloudcode', 'google'],
    arcee: ['arcee'],
    cerebras: ['cerebras'],
    codex: ['openai-codex', 'openai'],
    cohere: ['cohere'],
    copilot: ['github-copilot'],
    dashscope: ['alibaba-cn', 'alibaba'],
    deepinfra: ['deepinfra'],
    deepseek: ['deepseek'],
    fireworks: ['fireworks-ai'],
    google: ['google'],
    groq: ['groq'],
    huggingface: ['huggingface'],
    inception: ['inception'],
    kimi: ['kimi-code-plan-cn'],
    'kimi-code-plan-cn': ['kimi-code-plan-cn'],
    'kimi-code-plan-global': ['kimi-code-plan-global'],
    meta: ['meta'],
    minimax: ['minimax'],
    mistral: ['mistral'],
    moonshot: ['moonshotai'],
    morph: ['morph'],
    nebius: ['nebius'],
    'novita-ai': ['novita-ai'],
    nvidia: ['nvidia'],
    openai: ['openai'],
    openrouter: ['openrouter'],
    perplexity: ['perplexity'],
    'perplexity-agent': ['perplexity-agent'],
    sakana: ['sakana'],
    sambanova: ['sambanova'],
    sarvam: ['sarvam'],
    siliconflow: ['siliconflow-cn'],
    'siliconflow-intl': ['siliconflow'],
    stepfun: ['stepfun'],
    'tencent-tokenhub': ['tencent-tokenhub'],
    thinkingmachines: ['thinkingmachines'],
    together: ['togetherai'],
    upstage: ['upstage'],
    volcengine: ['volcengine'],
    'wafer.ai': ['wafer.ai'],
    watsonx: ['watsonx'],
    xai: ['xai'],
    xiaomi: ['xiaomi'],
    zai: ['zai-coding-plan', 'zai'],
}

/** flag bits in each entry */
export const FLAG = { toolsYes: 1, toolsNo: 2, reasoning: 4, deprecated: 8 } as const

/** [name, context window (0 = unknown), flags] */
export type MetadataEntry = [string, number, number]

export interface ModelMetadataFile {
    source: string
    generated: string
    providers: Record<string, Record<string, MetadataEntry>>
}

const CHAT_APIS = ['chat-completions', 'messages', 'responses']

function tomlFiles(dir: string): string[] {
    const out: string[] = []
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) out.push(...tomlFiles(full))
        else if (name.endsWith('.toml')) out.push(full)
    }
    return out
}

function readToml(file: string): any {
    try {
        return Bun.TOML.parse(readFileSync(file, 'utf8'))
    } catch {
        // Intentionally swallowed: one malformed upstream file must not stop the sync
        return undefined
    }
}

const supported = (cap: unknown): boolean | undefined => {
    if (typeof cap === 'boolean') return cap
    if (cap && typeof cap === 'object' && typeof (cap as any).supported === 'boolean') {
        return (cap as any).supported
    }
    return undefined
}

/** a provider model file overrides its base model (models/<lab>/<id>.toml) field by field */
function merged(model: any, base: any) {
    const pick = <T>(...values: T[]) => values.find((v) => v !== undefined && v !== null)
    return {
        name: pick(model?.name, base?.name) as string | undefined,
        context: pick(model?.limit?.context, base?.limit?.context) as number | undefined,
        tools: pick(supported(model?.capabilities?.tools), supported(base?.capabilities?.tools)),
        reasoning: pick(
            supported(model?.capabilities?.reasoning),
            supported(base?.capabilities?.reasoning)
        ),
        output: pick(model?.modalities?.output, base?.modalities?.output) as string[] | undefined,
        apis: model?.api ? Object.keys(model.api) : undefined,
        deprecated: model?.status === 'deprecated' || base?.status === 'deprecated',
    }
}

/** reads a models.dev checkout and keeps chat models of the providers december supports */
export function buildModelMetadata(root: string, generated: string): ModelMetadataFile {
    const baseCache = new Map<string, any>()
    const base = (ref: unknown) => {
        if (typeof ref !== 'string' || !ref.includes('/')) return undefined
        if (!baseCache.has(ref))
            baseCache.set(ref, readToml(path.join(root, 'models', `${ref}.toml`)))
        return baseCache.get(ref)
    }

    const providers: ModelMetadataFile['providers'] = {}
    for (const [provider, folders] of Object.entries(PROVIDER_SOURCES)) {
        const entries: Record<string, MetadataEntry> = {}
        // every candidate folder adds the models it knows; the first folder wins per model
        for (const folder of folders) {
            const modelsDir = path.join(root, 'providers', folder, 'models')
            try {
                if (!statSync(modelsDir).isDirectory()) continue
            } catch {
                // Intentionally swallowed: a missing folder means the next candidate is tried
                continue
            }
            for (const file of tomlFiles(modelsDir)) {
                const id = path.relative(modelsDir, file).slice(0, -'.toml'.length).toLowerCase()
                if (entries[id]) continue
                const model = readToml(file)
                if (!model) continue
                const m = merged(model, base(model.base_model))
                // chat models only: text out, and a chat api when the file lists apis at all
                if (m.output && !m.output.includes('text')) continue
                if (m.apis && m.apis.length > 0 && !m.apis.some((a) => CHAT_APIS.includes(a)))
                    continue
                let flags = 0
                if (m.tools === true) flags |= FLAG.toolsYes
                if (m.tools === false) flags |= FLAG.toolsNo
                if (m.reasoning === true) flags |= FLAG.reasoning
                if (m.deprecated) flags |= FLAG.deprecated
                entries[id] = [m.name || '', Number(m.context) || 0, flags]
            }
        }
        if (Object.keys(entries).length > 0) providers[provider] = entries
    }
    return { source: 'models.dev (MIT, github.com/sst/models.dev)', generated, providers }
}

async function main() {
    const args = process.argv.slice(2)
    const fromIdx = args.indexOf('--from')
    let root = fromIdx >= 0 ? path.resolve(args[fromIdx + 1]) : ''
    let tmp = ''
    if (!root) {
        tmp = mkdtempSync(path.join(os.tmpdir(), 'models-dev-'))
        const branch = 'dev'
        console.log(`downloading models.dev (${branch})...`)
        await $`curl -sL --fail -m 120 https://codeload.github.com/sst/models.dev/tar.gz/refs/heads/${branch} | tar -xz -C ${tmp} --strip-components=1`
        root = tmp
    }
    try {
        const data = buildModelMetadata(root, new Date().toISOString().slice(0, 10))
        const text = JSON.stringify(data) + '\n'
        if (text.length > MAX_BYTES) {
            throw new Error(
                `model metadata is ${text.length} bytes, over the ${MAX_BYTES} byte budget`
            )
        }
        writeFileSync(OUTPUT_FILE, text)
        const counts = Object.entries(data.providers).map(
            ([p, e]) => `${p} ${Object.keys(e).length}`
        )
        console.log(`wrote ${path.relative(process.cwd(), OUTPUT_FILE)} (${text.length} bytes)`)
        console.log(counts.join(', '))
    } finally {
        if (tmp) rmSync(tmp, { recursive: true, force: true })
    }
}

if (import.meta.main) await main()
