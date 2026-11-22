import { describe, expect, it } from 'bun:test'

import {
    formatProviderName,
    PROVIDER_KEY_URLS,
    PROVIDER_NAMES,
    PROVIDER_MENU_ITEMS,
    SUBSCRIPTION_PROVIDER_ITEMS,
} from '../../src/constants/providers'

describe('BYOK Provider URLs & Names Audit (Unit)', () => {
    it('ensures all BYOK providers have corresponding key URLs starting with https://', () => {
        expect(PROVIDER_MENU_ITEMS.length).toBe(42)

        for (const item of PROVIDER_MENU_ITEMS) {
            const url = PROVIDER_KEY_URLS[item.value]
            expect(url).toBeDefined()
            expect(typeof url).toBe('string')
            expect(url.startsWith('https://')).toBe(true)
        }
    })

    it('ensures all BYOK providers have a display name defined in PROVIDER_NAMES', () => {
        for (const item of PROVIDER_MENU_ITEMS) {
            const name = PROVIDER_NAMES[item.value]
            expect(name).toBeDefined()
            expect(typeof name).toBe('string')
            expect(name.length).toBeGreaterThan(0)
            expect(formatProviderName(item.value)).toBe(name)
        }
    })

    it('validates specific exact destination URLs for major providers', () => {
        // keys pages checked against provider docs on 2026-11-21 (#619)
        expect(PROVIDER_KEY_URLS['ai21']).toBe('https://studio.ai21.com/v2')
        expect(PROVIDER_KEY_URLS['anthropic']).toBe('https://platform.claude.com/settings/keys')
        expect(PROVIDER_KEY_URLS['arcee']).toBe('https://platform.arcee.ai/api/api-keys')
        expect(PROVIDER_KEY_URLS['cohere']).toBe('https://dashboard.cohere.com/api-keys')
        expect(PROVIDER_KEY_URLS['meta']).toBe('https://dev.meta.ai/')
        expect(PROVIDER_KEY_URLS['mistral']).toBe('https://console.mistral.ai/api-keys')
        expect(PROVIDER_KEY_URLS['moonshot']).toBe('https://platform.kimi.ai/console/api-keys')
        expect(PROVIDER_KEY_URLS['openai']).toBe('https://platform.openai.com/api-keys')
        expect(PROVIDER_KEY_URLS['google']).toBe('https://aistudio.google.com/api-keys')
        expect(PROVIDER_KEY_URLS['openrouter']).toBe('https://openrouter.ai/settings/keys')
        expect(PROVIDER_KEY_URLS['deepseek']).toBe('https://platform.deepseek.com/api_keys')
        expect(PROVIDER_KEY_URLS['groq']).toBe('https://console.groq.com/keys')
        expect(PROVIDER_KEY_URLS['sakana']).toBe('https://console.sakana.ai/api-keys')
        expect(PROVIDER_KEY_URLS['sarvam']).toBe('https://indus.sarvam.ai/key-management')
        expect(PROVIDER_KEY_URLS['stepfun']).toBe('https://platform.stepfun.ai/interface-key')
        expect(PROVIDER_KEY_URLS['upstage']).toBe('https://console.upstage.ai/api-keys')
        expect(PROVIDER_KEY_URLS['thinkingmachines']).toBe(
            'https://tinker.thinkingmachines.ai/keys'
        )
        expect(PROVIDER_KEY_URLS['minimax']).toBe(
            'https://platform.minimax.io/user-center/basic-information/interface-key'
        )
        expect(PROVIDER_KEY_URLS['xiaomi']).toBe(
            'https://platform.xiaomimimo.com/#/console/api-keys'
        )
        expect(PROVIDER_KEY_URLS['xai']).toBe('https://console.x.ai/team/default/api-keys')
        expect(PROVIDER_KEY_URLS['zai']).toBe('https://z.ai/manage-apikey/apikey-list')
        expect(PROVIDER_KEY_URLS['inception']).toBe(
            'https://platform.inceptionlabs.ai/dashboard/api-keys'
        )
        expect(PROVIDER_KEY_URLS['nvidia']).toBe('https://build.nvidia.com/settings/api-keys')
        expect(PROVIDER_KEY_URLS['morph']).toBe('https://morphllm.com/dashboard/api-keys')
    })

    it('points each key link at the same region and product as the endpoint december calls', () => {
        // chat goes to api.kimi.com/coding (kimi code plan), not the moonshot platform
        expect(PROVIDER_KEY_URLS['kimi']).toBe('https://www.kimi.com/code/console')
        // chat goes to api.siliconflow.cn and dashscope.aliyuncs.com (china sites)
        expect(PROVIDER_KEY_URLS['siliconflow']).toContain('cloud.siliconflow.cn')
        expect(PROVIDER_KEY_URLS['siliconflow-intl']).toContain('cloud.siliconflow.com')
        expect(PROVIDER_KEY_URLS['dashscope']).toContain('bailian.console.aliyun.com/cn-beijing')
        expect(PROVIDER_KEY_URLS['dashscope-intl']).toContain('ap-southeast-1')
        // zhipu aliases call api.z.ai, the international site
        expect(PROVIDER_KEY_URLS['zhipuai']).toBe(PROVIDER_KEY_URLS['zai'])
    })

    it('gives every alias the same key link as its provider', () => {
        const aliases: [string, string][] = [
            ['sarvam-ai', 'sarvam'],
            ['sarvamai', 'sarvam'],
            ['upstageai', 'upstage'],
            ['solar', 'upstage'],
            ['moonshot-ai', 'moonshot'],
            ['moonshotai', 'moonshot'],
            ['mistral-ai', 'mistral'],
            ['minimax-ai', 'minimax'],
            ['meta-ai', 'meta'],
            ['sakana-ai', 'sakana'],
            ['stepfun-ai', 'stepfun'],
            ['arcee-ai', 'arcee'],
            ['togetherai', 'together'],
            ['tinker', 'thinkingmachines'],
            ['mimo', 'xiaomi'],
            ['claude', 'anthropic'],
            ['siliconcloud', 'siliconflow'],
        ]
        for (const [alias, provider] of aliases) {
            expect(PROVIDER_KEY_URLS[alias]).toBe(PROVIDER_KEY_URLS[provider])
        }
    })

    it('ensures all subscription providers are defined, valid, and sorted alphabetically', () => {
        expect(SUBSCRIPTION_PROVIDER_ITEMS.length).toBe(5)

        const labels = SUBSCRIPTION_PROVIDER_ITEMS.map((item) => item.label)
        const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b))
        expect(labels).toEqual(sortedLabels)

        expect(SUBSCRIPTION_PROVIDER_ITEMS.map((item) => item.value)).toEqual([
            'amazon-q',
            'claude',
            'copilot',
            'gemini',
            'codex',
        ])
    })
})
