import { PROVIDER_KEY_URLS, PROVIDER_MENU_ITEMS } from '@december/tui'
import { describe, expect, test } from 'bun:test'

import { formatProviderName } from '../../src/config'
import { parseError } from '../../src/utils/error-parser'
import {
    getDefaultModelForProvider,
    getProviderModels,
    isValidModelForProvider,
} from '../../src/utils/models'
import { instantiateProvider } from '../../src/utils/provider-factory'

describe('Extended BYOK CLI Integration (Unit)', () => {
    const sampleProviders = [
        'deepinfra',
        'novita-ai',
        'nebius',
        'ai21',
        'morph',
        'abacus',
        'volcengine',
        'wafer.ai',
    ]

    test('instantiates providers with valid endpoints and ID', () => {
        for (const p of sampleProviders) {
            const instance = instantiateProvider(p, 'dummy-key')
            expect(instance).toBeDefined()
            if (typeof instance === 'object') {
                expect(instance.id).toBe(p)
                expect(typeof instance.stream).toBe('function')
            }
        }
    })

    test('formats provider display names cleanly', () => {
        expect(formatProviderName('deepinfra')).toBe('Deep Infra')
        expect(formatProviderName('novita-ai')).toBe('NovitaAI')
        expect(formatProviderName('wafer.ai')).toBe('Wafer')
        expect(formatProviderName('ai21')).toBe('AI21 Labs')
        expect(formatProviderName('volcengine')).toBe('Volcengine Ark')
    })

    test('returns verified default models and static models list', () => {
        for (const p of sampleProviders) {
            const defModel = getDefaultModelForProvider(p)
            expect(defModel).toBeDefined()
            expect(defModel.length).toBeGreaterThan(0)

            const models = getProviderModels(p)
            expect(models).toBeDefined()
            expect(models.length).toBeGreaterThan(0)
            expect(models.some((m) => m.value === defModel)).toBe(true)
            expect(isValidModelForProvider(p, defModel)).toBe(true)
        }
    })

    test('provider menu contains all 42 curated BYOK items', () => {
        expect(PROVIDER_MENU_ITEMS.length).toBe(42)
        const values = new Set(PROVIDER_MENU_ITEMS.map((item) => item.value))
        for (const p of sampleProviders) {
            expect(values.has(p)).toBe(true)
        }
    })

    test('provider key URLs contains valid direct URLs for all sample providers', () => {
        for (const p of sampleProviders) {
            const url = PROVIDER_KEY_URLS[p]
            expect(url).toBeDefined()
            expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true)
        }
    })

    test('parses credit & balance errors with actionable hints for serverless platforms', () => {
        const deepinfraErr = parseError(
            new Error('402 Payment Required: deepinfra.com account out of credits')
        )
        expect(deepinfraErr.hint).toContain('https://deepinfra.com/dash/billing')

        const novitaErr = parseError(
            new Error('402 Payment Required: novita.ai insufficient_balance')
        )
        expect(novitaErr.hint).toContain('https://novita.ai/settings/billing')
    })

    test('verifies existing provider fixes (SiliconFlow, DashScope, ZAI, MiniMax, Kimi)', () => {
        expect(isValidModelForProvider('siliconflow', 'deepseek-ai/DeepSeek-V3')).toBe(true)
        expect(isValidModelForProvider('dashscope', 'qwen2.5-coder-32b-instruct')).toBe(true)
        expect(isValidModelForProvider('zai', 'glm-5.3-flash')).toBe(true)
        expect(isValidModelForProvider('minimax', 'minimax-text-01')).toBe(true)
        expect(isValidModelForProvider('kimi', 'k3')).toBe(true)
    })
})
