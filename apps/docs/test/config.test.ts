import { describe, expect, it } from 'bun:test'

import astroConfig from '../astro.config.mjs'

describe('apps/docs astro configuration', () => {
    const rawConfig = astroConfig as Record<string, any>

    it('configures canonical production site url', () => {
        expect(astroConfig.site).toBe('https://trydecember.com')
    })

    it('sets output mode to static for pre-rendering', () => {
        expect(astroConfig.output).toBe('static')
    })

    it('uses port 2000 for local dev and preview servers', () => {
        expect(rawConfig.server?.port).toBe(2000)
        expect(rawConfig.preview?.port).toBe(2000)
    })

    it('configures mdx integration and github-light shiki theme', () => {
        expect(Array.isArray(rawConfig.integrations)).toBe(true)
        const integrationNames = (rawConfig.integrations ?? []).map((i: any) => i?.name)
        expect(integrationNames).toContain('@astrojs/mdx')

        expect(rawConfig.markdown?.shikiConfig?.theme).toBe('github-light')
    })

    it('defines meta environment variables in vite define', () => {
        expect(rawConfig.vite?.define).toBeDefined()
        const defines = rawConfig.vite?.define as Record<string, string> | undefined
        expect(defines).toBeDefined()
        if (defines) {
            expect(defines['import.meta.env.WEB_URL']).toBeDefined()
            expect(defines['import.meta.env.APP_URL']).toBeDefined()
            expect(defines['import.meta.env.SERVER_URL']).toBeDefined()
        }
    })

    it('configures social and changelog redirects', () => {
        expect(rawConfig.redirects).toBeDefined()
        expect(rawConfig.redirects['/twitter']).toBe('https://x.com/phasehumans')
        expect(rawConfig.redirects['/x']).toBe('https://x.com/phasehumans')
        expect(rawConfig.redirects['/youtube']).toBe('https://www.youtube.com/@phasehumans')
        expect(rawConfig.redirects['/yt']).toBe('https://www.youtube.com/@phasehumans')
        expect(rawConfig.redirects['/changelog']).toBe('/docs/changelog')
    })

    it('configures installer redirects for standalone curl script', async () => {
        const GITHUB_RAW_INSTALL_URL =
            'https://raw.githubusercontent.com/phasehumans/december/main/install.sh'
        expect(rawConfig.redirects['/install.sh']).toBe(GITHUB_RAW_INSTALL_URL)
        expect(rawConfig.redirects['/install']).toBe(GITHUB_RAW_INSTALL_URL)

        const redirectsPath = new URL('../public/_redirects', import.meta.url).pathname
        const content = await Bun.file(redirectsPath).text()
        expect(content).toContain('/install.sh')
        expect(content).toContain(GITHUB_RAW_INSTALL_URL)
        expect(content).toContain('/install')
    })
})
