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

    it('configures static install scripts and /install redirect', async () => {
        expect(rawConfig.redirects['/install']).toBe('/install.sh')

        const redirectsPath = new URL('../public/_redirects', import.meta.url).pathname
        const redirectsContent = await Bun.file(redirectsPath).text()
        expect(redirectsContent).toContain('/install')
        expect(redirectsContent).toContain('/install.sh')

        const installShPath = new URL('../public/install.sh', import.meta.url).pathname
        const installShContent = await Bun.file(installShPath).text()
        expect(installShContent).toContain('REPO="phasehumans/december"')
        expect(installShContent).toContain('detect_target()')

        const installPs1Path = new URL('../public/install.ps1', import.meta.url).pathname
        const installPs1Content = await Bun.file(installPs1Path).text()
        expect(installPs1Content).toContain('$Repo = "phasehumans/december"')
        expect(installPs1Content).toContain('$ProgressPreference = "SilentlyContinue"')
        expect(installPs1Content).toContain('$Target = "x86_64-pc-windows-msvc"')
        expect(installPs1Content).toContain('december-$Target.zip')
        expect(installPs1Content).toContain('Log-Success')
        expect(installPs1Content).toContain('SHASUMS256.txt')
        expect(installPs1Content).toContain('Get-FileHash')
        expect(installPs1Content).toContain('curl.exe')
    })
})
