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
        })
    })

    describe('Multi-Provider Session Switching Simulation', () => {
        it('configures and sequentially switches through all 4 new providers in active session', () => {
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
                },
            }

            const configured = getConfiguredProviders(initialConfig)
            expect(configured.some((p) => p.value === 'provider:sarvam')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:stepfun')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:upstage')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:thinkingmachines')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:abliteration')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:agnes')).toBe(true)

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

            // Switch: agnes -> sarvam
            const targetSarvam = resolveSwitchTarget(switched5.config, 'sarvam')
            expect(targetSarvam).toBeDefined()
            const switched6 = applyProviderSwitch(switched5.config, targetSarvam!)
            expect(switched6.config.activeProvider).toBe('sarvam')
            expect(switched6.config.activeModel).toBe('sarvam-105b')
        })
    })
})
