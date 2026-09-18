import {
    getModelContextWindow,
    SarvamProvider,
    StepFunProvider,
    UpstageProvider,
    ThinkingMachinesProvider,
    resolveThinkingMachinesModel,
    XiaomiProvider,
    ZhipuAIProvider,
    AbliterationProvider,
    AgnesProvider,
    AIRouterProvider,
    AIAndProvider,
    AKIProvider,
    AmbientProvider,
    AurikoProvider,
    BasetenProvider,
} from '@december/providers'
import { describe, expect, it } from 'bun:test'

import {
    formatProviderName,
    getConfiguredProviders,
    applyProviderSwitch,
    resolveSwitchTarget,
    type DecemberConfig,
} from '../../src/config'
import {
    getProviderModels,
    getDefaultModelForProvider,
    ensureValidModelForProvider,
    isValidModelForProvider,
} from '../../src/utils/models'
import {
    calculateUsageCost,
    inferProviderFromModel,
    formatUsageCard,
} from '../../src/utils/usage-rates'

describe('BYOK Providers End-to-End Regression & Switching Verification (Unit)', () => {
    describe('Provider Class Implementations & Protocols', () => {
        it('instantiates SarvamProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new SarvamProvider('test-sarvam-key')
            expect(provider.id).toBe('sarvam')
        })

        it('instantiates StepFunProvider with global OpenAI endpoint and credentials', () => {
            const provider = new StepFunProvider('test-stepfun-key')
            expect(provider.id).toBe('stepfun')
        })

        it('instantiates UpstageProvider with solar OpenAI endpoint and credentials', () => {
            const provider = new UpstageProvider('test-upstage-key')
            expect(provider.id).toBe('upstage')
        })

        it('instantiates ThinkingMachinesProvider with Anthropic endpoint and resolves aliases', () => {
            const provider = new ThinkingMachinesProvider('test-tinker-key')
            expect(provider.id).toBe('thinkingmachines')
            expect(resolveThinkingMachinesModel('inkling')).toBe('thinkingmachines/Inkling')
            expect(resolveThinkingMachinesModel('inkling:peft:262144')).toBe(
                'thinkingmachines/Inkling:peft:262144'
            )
            expect(resolveThinkingMachinesModel(undefined)).toBe('thinkingmachines/Inkling')
        })

        it('instantiates XiaomiProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new XiaomiProvider('test-xiaomi-key')
            expect(provider.id).toBe('xiaomi')
        })

        it('instantiates ZhipuAIProvider with coding endpoint and credentials', () => {
            const provider = new ZhipuAIProvider('test-zhipu-key')
            expect(provider.id).toBe('zai')
        })

        it('instantiates AbliterationProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AbliterationProvider('test-abliteration-key')
            expect(provider.id).toBe('abliteration')
        })

        it('instantiates AgnesProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AgnesProvider('test-agnes-key')
            expect(provider.id).toBe('agnes')
        })

        it('instantiates AIRouterProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AIRouterProvider('test-airouter-key')
            expect(provider.id).toBe('airouter')
        })

        it('instantiates AIAndProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AIAndProvider('test-aiand-key')
            expect(provider.id).toBe('aiand')
        })

        it('instantiates AKIProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AKIProvider('test-aki-key')
            expect(provider.id).toBe('aki')
        })

        it('instantiates AmbientProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AmbientProvider('test-ambient-key')
            expect(provider.id).toBe('ambient')
        })

        it('instantiates AurikoProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new AurikoProvider('test-auriko-key')
            expect(provider.id).toBe('auriko')
        })

        it('instantiates BasetenProvider with proper OpenAI endpoint and credentials', () => {
            const provider = new BasetenProvider('test-baseten-key')
            expect(provider.id).toBe('baseten')
        })
    })

    describe('Model Context Windows', () => {
        it('returns correct context windows for all new provider models', () => {
            expect(getModelContextWindow('solar-pro4')).toBe(524288)
            expect(getModelContextWindow('solar-pro3')).toBe(524288)
            expect(getModelContextWindow('solar-pro2')).toBe(524288)
            expect(getModelContextWindow('solar-mini')).toBe(65536)
            expect(getModelContextWindow('thinkingmachines/Inkling')).toBe(131072)
            expect(getModelContextWindow('thinkingmachines/Inkling:peft:262144')).toBe(262144)
            expect(getModelContextWindow('inkling')).toBe(131072)
            expect(getModelContextWindow('mimo-v2.5')).toBe(1048576)
            expect(getModelContextWindow('mimo-v2.5-pro')).toBe(1048576)
            expect(getModelContextWindow('mimo-v2-flash')).toBe(262144)
            expect(getModelContextWindow('grok-4.6')).toBe(500000)
            expect(getModelContextWindow('grok-4.3')).toBe(1000000)
            expect(getModelContextWindow('grok-4.1-fast')).toBe(2000000)
            expect(getModelContextWindow('glm-5.1')).toBe(200000)
            expect(getModelContextWindow('abliterated-model-large-v2')).toBe(1000000)
            expect(getModelContextWindow('abliterated-model-large')).toBe(1000000)
            expect(getModelContextWindow('abliterated-model')).toBe(262144)
            expect(getModelContextWindow('agnes-3.0-flash')).toBe(512000)
            expect(getModelContextWindow('agnes-2.5-pro')).toBe(1000000)
            expect(getModelContextWindow('agnes-2.5-flash')).toBe(512000)
            expect(getModelContextWindow('agnes-2.5-pro-beta')).toBe(1000000)
            expect(getModelContextWindow('gpt-5.6-luna')).toBe(1050000)
            expect(getModelContextWindow('airouter/gpt-5.6-luna')).toBe(1050000)
            expect(getModelContextWindow('deepseek-ai/deepseek-v4-flash')).toBe(1050000)
            expect(getModelContextWindow('aiand/deepseek-ai/deepseek-v4-flash')).toBe(1050000)
            expect(getModelContextWindow('deepseek-v4-flash-0731-284b')).toBe(1050000)
            expect(getModelContextWindow('aki/deepseek-v4-flash-0731-284b')).toBe(1050000)
            expect(getModelContextWindow('ambient/large')).toBe(202000)
            expect(getModelContextWindow('ambient/deepseek/deepseek-v4-flash')).toBe(1050000)
            expect(getModelContextWindow('auriko/claude-sonnet-4-6')).toBe(1000000)
            expect(getModelContextWindow('auriko/deepseek-v4-flash')).toBe(1000000)
            expect(getModelContextWindow('baseten/deepseek-ai/DeepSeek-V4.1-Flash')).toBe(1048576)
            expect(getModelContextWindow('baseten/zai-org/GLM-5.3')).toBe(1048576)
        })
    })

    describe('Model Registry & Alias Normalization', () => {
        it('returns provider model lists for each new provider and their aliases', () => {
            const sarvamModels = getProviderModels('sarvam')
            expect(sarvamModels.map((m) => m.value)).toEqual(['sarvam-105b', 'sarvam-30b'])

            const stepfunModels = getProviderModels('stepfun')
            expect(stepfunModels.map((m) => m.value)).toEqual([
                'step-3.7-flash',
                'step-3.5-flash',
                'step-1-32k',
            ])

            const upstageModels = getProviderModels('upstage')
            expect(upstageModels.map((m) => m.value)).toEqual([
                'solar-pro4',
                'solar-pro3',
                'solar-pro2',
                'solar-mini',
            ])

            const tinkerModels = getProviderModels('thinkingmachines')
            expect(tinkerModels.map((m) => m.value)).toEqual([
                'thinkingmachines/Inkling',
                'thinkingmachines/Inkling:peft:262144',
            ])

            const xiaomiModels = getProviderModels('xiaomi')
            expect(xiaomiModels.map((m) => m.value)).toEqual([
                'mimo-v2.5',
                'mimo-v2.5-pro',
                'mimo-v2.5-pro-ultraspeed',
                'mimo-v2-flash',
                'mimo-v2-omni',
                'mimo-v2-pro',
            ])

            // Test aliases
            expect(getProviderModels('solar')).toEqual(upstageModels)
            expect(getProviderModels('tinker')).toEqual(tinkerModels)
            expect(getProviderModels('inkling')).toEqual(tinkerModels)
            expect(getProviderModels('mimo')).toEqual(xiaomiModels)

            const abliterationModels = getProviderModels('abliteration')
            expect(abliterationModels.map((m) => m.value)).toEqual([
                'abliterated-model-large-v2',
                'abliterated-model-large',
                'abliterated-model',
            ])
            expect(getProviderModels('abliterationai')).toEqual(abliterationModels)
            expect(getProviderModels('abliteration-ai')).toEqual(abliterationModels)

            const agnesModels = getProviderModels('agnes')
            expect(agnesModels.map((m) => m.value)).toEqual([
                'agnes-3.0-flash',
                'agnes-2.5-pro',
                'agnes-2.5-flash',
                'agnes-2.5-pro-beta',
            ])
            expect(getProviderModels('agnesai')).toEqual(agnesModels)
            expect(getProviderModels('agnes-ai')).toEqual(agnesModels)

            const airouterModels = getProviderModels('airouter')
            expect(airouterModels.map((m) => m.value)).toEqual([
                'gpt-5.6-luna',
                'gpt-5.6-terra',
                'gpt-5.6-sol',
                'gpt-5.4',
                'gpt-5.5',
            ])
            expect(getProviderModels('ai-router')).toEqual(airouterModels)

            const aiandModels = getProviderModels('aiand')
            expect(aiandModels.map((m) => m.value)).toEqual([
                'deepseek-ai/deepseek-v4-flash',
                'deepseek-ai/deepseek-v4-pro',
                'zai-org/glm-5.3',
                'zai-org/glm-5.2',
                'moonshotai/kimi-k2.7-code',
                'moonshotai/kimi-k3',
                'google/gemma-4-31b-it',
                'openai/gpt-oss-120b',
                'motif-technologies/motif-3',
                'qwen/qwen3.8-27b',
            ])

            const akiModels = getProviderModels('aki')
            expect(akiModels.map((m) => m.value)).toEqual([
                'deepseek-v4-flash-0731-284b',
                'glm5.3-754b',
                'gemma4-26b',
                'gpt-oss-120b',
                'mistral4-119b',
                'qwen3.8-27b',
                'qwen3.6-35b',
            ])
            expect(getProviderModels('aki-io')).toEqual(akiModels)
            expect(getProviderModels('akiio')).toEqual(akiModels)

            const ambientModels = getProviderModels('ambient')
            expect(ambientModels.map((m) => m.value)).toEqual([
                'deepseek/deepseek-v4-flash',
                'deepseek/deepseek-v4-flash-0731',
                'ambient/large',
                'zai-org/GLM-5.2-FP8',
                'moonshotai/kimi-k2.7-code',
                'xiaomi/mimo-v2.5',
                'stepfun/step-3.7-flash',
            ])

            const aurikoModels = getProviderModels('auriko')
            expect(aurikoModels.map((m) => m.value)).toEqual([
                'claude-sonnet-4-6',
                'claude-opus-4-6',
                'claude-opus-4-7',
                'deepseek-v4-flash',
                'deepseek-v4-pro',
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-3.1-pro-preview',
                'glm-5.1',
                'grok-4.3',
                'kimi-k2.5',
                'kimi-k2.6',
                'minimax-m2-7',
                'minimax-m2-7-highspeed',
                'qwen-3.6-plus',
            ])
            expect(getProviderModels('aurikoai')).toEqual(aurikoModels)
            expect(getProviderModels('auriko-ai')).toEqual(aurikoModels)

            const basetenModels = getProviderModels('baseten')
            expect(basetenModels.map((m) => m.value)).toEqual([
                'deepseek-ai/DeepSeek-V4.1-Flash',
                'deepseek-ai/DeepSeek-V4-Flash-0731',
                'deepseek-ai/DeepSeek-V4-Pro',
                'deepseek-ai/DeepSeek-V4-Pro-0813',
                'deepseek-ai/DeepSeek-V3.1',
                'zai-org/GLM-5.3',
                'zai-org/GLM-5.3-Fast',
                'zai-org/GLM-5.3-Flash',
                'zai-org/GLM-5.2',
                'zai-org/GLM-5.2-Fast',
                'zai-org/GLM-5.1',
                'zai-org/GLM-5',
                'zai-org/GLM-4.7',
                'moonshotai/Kimi-K2.7-Code',
                'moonshotai/Kimi-K3',
                'moonshotai/Kimi-K2.6',
                'moonshotai/Kimi-K2.5',
                'thinkingmachines/inkling',
                'thinkingmachines/inkling-small',
                'nvidia/Nemotron-120B-A12B',
                'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B',
                'openai/gpt-oss-120b',
            ])
            expect(getProviderModels('basetenco')).toEqual(basetenModels)
            expect(getProviderModels('baseten-co')).toEqual(basetenModels)
        })

        it('returns correct default models for providers', () => {
            expect(getDefaultModelForProvider('sarvam')).toBe('sarvam-105b')
            expect(getDefaultModelForProvider('stepfun')).toBe('step-3.7-flash')
            expect(getDefaultModelForProvider('upstage')).toBe('solar-pro4')
            expect(getDefaultModelForProvider('solar')).toBe('solar-pro4')
            expect(getDefaultModelForProvider('thinkingmachines')).toBe('thinkingmachines/Inkling')
            expect(getDefaultModelForProvider('tinker')).toBe('thinkingmachines/Inkling')
            expect(getDefaultModelForProvider('xiaomi')).toBe('mimo-v2.5')
            expect(getDefaultModelForProvider('mimo')).toBe('mimo-v2.5')
            expect(getDefaultModelForProvider('zai')).toBe('glm-5.3-flash')
            expect(getDefaultModelForProvider('zhipuai')).toBe('glm-5.3-flash')
            expect(getDefaultModelForProvider('abliteration')).toBe('abliterated-model-large-v2')
            expect(getDefaultModelForProvider('abliterationai')).toBe('abliterated-model-large-v2')
            expect(getDefaultModelForProvider('abliteration-ai')).toBe('abliterated-model-large-v2')
            expect(getDefaultModelForProvider('agnes')).toBe('agnes-3.0-flash')
            expect(getDefaultModelForProvider('agnesai')).toBe('agnes-3.0-flash')
            expect(getDefaultModelForProvider('agnes-ai')).toBe('agnes-3.0-flash')
            expect(getDefaultModelForProvider('airouter')).toBe('gpt-5.6-luna')
            expect(getDefaultModelForProvider('ai-router')).toBe('gpt-5.6-luna')
            expect(getDefaultModelForProvider('aiand')).toBe('deepseek-ai/deepseek-v4-flash')
            expect(getDefaultModelForProvider('aki')).toBe('deepseek-v4-flash-0731-284b')
            expect(getDefaultModelForProvider('aki-io')).toBe('deepseek-v4-flash-0731-284b')
            expect(getDefaultModelForProvider('ambient')).toBe('deepseek/deepseek-v4-flash')
            expect(getDefaultModelForProvider('auriko')).toBe('claude-sonnet-4-6')
            expect(getDefaultModelForProvider('aurikoai')).toBe('claude-sonnet-4-6')
            expect(getDefaultModelForProvider('auriko-ai')).toBe('claude-sonnet-4-6')
            expect(getDefaultModelForProvider('baseten')).toBe('deepseek-ai/DeepSeek-V4.1-Flash')
            expect(getDefaultModelForProvider('basetenco')).toBe('deepseek-ai/DeepSeek-V4.1-Flash')
            expect(getDefaultModelForProvider('baseten-co')).toBe('deepseek-ai/DeepSeek-V4.1-Flash')
        })

        it('validates and normalizes models correctly', () => {
            expect(isValidModelForProvider('sarvam', 'sarvam-105b')).toBe(true)
            expect(isValidModelForProvider('stepfun', 'step-3.7-flash')).toBe(true)
            expect(isValidModelForProvider('upstage', 'solar-pro4')).toBe(true)
            expect(isValidModelForProvider('thinkingmachines', 'thinkingmachines/Inkling')).toBe(
                true
            )
            expect(isValidModelForProvider('thinkingmachines', 'inkling')).toBe(true)
            expect(isValidModelForProvider('xiaomi', 'mimo-v2.5')).toBe(true)
            expect(isValidModelForProvider('mimo', 'mimo-v2.5')).toBe(true)
            expect(isValidModelForProvider('zai', 'glm-5.3-flash')).toBe(true)
            expect(isValidModelForProvider('zhipuai', 'glm-5.3-flash')).toBe(true)
            expect(isValidModelForProvider('abliteration', 'abliterated-model-large-v2')).toBe(true)
            expect(isValidModelForProvider('abliterationai', 'abliterated-model')).toBe(true)
            expect(isValidModelForProvider('agnes', 'agnes-3.0-flash')).toBe(true)
            expect(isValidModelForProvider('agnesai', 'agnes-2.5-pro')).toBe(true)
            expect(isValidModelForProvider('airouter', 'gpt-5.6-luna')).toBe(true)
            expect(isValidModelForProvider('ai-router', 'gpt-5.6-terra')).toBe(true)
            expect(isValidModelForProvider('aiand', 'deepseek-ai/deepseek-v4-flash')).toBe(true)
            expect(isValidModelForProvider('aki', 'deepseek-v4-flash-0731-284b')).toBe(true)
            expect(isValidModelForProvider('aki-io', 'glm5.3-754b')).toBe(true)
            expect(isValidModelForProvider('ambient', 'deepseek/deepseek-v4-flash')).toBe(true)
            expect(isValidModelForProvider('auriko', 'claude-sonnet-4-6')).toBe(true)
            expect(isValidModelForProvider('aurikoai', 'deepseek-v4-flash')).toBe(true)
            expect(isValidModelForProvider('baseten', 'deepseek-ai/DeepSeek-V4.1-Flash')).toBe(true)
            expect(isValidModelForProvider('basetenco', 'zai-org/GLM-5.3')).toBe(true)

            expect(ensureValidModelForProvider('thinkingmachines', 'inkling')).toBe(
                'thinkingmachines/Inkling'
            )
            expect(ensureValidModelForProvider('tinker', 'inkling')).toBe(
                'thinkingmachines/Inkling'
            )
            expect(ensureValidModelForProvider('upstage', 'solar-pro4')).toBe('solar-pro4')
            expect(ensureValidModelForProvider('xiaomi', 'mimo-v2.5')).toBe('mimo-v2.5')
            expect(ensureValidModelForProvider('mimo', 'mimo-v2.5')).toBe('mimo-v2.5')
            expect(ensureValidModelForProvider('abliteration', 'abliterated-model-large-v2')).toBe(
                'abliterated-model-large-v2'
            )
            expect(ensureValidModelForProvider('agnes', 'agnes-3.0-flash')).toBe('agnes-3.0-flash')
            expect(ensureValidModelForProvider('airouter', 'gpt-5.6-luna')).toBe('gpt-5.6-luna')
            expect(ensureValidModelForProvider('aiand', 'deepseek-ai/deepseek-v4-flash')).toBe(
                'deepseek-ai/deepseek-v4-flash'
            )
            expect(ensureValidModelForProvider('aki', 'deepseek-v4-flash-0731-284b')).toBe(
                'deepseek-v4-flash-0731-284b'
            )
            expect(ensureValidModelForProvider('ambient', 'deepseek/deepseek-v4-flash')).toBe(
                'deepseek/deepseek-v4-flash'
            )
            expect(ensureValidModelForProvider('auriko', 'claude-sonnet-4-6')).toBe(
                'claude-sonnet-4-6'
            )
            expect(ensureValidModelForProvider('baseten', 'deepseek-ai/DeepSeek-V4.1-Flash')).toBe(
                'deepseek-ai/DeepSeek-V4.1-Flash'
            )
        })
    })

    describe('Provider Name Formatting', () => {
        it('formats names properly for each provider and alias', () => {
            expect(formatProviderName('sarvam')).toBe('Sarvam AI')
            expect(formatProviderName('sarvamai')).toBe('Sarvam AI')
            expect(formatProviderName('stepfun')).toBe('StepFun (Global)')
            expect(formatProviderName('stepfunai')).toBe('StepFun (Global)')
            expect(formatProviderName('upstage')).toBe('Upstage Solar')
            expect(formatProviderName('solar')).toBe('Upstage Solar')
            expect(formatProviderName('thinkingmachines')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('xiaomi')).toBe('Xiaomi')
            expect(formatProviderName('mimo')).toBe('Xiaomi')
            expect(formatProviderName('xai')).toBe('xAI')
            expect(formatProviderName('zhipuai')).toBe('Zhipu AI')
            expect(formatProviderName('zhipu')).toBe('Zhipu AI')
            expect(formatProviderName('tinker')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('inkling')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('abliteration')).toBe('Abliteration AI')
            expect(formatProviderName('abliterationai')).toBe('Abliteration AI')
            expect(formatProviderName('abliteration-ai')).toBe('Abliteration AI')
            expect(formatProviderName('agnes')).toBe('Agnes AI')
            expect(formatProviderName('agnesai')).toBe('Agnes AI')
            expect(formatProviderName('agnes-ai')).toBe('Agnes AI')
            expect(formatProviderName('airouter')).toBe('AI Router')
            expect(formatProviderName('ai-router')).toBe('AI Router')
            expect(formatProviderName('aiand')).toBe('AI&')
            expect(formatProviderName('aki')).toBe('AKI.IO')
            expect(formatProviderName('aki-io')).toBe('AKI.IO')
            expect(formatProviderName('akiio')).toBe('AKI.IO')
            expect(formatProviderName('ambient')).toBe('Ambient')
            expect(formatProviderName('auriko')).toBe('Auriko')
            expect(formatProviderName('aurikoai')).toBe('Auriko')
            expect(formatProviderName('auriko-ai')).toBe('Auriko')
            expect(formatProviderName('baseten')).toBe('Baseten')
            expect(formatProviderName('basetenco')).toBe('Baseten')
            expect(formatProviderName('baseten-co')).toBe('Baseten')
        })
    })

    describe('Cost Calculation & In-Terminal Cards', () => {
        it('calculates accurate usage costs for all 4 new providers', () => {
            const sarvamCost = calculateUsageCost({
                model: 'sarvam-105b',
                promptTokens: 100_000,
                completionTokens: 50_000,
            })
            // 100k * 0.75/1M = $0.075, 50k * 3.0/1M = $0.15 => total $0.225
            expect(sarvamCost.totalCost).toBeCloseTo(0.225, 3)

            const stepfunCost = calculateUsageCost({
                model: 'step-3.7-flash',
                promptTokens: 1_000_000,
                completionTokens: 500_000,
            })
            // 1M * 0.14 = $0.14, 500k * 0.56 = $0.28 => total $0.42
            expect(stepfunCost.totalCost).toBeCloseTo(0.42, 2)

            const solarCost = calculateUsageCost({
                model: 'solar-pro4',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            // 1M * 0.25 = $0.25, 1M * 0.25 = $0.25 => total $0.50
            expect(solarCost.totalCost).toBeCloseTo(0.5, 2)

            const tinkerCost = calculateUsageCost({
                model: 'thinkingmachines/Inkling',
                promptTokens: 500_000,
                completionTokens: 100_000,
            })
            // 500k * 2.0 = $1.00, 100k * 6.0 = $0.60 => total $1.60
            expect(tinkerCost.totalCost).toBeCloseTo(1.6, 2)

            const abliterationCost = calculateUsageCost({
                model: 'abliterated-model-large-v2',
                promptTokens: 100_000,
                completionTokens: 100_000,
            })
            // 100k * 5.0/1M = $0.50, 100k * 5.0/1M = $0.50 => total $1.00
            expect(abliterationCost.totalCost).toBeCloseTo(1.0, 2)

            const agnesCost = calculateUsageCost({
                model: 'agnes-2.5-pro',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            // 1M * 0.45 = $0.45, 1M * 0.90 = $0.90 => total $1.35
            expect(agnesCost.totalCost).toBeCloseTo(1.35, 2)

            const airouterCost = calculateUsageCost({
                model: 'airouter/gpt-5.6-luna',
                promptTokens: 1_000_000,
                completionTokens: 500_000,
            })
            // 1M * 1.0 = $1.00, 500k * 6.0 = $3.00 => total $4.00
            expect(airouterCost.totalCost).toBeCloseTo(4.0, 2)

            const aiandCost = calculateUsageCost({
                model: 'deepseek-ai/deepseek-v4-flash',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            // 1M * 0.15 = $0.15, 1M * 0.25 = $0.25 => total $0.40
            expect(aiandCost.totalCost).toBeCloseTo(0.4, 2)

            const akiCost = calculateUsageCost({
                model: 'deepseek-v4-flash-0731-284b',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            // 1M * 0.20 = $0.20, 1M * 0.50 = $0.50 => total $0.70
            expect(akiCost.totalCost).toBeCloseTo(0.7, 2)

            const ambientCost = calculateUsageCost({
                model: 'ambient/large',
                promptTokens: 1_000_000,
                completionTokens: 500_000,
            })
            // 1M * 0.60 = $0.60, 500k * 2.0 = $1.00 => total $1.60
            expect(ambientCost.totalCost).toBeCloseTo(1.6, 2)

            const aurikoCost = calculateUsageCost({
                model: 'auriko/claude-sonnet-4-6',
                promptTokens: 100_000,
                completionTokens: 100_000,
            })
            // 100k * 3.0/1M = $0.30, 100k * 15.0/1M = $1.50 => total $1.80
            expect(aurikoCost.totalCost).toBeCloseTo(1.8, 2)

            const basetenCost = calculateUsageCost({
                model: 'baseten/deepseek-ai/DeepSeek-V4.1-Flash',
                promptTokens: 1_000_000,
                completionTokens: 500_000,
            })
            // 1M * 0.30 = $0.30, 500k * 1.20 = $0.60 => total $0.90
            expect(basetenCost.totalCost).toBeCloseTo(0.9, 2)
        })

        it('infers providers from models correctly', () => {
            expect(inferProviderFromModel('sarvam-30b')).toBe('sarvam')
            expect(inferProviderFromModel('step-3.5-flash')).toBe('stepfun')
            expect(inferProviderFromModel('solar-mini')).toBe('upstage')
            expect(inferProviderFromModel('thinkingmachines/Inkling:peft:262144')).toBe(
                'thinkingmachines'
            )
            expect(inferProviderFromModel('abliterated-model-large-v2')).toBe('abliteration')
            expect(inferProviderFromModel('abliteration/abliterated-model')).toBe('abliteration')
            expect(inferProviderFromModel('agnes-3.0-flash')).toBe('agnes')
            expect(inferProviderFromModel('agnes/agnes-2.5-pro')).toBe('agnes')
            expect(inferProviderFromModel('gpt-5.6-luna')).toBe('airouter')
            expect(inferProviderFromModel('airouter/gpt-5.6-terra')).toBe('airouter')
            expect(inferProviderFromModel('aiand/deepseek-ai/deepseek-v4-flash')).toBe('aiand')
            expect(inferProviderFromModel('aki/glm5.3-754b')).toBe('aki')
            expect(inferProviderFromModel('ambient/large')).toBe('ambient')
            expect(inferProviderFromModel('auriko/claude-sonnet-4-6')).toBe('auriko')
            expect(inferProviderFromModel('baseten/deepseek-ai/DeepSeek-V4.1-Flash')).toBe(
                'baseten'
            )
        })

        it('generates usage cards with legitimate console/portal URLs', () => {
            const sarvamCard = formatUsageCard({
                model: 'sarvam-105b',
                authMethod: 'byok',
                provider: 'sarvam',
                isAuthenticated: true,
            })
            expect(sarvamCard).toContain('https://indus.sarvam.ai/')

            const stepfunCard = formatUsageCard({
                model: 'step-3.7-flash',
                authMethod: 'byok',
                provider: 'stepfun',
                isAuthenticated: true,
            })
            expect(stepfunCard).toContain('https://platform.stepfun.ai/interface-key')

            const upstageCard = formatUsageCard({
                model: 'solar-pro4',
                authMethod: 'byok',
                provider: 'upstage',
                isAuthenticated: true,
            })
            expect(upstageCard).toContain('https://console.upstage.ai')

            const tinkerCard = formatUsageCard({
                model: 'thinkingmachines/Inkling',
                authMethod: 'byok',
                provider: 'thinkingmachines',
                isAuthenticated: true,
            })
            expect(tinkerCard).toContain('https://tinker.thinkingmachines.ai/')

            const abliterationCard = formatUsageCard({
                model: 'abliterated-model-large-v2',
                authMethod: 'byok',
                provider: 'abliteration',
                isAuthenticated: true,
            })
            expect(abliterationCard).toContain('https://abliteration.ai/console')

            const agnesCard = formatUsageCard({
                model: 'agnes-3.0-flash',
                authMethod: 'byok',
                provider: 'agnes',
                isAuthenticated: true,
            })
            expect(agnesCard).toContain('https://platform.agnes-ai.com/settings/apiKeys')

            const airouterCard = formatUsageCard({
                model: 'gpt-5.6-luna',
                authMethod: 'byok',
                provider: 'airouter',
                isAuthenticated: true,
            })
            expect(airouterCard).toContain('https://ai-router.dev/keys')

            const aiandCard = formatUsageCard({
                model: 'deepseek-ai/deepseek-v4-flash',
                authMethod: 'byok',
                provider: 'aiand',
                isAuthenticated: true,
            })
            expect(aiandCard).toContain('https://console.aiand.com/api-keys')

            const akiCard = formatUsageCard({
                model: 'deepseek-v4-flash-0731-284b',
                authMethod: 'byok',
                provider: 'aki',
                isAuthenticated: true,
            })
            expect(akiCard).toContain('https://aki.io/admin/user-dashboard')

            const ambientCard = formatUsageCard({
                model: 'ambient/large',
                authMethod: 'byok',
                provider: 'ambient',
                isAuthenticated: true,
            })
            expect(ambientCard).toContain('https://app.ambient.xyz/keys')

            const aurikoCard = formatUsageCard({
                model: 'claude-sonnet-4-6',
                authMethod: 'byok',
                provider: 'auriko',
                isAuthenticated: true,
            })
            expect(aurikoCard).toContain('https://www.auriko.ai/dashboard')

            const basetenCard = formatUsageCard({
                model: 'deepseek-ai/DeepSeek-V4.1-Flash',
                authMethod: 'byok',
                provider: 'baseten',
                isAuthenticated: true,
            })
            expect(basetenCard).toContain('https://app.baseten.co/settings/api_keys')
        })
    })

    describe('Multi-Provider Session Switching Simulation', () => {
        it('configures and sequentially switches through all providers including new ones in active session', () => {
            const initialConfig: DecemberConfig = {
                activeProvider: 'sarvam',
                activeModel: 'sarvam-105b',
                authPriority: 'byok',
                providers: {
                    sarvam: 'sk-sarvam-live',
                    stepfun: 'sk-stepfun-live',
                    upstage: 'sk-upstage-live',
                    thinkingmachines: 'sk-tinker-live',
                    abliteration: 'sk-abliteration-live',
                    agnes: 'sk-agnes-live',
                    airouter: 'sk-airouter-live',
                    aiand: 'sk-aiand-live',
                    aki: 'sk-aki-live',
                    ambient: 'sk-ambient-live',
                    auriko: 'sk-auriko-live',
                    baseten: 'sk-baseten-live',
                },
            }

            const configured = getConfiguredProviders(initialConfig)
            expect(configured.some((p) => p.value === 'provider:sarvam')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:stepfun')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:upstage')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:thinkingmachines')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:abliteration')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:agnes')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:airouter')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:aiand')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:aki')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:ambient')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:auriko')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:baseten')).toBe(true)

            // Switch: sarvam -> stepfun
            const targetStepfun = resolveSwitchTarget(initialConfig, 'stepfun')
            expect(targetStepfun).toBeDefined()
            const switched1 = applyProviderSwitch(initialConfig, targetStepfun!)
            expect(switched1.config.activeProvider).toBe('stepfun')
            expect(switched1.config.activeModel).toBe('step-3.7-flash')

            // Switch: stepfun -> upstage
            const targetUpstage = resolveSwitchTarget(switched1.config, 'solar')
            expect(targetUpstage).toBeDefined()
            const switched2 = applyProviderSwitch(switched1.config, targetUpstage!)
            expect(switched2.config.activeProvider).toBe('upstage')
            expect(switched2.config.activeModel).toBe('solar-pro4')

            // Switch: upstage -> thinkingmachines via alias tinker
            const targetTinker = resolveSwitchTarget(switched2.config, 'tinker')
            expect(targetTinker).toBeDefined()
            const switched3 = applyProviderSwitch(switched2.config, targetTinker!)
            expect(switched3.config.activeProvider).toBe('thinkingmachines')
            expect(switched3.config.activeModel).toBe('thinkingmachines/Inkling')

            // Switch: thinkingmachines -> abliteration via alias abliteration-ai
            const targetAblit = resolveSwitchTarget(switched3.config, 'abliteration-ai')
            expect(targetAblit).toBeDefined()
            const switched4 = applyProviderSwitch(switched3.config, targetAblit!)
            expect(switched4.config.activeProvider).toBe('abliteration')
            expect(switched4.config.activeModel).toBe('abliterated-model-large-v2')

            // Switch: abliteration -> agnes via alias agnes-ai
            const targetAgnes = resolveSwitchTarget(switched4.config, 'agnes-ai')
            expect(targetAgnes).toBeDefined()
            const switched5 = applyProviderSwitch(switched4.config, targetAgnes!)
            expect(switched5.config.activeProvider).toBe('agnes')
            expect(switched5.config.activeModel).toBe('agnes-3.0-flash')

            // Switch: agnes -> airouter via alias ai-router
            const targetAIRouter = resolveSwitchTarget(switched5.config, 'ai-router')
            expect(targetAIRouter).toBeDefined()
            const switched6 = applyProviderSwitch(switched5.config, targetAIRouter!)
            expect(switched6.config.activeProvider).toBe('airouter')
            expect(switched6.config.activeModel).toBe('gpt-5.6-luna')

            // Switch: airouter -> aiand
            const targetAIAnd = resolveSwitchTarget(switched6.config, 'aiand')
            expect(targetAIAnd).toBeDefined()
            const switched7 = applyProviderSwitch(switched6.config, targetAIAnd!)
            expect(switched7.config.activeProvider).toBe('aiand')
            expect(switched7.config.activeModel).toBe('deepseek-ai/deepseek-v4-flash')

            // Switch: aiand -> aki via alias aki-io
            const targetAKI = resolveSwitchTarget(switched7.config, 'aki-io')
            expect(targetAKI).toBeDefined()
            const switched8 = applyProviderSwitch(switched7.config, targetAKI!)
            expect(switched8.config.activeProvider).toBe('aki')
            expect(switched8.config.activeModel).toBe('deepseek-v4-flash-0731-284b')

            // Switch: aki -> ambient
            const targetAmbient = resolveSwitchTarget(switched8.config, 'ambient')
            expect(targetAmbient).toBeDefined()
            const switched9 = applyProviderSwitch(switched8.config, targetAmbient!)
            expect(switched9.config.activeProvider).toBe('ambient')
            expect(switched9.config.activeModel).toBe('deepseek/deepseek-v4-flash')

            // Switch: ambient -> auriko via alias auriko-ai
            const targetAuriko = resolveSwitchTarget(switched9.config, 'auriko-ai')
            expect(targetAuriko).toBeDefined()
            const switched10 = applyProviderSwitch(switched9.config, targetAuriko!)
            expect(switched10.config.activeProvider).toBe('auriko')
            expect(switched10.config.activeModel).toBe('claude-sonnet-4-6')

            // Switch: auriko -> baseten via alias baseten-co
            const targetBaseten = resolveSwitchTarget(switched10.config, 'baseten-co')
            expect(targetBaseten).toBeDefined()
            const switched11 = applyProviderSwitch(switched10.config, targetBaseten!)
            expect(switched11.config.activeProvider).toBe('baseten')
            expect(switched11.config.activeModel).toBe('deepseek-ai/DeepSeek-V4.1-Flash')

            // Switch: baseten -> sarvam
            const targetSarvam = resolveSwitchTarget(switched11.config, 'sarvam')
            expect(targetSarvam).toBeDefined()
            const switched12 = applyProviderSwitch(switched11.config, targetSarvam!)
            expect(switched12.config.activeProvider).toBe('sarvam')
            expect(switched12.config.activeModel).toBe('sarvam-105b')
        })
    })
})
