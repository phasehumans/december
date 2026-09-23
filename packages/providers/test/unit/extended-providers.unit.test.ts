import { describe, expect, test } from 'bun:test'

import {
    getModelContextWindow,
    DeepinfraProvider,
    NovitaAiProvider,
    VultrProvider,
    DigitaloceanProvider,
    HetznerProvider,
    ScalewayProvider,
    ModalProvider,
    CrusoeProvider,
    NebiusProvider,
    FriendliProvider,
    Ai21Provider,
    AmdProvider,
    NovaProvider,
    MorphProvider,
    PoeProvider,
    V0Provider,
    OpencodeProvider,
    RequestyProvider,
    AbacusProvider,
    FastrouterProvider,
    VolcengineProvider,
    ThreeZeroTwoAIProvider,
} from '../../src/index'

describe('Extended BYOK Providers (Unit)', () => {
    test('instantiates major serverless GPU providers with correct ID', () => {
        expect(new DeepinfraProvider('dummy-key').id).toBe('deepinfra')
        expect(new NovitaAiProvider('dummy-key').id).toBe('novita-ai')
        expect(new VultrProvider('dummy-key').id).toBe('vultr')
        expect(new DigitaloceanProvider('dummy-key').id).toBe('digitalocean')
        expect(new HetznerProvider('dummy-key').id).toBe('hetzner')
        expect(new ScalewayProvider('dummy-key').id).toBe('scaleway')
        expect(new ModalProvider('dummy-key').id).toBe('modal')
        expect(new CrusoeProvider('dummy-key').id).toBe('crusoe')
        expect(new NebiusProvider('dummy-key').id).toBe('nebius')
        expect(new FriendliProvider('dummy-key').id).toBe('friendli')
    })

    test('instantiates frontier labs and model creators with correct ID', () => {
        expect(new Ai21Provider('dummy-key').id).toBe('ai21')
        expect(new AmdProvider('dummy-key').id).toBe('amd')
        expect(new NovaProvider('dummy-key').id).toBe('nova')
        expect(new MorphProvider('dummy-key').id).toBe('morph')
        expect(new PoeProvider('dummy-key').id).toBe('poe')
        expect(new V0Provider('dummy-key').id).toBe('v0')
    })

    test('instantiates gateways, routers, and emerging providers', () => {
        expect(new OpencodeProvider('dummy-key').id).toBe('opencode')
        expect(new RequestyProvider('dummy-key').id).toBe('requesty')
        expect(new AbacusProvider('dummy-key').id).toBe('abacus')
        expect(new FastrouterProvider('dummy-key').id).toBe('fastrouter')
        expect(new VolcengineProvider('dummy-key').id).toBe('volcengine')
        expect(new ThreeZeroTwoAIProvider('dummy-key').id).toBe('302ai')
    })

    test('returns accurate context windows for extended models', () => {
        expect(getModelContextWindow('crusoe/meta-llama/Llama-3.3-70B-Instruct')).toBe(128000)
        expect(getModelContextWindow('deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo')).toBe(
            131072
        )
    })
})
