import {
    getModelContextWindow,
    SarvamProvider,
    StepFunProvider,
    UpstageProvider,
    ThinkingMachinesProvider,
    resolveThinkingMachinesModel,
    XiaomiProvider,
    ZhipuAIProvider,
    WaferAiProvider,
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

        it('instantiates WaferAiProvider with proper endpoint and credentials', () => {
            const provider = new WaferAiProvider('test-wafer-key')
            expect(provider.id).toBe('wafer.ai')
        })
    })

    describe('Model Context Windows', () => {
        it('returns correct context windows for all new provider models', () => {
            expect(getModelContextWindow('solar-pro4')).toBe(524288)
            expect(getModelContextWindow('solar-pro3')).toBe(131072)
            expect(getModelContextWindow('solar-pro2')).toBe(65536)
            expect(getModelContextWindow('solar-mini')).toBe(32768)
            expect(getModelContextWindow('mistral-large-latest')).toBe(262144)
            expect(getModelContextWindow('codestral-latest')).toBe(256000)
            expect(getModelContextWindow('open-mistral-nemo')).toBe(128000)
            expect(getModelContextWindow('mistral-small-latest')).toBe(256000)
            expect(getModelContextWindow('pixtral-large-latest')).toBe(128000)
            expect(getModelContextWindow('sonar-pro')).toBe(200000)
            expect(getModelContextWindow('gpt-4.1')).toBe(1047576)
            expect(getModelContextWindow('gpt-5.4-pro')).toBe(1050000)
            expect(getModelContextWindow('claude-sonnet-4-6')).toBe(1000000)
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
            expect(getModelContextWindow('wafer.ai/glm5.2-fast')).toBe(1048576)
            expect(getModelContextWindow('wafer.ai/Kimi-K2.6')).toBe(262144)
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

            const waferModels = getProviderModels('wafer.ai')
            expect(waferModels.map((m) => m.value)).toEqual([
                'glm5.2-fast',
                'GLM-5.2',
                'MiniMax-M3',
                'Kimi-K2.6',
                'GLM-5.1',
            ])

            // Test aliases
            expect(getProviderModels('solar')).toEqual(upstageModels)
            expect(getProviderModels('tinker')).toEqual(tinkerModels)
            expect(getProviderModels('inkling')).toEqual(tinkerModels)
            expect(getProviderModels('mimo')).toEqual(xiaomiModels)
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
            expect(getDefaultModelForProvider('wafer.ai')).toBe('glm5.2-fast')
        })

        it('validates and normalizes models correctly', () => {
            expect(isValidModelForProvider('sarvam', 'sarvam-105b')).toBe(true)
            expect(isValidModelForProvider('stepfun', 'step-3.7-flash')).toBe(true)
            expect(isValidModelForProvider('upstage', 'solar-pro4')).toBe(true)
            expect(isValidModelForProvider('thinkingmachines', 'thinkingmachines/Inkling')).toBe(
                true
            )
            expect(isValidModelForProvider('wafer.ai', 'glm5.2-fast')).toBe(true)
        })

        it('normalizes fallback models properly', () => {
            expect(ensureValidModelForProvider('sarvam', 'sarvam-105b')).toBe('sarvam-105b')
            expect(ensureValidModelForProvider('stepfun', 'step-3.7-flash')).toBe('step-3.7-flash')
            expect(ensureValidModelForProvider('upstage', 'solar-pro4')).toBe('solar-pro4')
            expect(ensureValidModelForProvider('thinkingmachines', 'inkling')).toBe(
                'thinkingmachines/Inkling'
            )
        })
    })

    describe('Provider Name Formatting', () => {
        it('formats names properly for each provider and alias', () => {
            expect(formatProviderName('sarvam')).toBe('Sarvam AI')
            expect(formatProviderName('sarvam-ai')).toBe('Sarvam AI')
            expect(formatProviderName('stepfun')).toBe('StepFun (Global)')
            expect(formatProviderName('stepfun-ai')).toBe('StepFun (Global)')
            expect(formatProviderName('upstage')).toBe('Upstage Solar')
            expect(formatProviderName('solar')).toBe('Upstage Solar')
            expect(formatProviderName('thinkingmachines')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('tinker')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('xiaomi')).toBe('Xiaomi')
            expect(formatProviderName('mimo')).toBe('Xiaomi')
            expect(formatProviderName('zai')).toBe('Zhipu AI')
            expect(formatProviderName('wafer.ai')).toBe('Wafer')
        })
    })

    describe('Cost Calculation & In-Terminal Cards', () => {
        it('calculates accurate usage costs for new providers', () => {
            const sarvamCost = calculateUsageCost({
                model: 'sarvam-105b',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            expect(sarvamCost.totalCost).toBeCloseTo(3.75, 2)

            const stepfunCost = calculateUsageCost({
                model: 'step-3.7-flash',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            expect(stepfunCost.totalCost).toBeCloseTo(0.7, 2)

            const upstageCost = calculateUsageCost({
                model: 'solar-pro4',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            expect(upstageCost.totalCost).toBeCloseTo(0.5, 2)

            const tinkerCost = calculateUsageCost({
                model: 'thinkingmachines/Inkling',
                promptTokens: 1_000_000,
                completionTokens: 1_000_000,
            })
            expect(tinkerCost.totalCost).toBeCloseTo(8.0, 2)
        })

        it('infers providers from models correctly', () => {
            expect(inferProviderFromModel('sarvam-105b')).toBe('sarvam')
            expect(inferProviderFromModel('step-3.7-flash')).toBe('stepfun')
            expect(inferProviderFromModel('solar-pro4')).toBe('upstage')
            expect(inferProviderFromModel('thinkingmachines/Inkling')).toBe('thinkingmachines')
            expect(inferProviderFromModel('wafer.ai/glm5.2-fast')).toBe('wafer.ai')
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

            const waferCard = formatUsageCard({
                model: 'glm5.2-fast',
                authMethod: 'byok',
                provider: 'wafer.ai',
                isAuthenticated: true,
            })
            expect(waferCard).toContain('https://wafer.ai/')
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
                    xiaomi: 'sk-xiaomi-live',
                    zai: 'sk-zai-live',
                    'wafer.ai': 'sk-wafer-live',
                },
            }

            const configured = getConfiguredProviders(initialConfig)
            expect(configured.some((p) => p.value === 'provider:sarvam')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:stepfun')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:upstage')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:thinkingmachines')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:xiaomi')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:zai')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:wafer.ai')).toBe(true)

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

            // Switch: thinkingmachines -> xiaomi via alias mimo
            const targetXiaomi = resolveSwitchTarget(switched3.config, 'mimo')
            expect(targetXiaomi).toBeDefined()
            const switched4 = applyProviderSwitch(switched3.config, targetXiaomi!)
            expect(switched4.config.activeProvider).toBe('xiaomi')
            expect(switched4.config.activeModel).toBe('mimo-v2.5')

            // Switch: xiaomi -> wafer.ai
            const targetWafer = resolveSwitchTarget(switched4.config, 'wafer.ai')
            expect(targetWafer).toBeDefined()
            const switched5 = applyProviderSwitch(switched4.config, targetWafer!)
            expect(switched5.config.activeProvider).toBe('wafer.ai')
            expect(switched5.config.activeModel).toBe('glm5.2-fast')

            // Switch: wafer.ai -> sarvam
            const targetSarvam = resolveSwitchTarget(switched5.config, 'sarvam')
            expect(targetSarvam).toBeDefined()
            const switched6 = applyProviderSwitch(switched5.config, targetSarvam!)
            expect(switched6.config.activeProvider).toBe('sarvam')
            expect(switched6.config.activeModel).toBe('sarvam-105b')
        })
    })
})
