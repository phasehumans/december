import { describe, it, expect } from 'bun:test'

import {
    calculateUsageCost,
    resolveModelRate,
    formatUsageCard,
    inferProviderFromModel,
} from '../src/utils/usage-rates'

describe('CLI In-Terminal Usage & Rates (Unit)', () => {
    it('resolves official rates for claude models', () => {
        const rate = resolveModelRate('claude-3-7-sonnet')
        expect(rate.inputRate).toBe(3.0)
        expect(rate.outputRate).toBe(15.0)
    })

    it('resolves official rates for gemini models', () => {
        const rate = resolveModelRate('gemini-3.7-flash')
        expect(rate.inputRate).toBe(0.1)
        expect(rate.outputRate).toBe(0.4)
    })

    it('calculates dollar costs accurately for prompt and completion tokens', () => {
        const cost = calculateUsageCost({
            model: 'claude-3-7-sonnet',
            promptTokens: 100_000,
            completionTokens: 20_000,
            cachedPromptTokens: 50_000,
        })

        expect(cost.promptCost).toBeCloseTo(0.3, 2)
        expect(cost.completionCost).toBeCloseTo(0.3, 2)
        expect(cost.totalCost).toBeGreaterThan(0)
    })

    it('resolves official rates for arcee models', () => {
        const rate = resolveModelRate('trinity-large-thinking')
        expect(rate.inputRate).toBe(0.25)
        expect(rate.outputRate).toBe(0.8)
    })

    it('resolves official rates for meta models', () => {
        const rate = resolveModelRate('muse-spark-1.3')
        expect(rate.inputRate).toBe(1.25)
        expect(rate.outputRate).toBe(4.25)

        const contributorRate = resolveModelRate('muse-spark-1.3-contributor')
        expect(contributorRate.inputRate).toBe(0.1)
        expect(contributorRate.outputRate).toBe(0.2)
    })

    it('resolves official rates for minimax models', () => {
        const m3Rate = resolveModelRate('MiniMax-M3')
        expect(m3Rate.inputRate).toBe(0.3)
        expect(m3Rate.outputRate).toBe(1.2)

        const m27HighspeedRate = resolveModelRate('MiniMax-M2.7-highspeed')
        expect(m27HighspeedRate.inputRate).toBe(0.6)
        expect(m27HighspeedRate.outputRate).toBe(2.4)
    })

    it('resolves official rates for sarvam, stepfun, upstage, and thinkingmachines models', () => {
        const sarvamRate = resolveModelRate('sarvam-105b')
        expect(sarvamRate.inputRate).toBe(0.75)
        expect(sarvamRate.outputRate).toBe(3.0)

        const stepfunRate = resolveModelRate('step-3.7-flash')
        expect(stepfunRate.inputRate).toBe(0.14)
        expect(stepfunRate.outputRate).toBe(0.56)

        const solarRate = resolveModelRate('solar-pro4')
        expect(solarRate.inputRate).toBe(0.25)
        expect(solarRate.outputRate).toBe(0.25)

        const tinkerRate = resolveModelRate('thinkingmachines/Inkling')
        expect(tinkerRate.inputRate).toBe(2.0)
        expect(tinkerRate.outputRate).toBe(6.0)
    })

    it('resolves official rates for xai, zai, and xiaomi models', () => {
        const grokRate = resolveModelRate('grok-4.6')
        expect(grokRate.inputRate).toBe(2.0)
        expect(grokRate.outputRate).toBe(6.0)

        const grokFastRate = resolveModelRate('grok-4.1-fast')
        expect(grokFastRate.inputRate).toBe(0.2)
        expect(grokFastRate.outputRate).toBe(0.5)

        const glmFlashRate = resolveModelRate('glm-5.3-flash')
        expect(glmFlashRate.inputRate).toBe(0.075)
        expect(glmFlashRate.outputRate).toBe(0.25)

        const glmRate = resolveModelRate('glm-5.3')
        expect(glmRate.inputRate).toBe(1.4)
        expect(glmRate.outputRate).toBe(4.4)

        const mimoRate = resolveModelRate('mimo-v2.5')
        expect(mimoRate.inputRate).toBe(0.14)
        expect(mimoRate.outputRate).toBe(0.28)

        const mimoProRate = resolveModelRate('mimo-v2.5-pro')
        expect(mimoProRate.inputRate).toBe(0.435)
        expect(mimoProRate.outputRate).toBe(0.87)
    })

    it('infers providers accurately from model names', () => {
        expect(inferProviderFromModel('claude-3-7-sonnet-latest')).toBe('anthropic')
        expect(inferProviderFromModel('gpt-4o')).toBe('openai')
        expect(inferProviderFromModel('gemini-3.6-flash')).toBe('google')
        expect(inferProviderFromModel('deepseek-chat')).toBe('deepseek')
        expect(inferProviderFromModel('trinity-large-thinking')).toBe('arcee')
        expect(inferProviderFromModel('muse-spark-1.3')).toBe('meta')
        expect(inferProviderFromModel('MiniMax-M3')).toBe('minimax')
        expect(inferProviderFromModel('laguna-s-2.1')).toBe('poolside')
        expect(inferProviderFromModel('fugu-ultra')).toBe('sakana')
        expect(inferProviderFromModel('sakana-namazu')).toBe('sakana')
        expect(inferProviderFromModel('sarvam-105b')).toBe('sarvam')
        expect(inferProviderFromModel('step-3.7-flash')).toBe('stepfun')
        expect(inferProviderFromModel('solar-pro4')).toBe('upstage')
        expect(inferProviderFromModel('thinkingmachines/Inkling')).toBe('thinkingmachines')
        expect(inferProviderFromModel('inkling')).toBe('thinkingmachines')
        expect(inferProviderFromModel('mimo-v2.5')).toBe('xiaomi')
        expect(inferProviderFromModel('glm-5.3')).toBe('zai')
        expect(inferProviderFromModel('grok-4.6')).toBe('xai')
        expect(inferProviderFromModel('llama3.3:latest')).toBe('ollama')
    })

    it('formats BYOK usage card for Xiaomi with console link', () => {
        const text = formatUsageCard({
            model: 'mimo-v2.5',
            authMethod: 'byok',
            provider: 'xiaomi',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `mimo-v2.5` (BYOK)')
        expect(text).toContain('Provider: Xiaomi MiMo')
        expect(text).toContain(
            '[https://platform.xiaomimimo.com/console/api-keys](https://platform.xiaomimimo.com/console/api-keys)'
        )
    })

    it('formats December Cloud Wallet usage card with accurate link and no emojis or bold', () => {
        const text = formatUsageCard({
            model: 'gemini-3.6-flash',
            authMethod: 'december',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `gemini-3.6-flash` (December Wallet)')
        expect(text).toContain('Provider: December Cloud')
        expect(text).toContain(
            '[https://trydecember.com/settings/usage](https://trydecember.com/settings/usage)'
        )
        // Ensure no bold markers, blockquote prefixes, bullets, or emojis
        expect(text).not.toContain('**')
        expect(text).not.toContain('>')
        expect(text).not.toContain('###')
        expect(text).not.toContain('•')
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
    })

    it('formats BYOK usage card for Google Gemini with AI Studio link and no emojis or bold', () => {
        const text = formatUsageCard({
            model: 'gemini-3.6-flash',
            authMethod: 'byok',
            provider: 'google',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `gemini-3.6-flash` (BYOK)')
        expect(text).toContain('Provider: Google AI Studio')
        expect(text).toContain(
            '[https://aistudio.google.com/app/usage](https://aistudio.google.com/app/usage)'
        )
        expect(text).not.toContain('**')
        expect(text).not.toContain('>')
        expect(text).not.toContain('###')
        expect(text).not.toContain('•')
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
    })

    it('formats BYOK usage card for Anthropic with console link and no bold', () => {
        const text = formatUsageCard({
            model: 'claude-3-7-sonnet-latest',
            authMethod: 'byok',
            provider: 'anthropic',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `claude-3-7-sonnet-latest` (BYOK)')
        expect(text).toContain('Provider: Anthropic Console')
        expect(text).toContain(
            '[https://console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing)'
        )
        expect(text).not.toContain('**')
        expect(text).not.toContain('>')
        expect(text).not.toContain('•')
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
    })

    it('formats BYOK usage card for Sarvam AI with indus portal link', () => {
        const text = formatUsageCard({
            model: 'sarvam-105b',
            authMethod: 'byok',
            provider: 'sarvam',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `sarvam-105b` (BYOK)')
        expect(text).toContain('Provider: Sarvam AI')
        expect(text).toContain('[https://indus.sarvam.ai/](https://indus.sarvam.ai/)')
    })

    it('formats BYOK usage card for StepFun with platform interface-key link', () => {
        const text = formatUsageCard({
            model: 'step-3.7-flash',
            authMethod: 'byok',
            provider: 'stepfun',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `step-3.7-flash` (BYOK)')
        expect(text).toContain('Provider: StepFun (Global)')
        expect(text).toContain(
            '[https://platform.stepfun.ai/interface-key](https://platform.stepfun.ai/interface-key)'
        )
    })

    it('formats BYOK usage card for Upstage Solar with console link', () => {
        const text = formatUsageCard({
            model: 'solar-pro4',
            authMethod: 'byok',
            provider: 'upstage',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `solar-pro4` (BYOK)')
        expect(text).toContain('Provider: Upstage Solar')
        expect(text).toContain('[https://console.upstage.ai](https://console.upstage.ai)')
    })

    it('formats BYOK usage card for Thinking Machines (Tinker) with tinker portal link', () => {
        const text = formatUsageCard({
            model: 'thinkingmachines/Inkling',
            authMethod: 'byok',
            provider: 'thinkingmachines',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `thinkingmachines/Inkling` (BYOK)')
        expect(text).toContain('Provider: Thinking Machines (Tinker)')
        expect(text).toContain(
            '[https://tinker.thinkingmachines.ai/](https://tinker.thinkingmachines.ai/)'
        )
    })

    it('formats Ollama usage card as local and offline without bold', () => {
        const text = formatUsageCard({
            model: 'llama3.3:latest',
            authMethod: 'byok',
            provider: 'ollama',
            isAuthenticated: true,
        })

        expect(text).toContain('Active Model: `llama3.3:latest` (Local)')
        expect(text).toContain('Provider: Ollama (Local)')
        expect(text).toContain('http://localhost:11434')
        expect(text).not.toContain('**')
        expect(text).not.toContain('>')
        expect(text).not.toContain('•')
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
    })

    it('formats unauthenticated notice matching the standard login prompt', () => {
        const text = formatUsageCard({
            model: 'gemini-3.6-flash',
            isAuthenticated: false,
        })

        expect(text).toContain(
            'You are not logged in and have no custom API keys (BYOK) configured.'
        )
        expect(text).toContain('Please run `/login` to:')
        expect(text).toContain('Sign in with your December account (Cloud Wallet)')
        expect(text).toContain('Configure Bring Your Own Key (BYOK)')
        expect(text).not.toContain('**')
        expect(text).not.toContain('>')
        expect(/[\u{1F300}-\u{1F9FF}]/u.test(text)).toBe(false)
    })
})
