import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'bun:test'

import { buildModelMetadata, FLAG } from '../../../../scripts/sync-model-metadata'
import { getModelDetails } from '../../src/model-metadata'

const root = mkdtempSync(path.join(os.tmpdir(), 'models-dev-fixture-'))
const write = (rel: string, body: string) => {
    const file = path.join(root, rel)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, body)
}

// a lab base model and three groq entries: one inherits, one is deprecated, one is not chat
write(
    'models/meta/llama-9.toml',
    `name = "Llama 9"\n[limit]\ncontext = 131072\n[modalities]\noutput = ["text"]\n[capabilities]\ntools = { supported = true }\n`
)
write(
    'providers/groq/models/meta-llama/llama-9.toml',
    `base_model = "meta/llama-9"\n[api.chat-completions]\n`
)
write(
    'providers/groq/models/old-model.toml',
    `name = "Old Model"\nstatus = "deprecated"\n[capabilities]\ntools = { supported = false }\n[api.chat-completions]\n`
)
write('providers/groq/models/embed-1.toml', `name = "Embed"\n[api.embeddings]\n`)
// zai reads its coding plan folder first, then the general folder
write(
    'providers/zai-coding-plan/models/glm-9.toml',
    `name = "GLM 9 (coding plan)"\n[api.chat-completions]\n`
)
write('providers/zai/models/glm-9.toml', `name = "GLM 9"\n[api.chat-completions]\n`)
write('providers/zai/models/glm-8.toml', `name = "GLM 8"\n[api.chat-completions]\n`)

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('buildModelMetadata', () => {
    const data = buildModelMetadata(root, '2026-11-22')

    it('merges a provider entry with its base model', () => {
        const [name, context, flags] = data.providers.groq['meta-llama/llama-9']
        expect(name).toBe('Llama 9')
        expect(context).toBe(131072)
        expect(flags & FLAG.toolsYes).toBeTruthy()
    })

    it('keeps deprecated models flagged and drops models that cannot chat', () => {
        const [, , flags] = data.providers.groq['old-model']
        expect(flags & FLAG.deprecated).toBeTruthy()
        expect(flags & FLAG.toolsNo).toBeTruthy()
        expect(data.providers.groq['embed-1']).toBeUndefined()
    })

    it('reads every candidate folder, the first one winning per model', () => {
        expect(data.providers.zai['glm-9'][0]).toBe('GLM 9 (coding plan)')
        expect(data.providers.zai['glm-8'][0]).toBe('GLM 8')
    })
})

describe('getModelDetails (bundled models.dev data)', () => {
    it('returns details, case-insensitively, under december provider ids and aliases', () => {
        const details = getModelDetails('anthropic', 'claude-opus-5')
        expect(details?.name).toBeTruthy()
        expect(details?.contextWindow).toBeGreaterThan(100000)
        expect(getModelDetails('claude', 'claude-opus-5')).toEqual(details)
        expect(getModelDetails('anthropic', 'CLAUDE-OPUS-5')).toEqual(details)
    })

    it('marks the groq models groq no longer serves as deprecated', () => {
        expect(getModelDetails('groq', 'llama-3.3-70b-versatile')?.deprecated).toBe(true)
    })

    it('returns nothing for unknown models and providers', () => {
        expect(getModelDetails('groq', 'no-such-model')).toBeUndefined()
        expect(getModelDetails('no-such-provider', 'x')).toBeUndefined()
    })
})
