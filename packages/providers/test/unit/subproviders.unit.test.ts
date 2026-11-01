import { describe, expect, test } from 'bun:test'

import {
    AbliterationProvider,
    AgentRouterProvider,
    AgnesProvider,
    AIAndProvider,
    AKIProvider,
    AmbientProvider,
    ArceeProvider,
    AurikoProvider,
    BasetenProvider,
    CerebrasProvider,
    CohereProvider,
    DashScopeProvider,
    DeepSeekProvider,
    FireworksProvider,
    GroqProvider,
    HuggingFaceProvider,
    HyperbolicProvider,
    KimiProvider,
    MetaProvider,
    MiniMaxProvider,
    MistralProvider,
    MoonshotProvider,
    NvidiaProvider,
    PerplexityProvider,
    SakanaProvider,
    SambaNovaProvider,
    SarvamProvider,
    SiliconFlowProvider,
    StepFunProvider,
    ThinkingMachinesProvider,
    TogetherProvider,
    UpstageProvider,
    XAIProvider,
    XiaomiProvider,
    ZAIProvider,
    ZhipuAIProvider,
    resolveThinkingMachinesModel,
} from '../../src/index'

describe('OpenAI-compatible Subproviders (Unit)', () => {
    test('instantiates DeepSeekProvider with correct ID', () => {
        const provider = new DeepSeekProvider('dummy-key')
        expect(provider.id).toBe('deepseek')
    })

    test('instantiates GroqProvider with correct ID', () => {
        const provider = new GroqProvider('dummy-key')
        expect(provider.id).toBe('groq')
    })

    test('instantiates HuggingFaceProvider with correct ID', () => {
        const provider = new HuggingFaceProvider('dummy-key')
        expect(provider.id).toBe('huggingface')
    })

    test('instantiates KimiProvider with correct ID', () => {
        const provider = new KimiProvider('dummy-key')
        expect(provider.id).toBe('kimi')
    })

    test('instantiates MistralProvider with correct ID', () => {
        const provider = new MistralProvider('dummy-key')
        expect(provider.id).toBe('mistral')
    })

    test('instantiates MoonshotProvider with correct ID', () => {
        const provider = new MoonshotProvider('dummy-key')
        expect(provider.id).toBe('moonshot')
    })

    test('instantiates XAIProvider with correct ID', () => {
        const provider = new XAIProvider('dummy-key')
        expect(provider.id).toBe('xai')
    })

    test('instantiates ZAIProvider with correct ID', () => {
        const provider = new ZAIProvider('dummy-key')
        expect(provider.id).toBe('zai')
    })

    test('instantiates NvidiaProvider with correct ID', () => {
        const provider = new NvidiaProvider('dummy-key')
        expect(provider.id).toBe('nvidia')
    })

    test('instantiates SambaNovaProvider with correct ID', () => {
        const provider = new SambaNovaProvider('dummy-key')
        expect(provider.id).toBe('sambanova')
    })

    test('instantiates CerebrasProvider with correct ID', () => {
        const provider = new CerebrasProvider('dummy-key')
        expect(provider.id).toBe('cerebras')
    })

    test('instantiates SiliconFlowProvider with correct ID', () => {
        const provider = new SiliconFlowProvider('dummy-key')
        expect(provider.id).toBe('siliconflow')
    })

    test('instantiates TogetherProvider with correct ID', () => {
        const provider = new TogetherProvider('dummy-key')
        expect(provider.id).toBe('together')
    })

    test('instantiates HyperbolicProvider with correct ID', () => {
        const provider = new HyperbolicProvider('dummy-key')
        expect(provider.id).toBe('hyperbolic')
    })

    test('instantiates FireworksProvider with correct ID', () => {
        const provider = new FireworksProvider('dummy-key')
        expect(provider.id).toBe('fireworks')
    })

    test('instantiates PerplexityProvider with correct ID', () => {
        const provider = new PerplexityProvider('dummy-key')
        expect(provider.id).toBe('perplexity')
    })

    test('instantiates CohereProvider with correct ID', () => {
        const provider = new CohereProvider('dummy-key')
        expect(provider.id).toBe('cohere')
    })

    test('instantiates AgentRouterProvider with correct ID', () => {
        const provider = new AgentRouterProvider('dummy-key')
        expect(provider.id).toBe('agentrouter')
    })

    test('instantiates DashScopeProvider with correct ID', () => {
        const provider = new DashScopeProvider('dummy-key')
        expect(provider.id).toBe('dashscope')
    })

    test('instantiates MiniMaxProvider with correct ID', () => {
        const provider = new MiniMaxProvider('dummy-key')
        expect(provider.id).toBe('minimax')
    })

    test('instantiates ArceeProvider with correct ID', () => {
        const provider = new ArceeProvider('dummy-key')
        expect(provider.id).toBe('arcee')
    })

    test('instantiates MetaProvider with correct ID', () => {
        const provider = new MetaProvider('dummy-key')
        expect(provider.id).toBe('meta')
    })

    test('instantiates SakanaProvider with correct ID', () => {
        const provider = new SakanaProvider('dummy-key')
        expect(provider.id).toBe('sakana')
    })

    test('instantiates SarvamProvider with correct ID', () => {
        const provider = new SarvamProvider('dummy-key')
        expect(provider.id).toBe('sarvam')
    })

    test('instantiates StepFunProvider with correct ID', () => {
        const provider = new StepFunProvider('dummy-key')
        expect(provider.id).toBe('stepfun')
    })

    test('instantiates UpstageProvider with correct ID', () => {
        const provider = new UpstageProvider('dummy-key')
        expect(provider.id).toBe('upstage')
    })

    test('instantiates ThinkingMachinesProvider with correct ID and resolves model aliases', () => {
        const provider = new ThinkingMachinesProvider('dummy-key')
        expect(provider.id).toBe('thinkingmachines')
        expect(resolveThinkingMachinesModel('inkling')).toBe('thinkingmachines/Inkling')
        expect(resolveThinkingMachinesModel('inkling:peft:262144')).toBe(
            'thinkingmachines/Inkling:peft:262144'
        )
        expect(resolveThinkingMachinesModel(undefined)).toBe('thinkingmachines/Inkling')
    })

    test('instantiates XiaomiProvider with correct ID', () => {
        const provider = new XiaomiProvider('dummy-key')
        expect(provider.id).toBe('xiaomi')
    })

    test('instantiates ZhipuAIProvider alias with correct ID', () => {
        const provider = new ZhipuAIProvider('dummy-key')
        expect(provider.id).toBe('zai')
    })

    test('instantiates AbliterationProvider with correct ID', () => {
        const provider = new AbliterationProvider('dummy-key')
        expect(provider.id).toBe('abliteration')
    })

    test('instantiates AgnesProvider with correct ID', () => {
        const provider = new AgnesProvider('dummy-key')
        expect(provider.id).toBe('agnes')
    })

    test('instantiates AIAndProvider with correct ID', () => {
        const provider = new AIAndProvider('dummy-key')
        expect(provider.id).toBe('aiand')
    })

    test('instantiates AKIProvider with correct ID', () => {
        const provider = new AKIProvider('dummy-key')
        expect(provider.id).toBe('aki')
    })

    test('instantiates AmbientProvider with correct ID', () => {
        const provider = new AmbientProvider('dummy-key')
        expect(provider.id).toBe('ambient')
    })

    test('instantiates AurikoProvider with correct ID', () => {
        const provider = new AurikoProvider('dummy-key')
        expect(provider.id).toBe('auriko')
    })

    test('instantiates BasetenProvider with correct ID', () => {
        const provider = new BasetenProvider('dummy-key')
        expect(provider.id).toBe('baseten')
    })
})
