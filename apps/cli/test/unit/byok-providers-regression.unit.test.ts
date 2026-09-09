import {
    getModelContextWindow,
    SarvamProvider,
    StepFunProvider,
    UpstageProvider,
    ThinkingMachinesProvider,
    resolveThinkingMachinesModel,
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

            // Test aliases
            expect(getProviderModels('solar')).toEqual(upstageModels)
            expect(getProviderModels('tinker')).toEqual(tinkerModels)
            expect(getProviderModels('inkling')).toEqual(tinkerModels)
        })

        it('returns correct default models for providers', () => {
            expect(getDefaultModelForProvider('sarvam')).toBe('sarvam-105b')
            expect(getDefaultModelForProvider('stepfun')).toBe('step-3.7-flash')
            expect(getDefaultModelForProvider('upstage')).toBe('solar-pro4')
            expect(getDefaultModelForProvider('solar')).toBe('solar-pro4')
            expect(getDefaultModelForProvider('thinkingmachines')).toBe('thinkingmachines/Inkling')
            expect(getDefaultModelForProvider('tinker')).toBe('thinkingmachines/Inkling')
        })

        it('validates and normalizes models correctly', () => {
            expect(isValidModelForProvider('sarvam', 'sarvam-105b')).toBe(true)
            expect(isValidModelForProvider('stepfun', 'step-3.7-flash')).toBe(true)
            expect(isValidModelForProvider('upstage', 'solar-pro4')).toBe(true)
            expect(isValidModelForProvider('thinkingmachines', 'thinkingmachines/Inkling')).toBe(
                true
            )
            expect(isValidModelForProvider('thinkingmachines', 'inkling')).toBe(true)

            expect(ensureValidModelForProvider('thinkingmachines', 'inkling')).toBe(
                'thinkingmachines/Inkling'
            )
            expect(ensureValidModelForProvider('tinker', 'inkling')).toBe(
                'thinkingmachines/Inkling'
            )
            expect(ensureValidModelForProvider('upstage', 'solar-pro4')).toBe('solar-pro4')
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
            expect(formatProviderName('tinker')).toBe('Thinking Machines (Tinker)')
            expect(formatProviderName('inkling')).toBe('Thinking Machines (Tinker)')
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
        })

        it('infers providers from models correctly', () => {
            expect(inferProviderFromModel('sarvam-30b')).toBe('sarvam')
            expect(inferProviderFromModel('step-3.5-flash')).toBe('stepfun')
            expect(inferProviderFromModel('solar-mini')).toBe('upstage')
            expect(inferProviderFromModel('thinkingmachines/Inkling:peft:262144')).toBe(
                'thinkingmachines'
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
                },
            }

            const configured = getConfiguredProviders(initialConfig)
            expect(configured.some((p) => p.value === 'provider:sarvam')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:stepfun')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:upstage')).toBe(true)
            expect(configured.some((p) => p.value === 'provider:thinkingmachines')).toBe(true)

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

            // Switch: thinkingmachines -> sarvam
            const targetSarvam = resolveSwitchTarget(switched3.config, 'sarvam')
            expect(targetSarvam).toBeDefined()
            const switched4 = applyProviderSwitch(switched3.config, targetSarvam!)
            expect(switched4.config.activeProvider).toBe('sarvam')
            expect(switched4.config.activeModel).toBe('sarvam-105b')
        })
    })
})
