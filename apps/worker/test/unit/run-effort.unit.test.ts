import { Agent, runAgentLoop } from '@december/agent'
import { describe, expect, it } from 'bun:test'

import { runModelConfig } from '../../src/llm-source'

import type { LLMProvider } from '@december/providers'

/** the reasoning level of each model call of one run with this configuration */
const levelsInModelCalls = async (config: ReturnType<typeof runModelConfig>) => {
    const levels: unknown[] = []
    const llm: LLMProvider = {
        id: 'mock',
        stream: async function* (_messages, _tools, _system, modelOptions) {
            levels.push(modelOptions?.thinkingLevel)
            yield { type: 'text', text: 'done' }
        },
    }
    const agent = new Agent({ llm, tools: [], operations: {} as any, ...config })
    for await (const _event of runAgentLoop(agent, 'refactor the parser')) {
        // drain events
    }
    return levels
}

// fast and deep (#632): the effort of the session is the reasoning level of the model call
describe('the effort of a session reaches the model', () => {
    it('deep runs the model call with deep reasoning', async () => {
        const config = runModelConfig({ model: 'claude-sonnet-4-5', effort: 'deep' })

        expect(await levelsInModelCalls(config)).toEqual(['deep'])
    })

    it('fast runs the model call with fast reasoning', async () => {
        const config = runModelConfig({ model: 'claude-sonnet-4-5', effort: 'fast' })

        expect(await levelsInModelCalls(config)).toEqual(['fast'])
    })

    it('a run with no effort (the github app) stays on fast', async () => {
        const config = runModelConfig({ model: 'claude-sonnet-4-5' })

        expect(await levelsInModelCalls(config)).toEqual(['fast'])
    })

    it('a model with no reasoning control runs in standard mode, as in the cli', async () => {
        const config = runModelConfig({ model: 'claude-3-5-sonnet', effort: 'deep' })

        expect(await levelsInModelCalls(config)).toEqual(['off'])
    })

    it('names the model, and gives the level to the agent itself, not only to the model options', () => {
        expect(runModelConfig({ model: 'm-1', effort: 'deep' })).toEqual({
            modelOptions: { model: 'm-1', thinkingLevel: 'deep' },
            thinkingLevel: 'deep',
        })
    })
})
