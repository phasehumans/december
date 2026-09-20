import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

describe('apps/docs static build verification', () => {
    const distDir = join(__dirname, '../dist')

    it('generates dist directory with required HTML pages', () => {
        const requiredPages = [
            'index.html',
            'docs/index.html',
            'docs/quickstart/index.html',
            'docs/cli/index.html',
            'docs/architecture/index.html',
            'docs/agent-loop/index.html',
            'docs/checkpoints/index.html',
            'docs/previews/index.html',
            'docs/slash-commands/index.html',
            'docs/prompting/index.html',
            'docs/integrations/index.html',
            'docs/security/index.html',
            'privacy/index.html',
            'terms/index.html',
        ]

        for (const page of requiredPages) {
            const fullPath = join(distDir, page)
            expect(existsSync(fullPath)).toBe(true)
        }
    })

    it('landing page contains canonical domain, CLI install command, and app.trydecember.com links', () => {
        const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8')

        // Canonical link
        expect(indexHtml).toContain('https://trydecember.com')

        // CLI install command
        expect(indexHtml).toContain('npm install -g @trydecember/cli')

        // Links to app.trydecember.com for Web Workspace and Login
        expect(indexHtml).toContain('https://app.trydecember.com')
        expect(indexHtml).toContain('https://app.trydecember.com/login')
    })

    it('docs overview page contains documentation layout and links to subsections', () => {
        const docsHtml = readFileSync(join(distDir, 'docs/index.html'), 'utf-8')

        expect(docsHtml).toContain('Introducing December')
        expect(docsHtml).toContain('/docs/quickstart')
        expect(docsHtml).toContain('/docs/cli')
    })
})
