import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

describe('apps/docs code block styling & minimal layout tests', () => {
    const distDir = join(__dirname, '../dist')

    const docPagesWithCode = [
        'docs/integrations/index.html',
        'docs/quickstart/index.html',
        'docs/cli/index.html',
        'docs/prompting/index.html',
        'docs/index.html',
    ]

    for (const pagePath of docPagesWithCode) {
        it(`${pagePath} renders pre code blocks with minimal styling rules`, () => {
            const fullPath = join(distDir, pagePath)
            expect(existsSync(fullPath)).toBe(true)

            const html = readFileSync(fullPath, 'utf-8')

            // Must contain Astro pre code element
            expect(html).toContain('<pre class="astro-code')

            // Must include global styling rules that prevent horizontal & vertical scrolling
            expect(html).toMatch(/overflow-y:\s*hidden\s*!important/)
            expect(html).toMatch(/overflow-x:\s*hidden\s*!important/)

            // Must completely eliminate scrollbars
            expect(html).toMatch(/scrollbar-width:\s*none\s*!important/)
            expect(html).toContain('pre::-webkit-scrollbar')

            // Must wrap code lines cleanly without forcing horizontal overflow
            expect(html).toMatch(/white-space:\s*pre-wrap\s*!important/)
            expect(html).toMatch(/word-break:\s*break-word\s*!important/)

            // Must include wrapper and minimal copy button styling definitions
            expect(html).toContain('.code-block-wrapper')
            expect(html).toContain('.code-copy-btn')
            expect(html).toContain('.code-copy-icon')

            // Must include client script that mounts wrapper and copy button
            expect(html).toContain('hasCopyBtn')
            expect(html).toContain('code-block-wrapper')
            expect(html).toContain('scrollbarWidth')
        })
    }

    it('docs styling avoids inline button layout shift inside pre tags', () => {
        const html = readFileSync(join(distDir, 'docs/integrations/index.html'), 'utf-8')
        // Pre tags in static HTML should only contain code element, not pre-injected buttons
        expect(html).toMatch(/<pre class="astro-code[^>]*><code>/)
    })
})
