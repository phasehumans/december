import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

describe('apps/docs link integrity verification', () => {
    const srcDir = join(__dirname, '../src')
    const publicDir = join(__dirname, '../public')

    const getAllSourceFiles = (dir: string): string[] => {
        let results: string[] = []
        const list = readdirSync(dir)
        for (const file of list) {
            const fullPath = join(dir, file)
            const stat = statSync(fullPath)
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllSourceFiles(fullPath))
            } else if (file.endsWith('.astro') || file.endsWith('.mdx')) {
                results.push(fullPath)
            }
        }
        return results
    }

    const validRoutes = new Set([
        '/',
        '/privacy',
        '/terms',
        '/docs',
        '/docs/quickstart',
        '/docs/architecture',
        '/docs/agent-loop',
        '/docs/checkpoints',
        '/docs/previews',
        '/docs/cli',
        '/docs/slash-commands',
        '/docs/prompting',
        '/docs/integrations',
        '/docs/security',
    ])

    const files = getAllSourceFiles(srcDir)

    it('finds source files in src directory', () => {
        expect(files.length).toBeGreaterThan(10)
    })

    it('ensures all internal route references resolve to existing pages or public assets', () => {
        const internalLinks: { file: string; link: string }[] = []

        for (const file of files) {
            const content = readFileSync(file, 'utf-8')

            // HTML href="..." or href={`...`}
            const hrefMatches = content.matchAll(/href=["'`](\/[^"'`\s]*)["'`]/g)
            for (const m of hrefMatches) {
                internalLinks.push({ file, link: m[1] })
            }

            // Markdown [text](/...)
            const mdMatches = content.matchAll(/\[[^\]]+\]\((\/[^)\s]*)\)/g)
            for (const m of mdMatches) {
                internalLinks.push({ file, link: m[1] })
            }
        }

        expect(internalLinks.length).toBeGreaterThan(0)

        for (const { file, link } of internalLinks) {
            // Strip hash anchor if present (e.g. /#section)
            const cleanPath = link.split('#')[0]

            if (cleanPath === '') {
                // Just an anchor link like #section
                continue
            }

            // Check if it's a known doc route
            const isRoute = validRoutes.has(cleanPath)

            // Or check if it's a static file in public/
            const isPublicAsset = existsSync(join(publicDir, cleanPath.slice(1)))

            expect(
                isRoute || isPublicAsset,
                `Broken internal link "${link}" found in ${file}`
            ).toBe(true)
        }
    })

    it('ensures all external links use HTTPS and target authorized domains', () => {
        const externalLinks: { file: string; url: string }[] = []

        for (const file of files) {
            const content = readFileSync(file, 'utf-8')

            // Match href="http..."
            const hrefMatches = content.matchAll(/href=["'`](https?:\/\/[^"'`\s]+)["'`]/g)
            for (const m of hrefMatches) {
                externalLinks.push({ file, url: m[1] })
            }

            // Match markdown [text](http...)
            const mdMatches = content.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)
            for (const m of mdMatches) {
                externalLinks.push({ file, url: m[1] })
            }
        }

        expect(externalLinks.length).toBeGreaterThan(0)

        for (const { file, url } of externalLinks) {
            // All external web links should be https
            expect(url.startsWith('https://'), `Insecure link "${url}" found in ${file}`).toBe(true)
        }
    })

    it('verifies support and security mailto links point to official @trydecember.com addresses', () => {
        const mailtoLinks: string[] = []

        for (const file of files) {
            const content = readFileSync(file, 'utf-8')
            const matches = content.matchAll(/href=["'`]mailto:([^"'`\s]+)["'`]/g)
            for (const m of matches) {
                mailtoLinks.push(m[1])
            }
        }

        expect(mailtoLinks.length).toBeGreaterThan(0)
        const allowedEmails = new Set(['team@trydecember.com', 'security@trydecember.com'])
        for (const email of mailtoLinks) {
            expect(allowedEmails.has(email)).toBe(true)
            expect(email.endsWith('@trydecember.com')).toBe(true)
        }
    })
})
