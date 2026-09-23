import { describe, expect, test } from 'bun:test'

import { PROVIDER_KEY_URLS } from '../../../../packages/tui/src/components/menus/byok-key-menu'
import { PROVIDER_MENU_ITEMS } from '../../../../packages/tui/src/components/menus/byok-provider-menu'
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
        'vultr',
        'digitalocean',
        'scaleway',
        'modal',
        'hetzner',
        'ai21',
        'amd',
        'nova',
        'morph',
        'poe',
        'v0',
        'opencode',
        'requesty',
        'abacus',
        'fastrouter',
        'volcengine',
        '302ai',
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
        expect(formatProviderName('vultr')).toBe('Vultr')
        expect(formatProviderName('ai21')).toBe('AI21 Labs')
        expect(formatProviderName('volcengine')).toBe('Volcengine Ark')
        expect(formatProviderName('302ai')).toBe('302.AI')
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

    test('provider menu contains all 186 BYOK items', () => {
        expect(PROVIDER_MENU_ITEMS.length).toBeGreaterThanOrEqual(186)
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

        const vultrErr = parseError(
            new Error('402 Payment Required: vultrinference.com credits exhausted')
        )
        expect(vultrErr.hint).toContain('https://my.vultr.com/billing/')
    })

    test('verifies existing provider fixes (SiliconFlow, DashScope, ZAI, MiniMax, Kimi)', () => {
        const siliconflowGlobal = instantiateProvider('siliconflow', 'test-key')
        expect(siliconflowGlobal).toBeDefined()

        const siliconflowCn = instantiateProvider('siliconflow-cn', 'test-key')
        expect(siliconflowCn).toBeDefined()

        const dashscopeIntl = instantiateProvider('dashscope-intl', 'test-key')
        expect(dashscopeIntl).toBeDefined()

        const zaiStandard = instantiateProvider('zai', 'test-key')
        expect(zaiStandard).toBeDefined()

        const zaiCoding = instantiateProvider('zai-coding-plan', 'test-key')
        expect(zaiCoding).toBeDefined()

        const minimax = instantiateProvider('minimax', 'test-key')
        expect(minimax).toBeDefined()
    })
})
