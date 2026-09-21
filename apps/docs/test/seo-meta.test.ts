import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { beforeAll, describe, expect, it } from 'bun:test'

import { version } from '../src/lib/version'

describe('apps/docs built HTML SEO & metadata verification', () => {
    const distDir = join(__dirname, '../dist')

    beforeAll(() => {
        if (!existsSync(distDir) || !existsSync(join(distDir, 'index.html'))) {
            execSync('bun run build', { cwd: join(__dirname, '..'), stdio: 'pipe' })
        }
    })

    const allPages = [
        'index.html',
        'privacy/index.html',
        'terms/index.html',
        'docs/index.html',
        'docs/quickstart/index.html',
        'docs/architecture/index.html',
        'docs/agent-loop/index.html',
        'docs/checkpoints/index.html',
        'docs/previews/index.html',
        'docs/cli/index.html',
        'docs/slash-commands/index.html',
        'docs/prompting/index.html',
        'docs/integrations/index.html',
        'docs/security/index.html',
    ]

    for (const page of allPages) {
        describe(`page: ${page}`, () => {
            const getHtml = (): string => {
                const fullPath = join(distDir, page)
                return readFileSync(fullPath, 'utf-8')
            }

            it('contains standard HTML5 document structure and charset', () => {
                const html = getHtml()
                expect(html.toLowerCase()).toContain('<!doctype html>')
                expect(html).toContain('<html lang="en">')
                expect(html).toContain('<meta charset="UTF-8">')
                expect(html).toContain('name="viewport"')
            })

            it('contains title and meta description with December branding', () => {
                const html = getHtml()

                expect(html).toContain('<title>')
                expect(html).toMatch(/<title>.*December.*<\/title>/)

                expect(html).toContain('<meta name="description" content="')
                const descMatch = html.match(/<meta name="description" content="([^"]+)"/)
                expect(descMatch).not.toBeNull()
                expect(descMatch![1].trim().length).toBeGreaterThan(15)
            })

            it('contains valid canonical URL under https://trydecember.com', () => {
                const html = getHtml()

                const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/)
                expect(canonicalMatch).not.toBeNull()
                expect(canonicalMatch![1].startsWith('https://trydecember.com')).toBe(true)
            })

            it('contains complete Open Graph and Twitter Card tags', () => {
                const html = getHtml()

                expect(html).toContain('<meta property="og:type" content="website">')
                expect(html).toContain('<meta property="og:url"')
                expect(html).toContain('<meta property="og:title"')
                expect(html).toContain('<meta property="og:description"')
                expect(html).toContain(
                    '<meta property="og:image" content="https://trydecember.com/og.png">'
                )

                expect(html).toContain(
                    '<meta property="twitter:card" content="summary_large_image">'
                )
                expect(html).toContain('<meta property="twitter:url"')
                expect(html).toContain('<meta property="twitter:title"')
                expect(html).toContain('<meta property="twitter:description"')
                expect(html).toContain(
                    '<meta property="twitter:image" content="https://trydecember.com/og.png">'
                )
            })

            it('includes favicon links and Geist typography font preconnects', () => {
                const html = getHtml()

                expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"')
                expect(html).toContain('rel="alternate icon" href="/favicon.ico"')
                expect(html).toContain('rel="apple-touch-icon" href="/favicon.png"')
                expect(html).toContain('fonts.googleapis.com')
            })

            it('renders persistent site header with brand name and version', () => {
                const html = getHtml()

                expect(html).toContain('December')
                expect(html).toContain(version)
                expect(html).toContain('[docs]')
                expect(html).toContain('[login]')
            })
        })
    }
})
