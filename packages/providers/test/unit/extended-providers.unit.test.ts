import { describe, expect, test } from 'bun:test'

import {
    getModelContextWindow,
    DeepinfraProvider,
    NovitaAiProvider,
    NebiusProvider,
    Ai21Provider,
    MorphProvider,
    AbacusProvider,
    VolcengineProvider,
    WaferAiProvider,
} from '../../src/index'

describe('Extended BYOK Providers (Unit)', () => {
    test('instantiates major serverless GPU providers with correct ID', () => {
        expect(new DeepinfraProvider('dummy-key').id).toBe('deepinfra')
        expect(new NovitaAiProvider('dummy-key').id).toBe('novita-ai')
        expect(new NebiusProvider('dummy-key').id).toBe('nebius')
        expect(new WaferAiProvider('dummy-key').id).toBe('wafer.ai')
    })

    test('instantiates frontier labs and model creators with correct ID', () => {
        expect(new Ai21Provider('dummy-key').id).toBe('ai21')
        expect(new MorphProvider('dummy-key').id).toBe('morph')
        expect(new AbacusProvider('dummy-key').id).toBe('abacus')
        expect(new VolcengineProvider('dummy-key').id).toBe('volcengine')
    })

    test('returns accurate context windows for extended models', () => {
        expect(getModelContextWindow('wafer.ai/glm5.2-fast')).toBe(1048576)
        expect(getModelContextWindow('deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo')).toBe(
            131072
        )
    })
})
